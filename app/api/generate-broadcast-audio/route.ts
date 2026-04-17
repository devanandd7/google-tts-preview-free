import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_BROADCAST_LIMIT } from "@/lib/constants";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";

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
    const ADMIN_EMAILS = ["devanandutkarsh7@gail.com", "devanandutkarsh7@gmail.com"];
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

    if (user.plan === "free") {
      if (user.broadcastCount >= FREE_BROADCAST_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan limit reached (${FREE_BROADCAST_LIMIT} Broadcasts). Upgrade to Pro to get unlimited generations.`,
            limitReached: true,
            type: "broadcast",
          },
          { status: 403 }
        );
      }
    }

    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    // Parse the script into blocks: { voiceName, text }
    const blocks: { voiceName: string, text: string }[] = [];
    
    // Split the script by newlines or parse the [Voice:] pattern
    // The pattern requested was [Name: text content]
    const regex = /\[(.*?):\s*(.*?)\]/g;
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(script)) !== null) {
      const parsedVoiceName = match[1].trim();
      const text = match[2].trim();
      
      let actualVoiceName = voice1;
      if (parsedVoiceName.toLowerCase().includes(voice2.toLowerCase())) {
        actualVoiceName = voice2;
      } else if (parsedVoiceName.toLowerCase().includes(voice1.toLowerCase())) {
        actualVoiceName = voice1;
      } else {
        // Fallback default
        actualVoiceName = blocks.length % 2 === 0 ? voice1 : voice2;
      }
      
      if (text) {
        blocks.push({ voiceName: actualVoiceName, text });
      }
      lastIndex = regex.lastIndex;
    }

    // Fallback if parsing failed (e.g. LLM didn't format correctly)
    if (blocks.length === 0) {
      blocks.push({ voiceName: voice1, text: script });
    }

    const attemptTTS = async (key: string, voiceName: string, text: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: text,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        })
      );
    };

    let activeKey = userApiKey || serverApiKey;
    const audioBuffers: Buffer[] = [];

    // Loop through blocks sequentially.
    // In a prod system, we might parallelize this, but due to rate limits (and strict sequencing), we wait.
    for (const block of blocks) {
      let ttsResponse;
      try {
        ttsResponse = await attemptTTS(activeKey, block.voiceName, block.text);
      } catch (err: any) {
        const msg = err?.message?.toLowerCase() || "";
        if (activeKey === userApiKey && (msg.includes("denied access") || msg.includes("permission_denied") || msg.includes("api_key_invalid") || msg.includes("quota") || msg.includes("exceeded"))) {
          console.warn("[Broadcast Audio Fallback] User custom key failed. Falling back to server key.");
          activeKey = serverApiKey;
          ttsResponse = await attemptTTS(activeKey, block.voiceName, block.text);
        } else {
          throw err;
        }
      }

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        return NextResponse.json({ error: "Failed to generate audio — no audio data returned from a chunk" }, { status: 500 });
      }
      audioBuffers.push(Buffer.from(audioData, "base64"));
    }

    // Increment usage counter
    user.broadcastCount += 1;
    await user.save();

    const pcmBuffer = Buffer.concat(audioBuffers);
    const wavBuffer = pcmToWav(pcmBuffer);

    return NextResponse.json({
      audioBase64: wavBuffer.toString("base64"),
      usage: {
        broadcastCount: user.broadcastCount,
        plan: user.plan,
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
