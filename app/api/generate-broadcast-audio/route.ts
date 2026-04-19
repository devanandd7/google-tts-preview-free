import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import { PRO_DAILY_BROADCAST_LIMIT } from "@/lib/constants";
import { VOICE_MAPPING } from "@/lib/voices";

// ─── WAV Header Builder ───────────────────────────────────────────────────────
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

// ─── Script Cleaner ───────────────────────────────────────────────────────────
function cleanScriptForMultiSpeaker(script: string, voice1: string, voice2: string): string {
  const lines: string[] = [];

  for (const rawLine of script.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("[")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const rawName = line.slice(1, colonIdx).trim();
    const isV2 = rawName.toLowerCase().includes(voice2.toLowerCase());
    const isV1 = rawName.toLowerCase().includes(voice1.toLowerCase());
    const speaker = isV2 && !isV1 ? voice2 : isV1 ? voice1 : null;

    if (!speaker) continue;

    let text = line
      .slice(colonIdx + 1)
      .replace(/\]\s*$/, "")
      .trim();
    text = text.replace(/\s{2,}/g, " ").trim();
    if (!text) continue;

    lines.push(`${speaker}: ${text}`);
  }

  if (lines.length === 0) {
    console.warn("[Broadcast] cleanScript produced 0 lines — using raw script as fallback");
    return script;
  }

  return lines.join("\n");
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

    const { script, voice1, voice2 } = await req.json();

    if (!script?.trim() || !voice1 || !voice2) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // STRICT PRO ONLY GATE (Bypass for Admin)
    if (!isAdmin && user.plan !== "pro") {
      return NextResponse.json(
        {
          error: "AI Broadcast features are available for PRO plan users only.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;
    
    let activeKey = userApiKey || serverApiKey;

    const geminiVoice1 = VOICE_MAPPING[voice1] || voice1;
    const geminiVoice2 = VOICE_MAPPING[voice2] || voice2;

    const cleanedScript = cleanScriptForMultiSpeaker(script, voice1, voice2);
    
    // Split into chunks by lines to preserve [Voice: Text] format per line
    const scriptChunks: string[] = [];
    let currentChunk = "";
    for (const line of cleanedScript.split("\n")) {
      // Chunk at ~3000 chars to avoid hitting model input limits safely
      if ((currentChunk + "\n" + line).length > 3000) {
        if (currentChunk) scriptChunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }
    if (currentChunk) scriptChunks.push(currentChunk.trim());

    if (scriptChunks.length === 0) {
      return NextResponse.json({ error: "Could not parse any dialogue from the script." }, { status: 400 });
    }

    console.log(`[Broadcast Audio] Script split into ${scriptChunks.length} chunk(s) for 3.1 Flash TTS.`);

    const audioBuffers: Buffer[] = [];

    const attemptMultiSpeakerTTS = async (key: string, chunkedScript: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: chunkedScript,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: voice1,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: geminiVoice1 },
                    },
                  },
                  {
                    speaker: voice2,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: geminiVoice2 },
                    },
                  },
                ],
              },
            },
          },
        })
      );
    };

    for (let i = 0; i < scriptChunks.length; i++) {
      const chunk = scriptChunks[i];
      let ttsResponse;
      try {
        ttsResponse = await attemptMultiSpeakerTTS(activeKey, chunk);
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
          console.warn(`[Broadcast Audio] Chunk ${i+1}: User key failed, falling back to server key.`);
          activeKey = serverApiKey;
          ttsResponse = await attemptMultiSpeakerTTS(activeKey, chunk);
        } else {
          throw err;
        }
      }

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        throw new Error(`Failed to generate audio for chunk ${i+1}`);
      }
      audioBuffers.push(Buffer.from(audioData, "base64"));
    }

    console.log(`[Broadcast Audio] Successfully stitched ${audioBuffers.length} audio chunks.`);

    const pcmBuffer = Buffer.concat(audioBuffers);
    const wavBuffer = pcmToWav(pcmBuffer);
    const audioBase64 = wavBuffer.toString("base64");

    return NextResponse.json({
      audioBase64,
      usage: {
        broadcastCount:      user.broadcastCount      ?? 0,
        dailyBroadcastCount: user.dailyBroadcastCount ?? 0,
        dailyLimit:          PRO_DAILY_BROADCAST_LIMIT,
        plan:                user.plan,
      },
    });
  } catch (err: any) {
    console.error("[Broadcast Audio Error]", err);
    const code = err?.code ?? "UNKNOWN";
    const status = code === "OVERLOADED" ? 503 : code === "QUOTA_EXCEEDED" ? 429 : 500;
    return NextResponse.json(
      { error: err.message || "Something went wrong", code, retryAfter: err?.retryAfter },
      { status }
    );
  }
}
