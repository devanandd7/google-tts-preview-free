import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_DIRECT_TTS_LIMIT } from "@/lib/constants";
import { withGeminiRetry } from "@/lib/gemini";

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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    let user = await User.findOne({ clerkId: userId });
    
    // Check if user is admin
    const email = (user && user.email) ? user.email : "";
    const authSession = await auth();
    const sessionClaims = authSession.sessionClaims;
    const currentEmail = email || (sessionClaims?.email as string) || (sessionClaims?.primaryEmail as string) || "";
    const isAdmin = currentEmail === "devanandutkarsh7@gail.com" || currentEmail === "devanandutkarsh7@gmail.com";

    if (!user) {
      user = await User.create({ clerkId: userId, email: currentEmail, plan: isAdmin ? "pro" : "free" });
    } else if (isAdmin && user.plan !== "pro") {
      user.plan = "pro";
      await user.save();
    }

    const { script, voice = "Kore" } = await req.json();

    if (!script?.trim()) {
      return NextResponse.json({ error: "Missing script" }, { status: 400 });
    }

    // ── Enforce limits ──
    if (user.plan === "free") {
      if (user.directTtsCount >= FREE_DIRECT_TTS_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan limit reached (${FREE_DIRECT_TTS_LIMIT} direct TTS generations). Upgrade to Pro to get unlimited generations.`,
            limitReached: true,
            type: "direct",
          },
          { status: 403 }
        );
      }
    } else {
      // Pro user: use their own API key if set, otherwise fall back to server key
      // (Pro users generate until their key is exhausted)
    }

    // Determine which API key to use
    const apiKey =
      user.plan === "pro" && user.ownApiKey
        ? user.ownApiKey
        : process.env.GEMINI_API_KEY!;

    const ai = new GoogleGenAI({ apiKey });

    // Lookup gender of selected voice to lock it in the prompt
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
    const gender = VOICE_GENDERS[voice] ?? "neutral";

    const lockedScript = `[VOICE OVERRIDE — STRICT: Use ONLY the prebuilt voice named "${voice}" (${gender}). Do NOT switch gender. Do NOT use any other voice. Render everything below as-is.]\n\n${script}`;

    const ttsResponse = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: lockedScript,
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

    const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      return NextResponse.json({ error: "Failed to generate audio — no audio data returned" }, { status: 500 });
    }

    // Increment usage counter for free users
    if (user.plan === "free") {
      user.directTtsCount += 1;
      await user.save();
    }

    const pcmBuffer = Buffer.from(audioData, "base64");
    const wavBuffer = pcmToWav(pcmBuffer);

    return NextResponse.json({
      audioBase64: wavBuffer.toString("base64"),
      usage: {
        directTtsCount: user.directTtsCount,
        plan: user.plan,
      },
    });
  } catch (err: any) {
    console.error("[TTS Error]", err);
    const code = err?.code ?? "UNKNOWN";
    const status = code === "OVERLOADED" ? 503 : 500;
    return NextResponse.json(
      { error: err.message || "Something went wrong", code, retryAfter: err?.retryAfter },
      { status }
    );
  }
}
