import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_DIRECT_TTS_LIMIT, PRO_DAILY_DIRECT_TTS_LIMIT } from "@/lib/constants";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import {
  resetDailyIfNeeded,
  isProDailyLimitReached,
  getDailyCount,
  incrementUsage,
} from "@/lib/usage";

// Convert raw PCM from Gemini into a proper WAV file with header
function pcmToWav(pcmData: Buffer, sampleRate = 24000, channels = 1, bitDepth = 16): Buffer {
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);
  return buffer;
}

function chunkText(text: string, maxLen: number = 3000): string[] {
  const chunks: string[] = [];
  const regex = /[^.!?\n]+[.!?\n]*/g;
  const matches = text.match(regex);
  const sentences = matches && matches.length > 0 ? matches : [text];

  let currentChunk = "";
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLen) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence;
      while (currentChunk.length > maxLen) {
        chunks.push(currentChunk.substring(0, maxLen).trim());
        currentChunk = currentChunk.substring(maxLen);
      }
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks.length ? chunks : [text];
}

const ADMIN_EMAILS = ["devanandutkarsh7@gail.com", "devanandutkarsh7@gmail.com"];

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    const currentEmail =
      (user?.email) ||
      (sessionClaims?.email as string) ||
      (sessionClaims?.primaryEmail as string) ||
      "";
    const isAdmin = ADMIN_EMAILS.includes(currentEmail);

    if (!user) {
      user = await User.create({
        clerkId: userId,
        email: currentEmail,
        plan: isAdmin ? "pro" : "free",
        planStatus: isAdmin ? "active" : "none",
      });
    } else if (isAdmin && user.plan !== "pro") {
      user.plan = "pro";
      user.planStatus = "active";
      await user.save();
    } else if (user.plan === "pro" && user.planExpiresAt && new Date(user.planExpiresAt) <= new Date()) {
      user.plan = "free";
      user.planStatus = "expired";
      await user.save();
    }

    // Reset daily counters if UTC date changed
    resetDailyIfNeeded(user);

    const { script, voice = "Kore" } = await req.json();

    if (!script?.trim()) {
      return NextResponse.json({ error: "Missing script" }, { status: 400 });
    }

    // ── Quota check ─────────────────────────────────────────────────────────────
    if (user.plan === "free") {
      if ((user.directTtsCount ?? 0) >= FREE_DIRECT_TTS_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan limit reached (${FREE_DIRECT_TTS_LIMIT} direct TTS). Upgrade to Pro for more.`,
            limitReached: true,
            type: "direct",
          },
          { status: 403 }
        );
      }
    } else if (user.plan === "pro" && isProDailyLimitReached(user, "direct")) {
      return NextResponse.json(
        {
          error: `Daily limit reached (${PRO_DAILY_DIRECT_TTS_LIMIT} direct TTS per day). Resets at midnight UTC.`,
          limitReached: true,
          type: "direct",
          dailyCount: getDailyCount(user, "direct"),
          dailyLimit: PRO_DAILY_DIRECT_TTS_LIMIT,
        },
        { status: 403 }
      );
    }

    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    const VOICE_GENDERS: Record<string, string> = {
      Kore: "female", Leda: "female", Aoede: "female", Callirrhoe: "female",
      Autonoe: "female", Despina: "female", Erinome: "female", Laomedeia: "female",
      Achernar: "female", Schedar: "female", Gacrux: "female", Pulcherrima: "female",
      Vindemiatrix: "female", Sulafat: "female",
      Puck: "male", Charon: "male", Fenrir: "male", Enceladus: "male",
      Iapetus: "male", Umbriel: "male", Algieba: "male", Algenib: "male",
      Rasalgethi: "male", Alnilam: "male", Achird: "male", Zubenelgenubi: "male",
      Sadachbia: "male", Sadaltager: "male",
    };
    const _gender = VOICE_GENDERS[voice] ?? "neutral";

    const attemptTTS = async (key: string, chunkedScript: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: chunkedScript,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        })
      );
    };

    let activeKey = userApiKey || serverApiKey;
    const scriptChunks = chunkText(script, 3000);
    const audioBuffers: Buffer[] = [];

    for (const chunk of scriptChunks) {
      let ttsResponse;
      try {
        ttsResponse = await attemptTTS(activeKey, chunk);
      } catch (err: any) {
        const msg = err?.message?.toLowerCase() || "";
        if (
          activeKey === userApiKey &&
          (msg.includes("denied access") ||
            msg.includes("permission_denied") ||
            msg.includes("api_key_invalid") ||
            msg.includes("quota") ||
            msg.includes("exceeded"))
        ) {
          console.warn("[TTS Fallback] User custom key failed. Falling back to server key.");
          activeKey = serverApiKey;
          ttsResponse = await attemptTTS(activeKey, chunk);
        } else {
          throw err;
        }
      }

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        return NextResponse.json(
          { error: "Failed to generate audio — no audio data returned from a chunk" },
          { status: 500 }
        );
      }
      audioBuffers.push(Buffer.from(audioData, "base64"));
    }

    // ── Record usage (daily + all-time) ──────────────────────────────────────────
    incrementUsage(user, "direct");
    await user.save();

    const pcmBuffer = Buffer.concat(audioBuffers);
    const wavBuffer = pcmToWav(pcmBuffer);

    return NextResponse.json({
      audioBase64: wavBuffer.toString("base64"),
      usage: {
        directTtsCount:      user.directTtsCount,
        dailyDirectTtsCount: getDailyCount(user, "direct"),
        dailyLimit:          PRO_DAILY_DIRECT_TTS_LIMIT,
        plan:                user.plan,
      },
    });
  } catch (err: any) {
    console.error("[TTS Error]", err);
    const code = err?.code ?? "UNKNOWN";
    const status = code === "OVERLOADED" ? 503 : code === "QUOTA_EXCEEDED" ? 429 : 500;
    return NextResponse.json(
      { error: err.message || "Something went wrong", code, retryAfter: err?.retryAfter },
      { status }
    );
  }
}
