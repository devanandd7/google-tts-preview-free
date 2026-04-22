import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import { PRO_DAILY_BROADCAST_LIMIT, TTS_AI_MODEL } from "@/lib/constants";
import { VOICE_MAPPING } from "@/lib/voices";
import { uploadToDrive } from "@/lib/google-drive";
import { getTimeContext } from "@/lib/time-context";

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
  // Updated Regex: Handles [Name: text], [Name-Emotion: text], and simple Name: text
  // Supports Devanagari and Latin names
  const pattern = /(?:^|[\r\n])\s*\[?([\w\s\u0900-\u097F]+)(?:-[^:\]]+)?[:\]]\s*([\s\S]*?)(?=\s*[\r\n]\s*\[?[\w\s\u0900-\u097F]+(?:-[^:\]]+)?[:\]]|$)/g;

  let match;
  while ((match = pattern.exec(script)) !== null) {
    const rawName = match[1].trim();
    let text = match[2].trim();

    const isV1 = rawName.toLowerCase().includes(voice1.toLowerCase());
    const isV2 = rawName.toLowerCase().includes(voice2.toLowerCase());

    // Priority to exact match or inclusion
    const speaker = isV1 ? voice1 : (isV2 ? voice2 : null);

    if (!speaker) continue;

    // Clean up trailing brackets and extra spaces
    text = text.replace(/\]\s*$/, "").trim();
    text = text.replace(/\s{2,}/g, " ").trim();

    if (text) {
      lines.push(`${speaker}: ${text}`);
    }
  }

  if (lines.length === 0) {
    console.warn("[Broadcast Audio] Regex parser produced 0 lines — falling back to basic split");
    return script.split("\n")
      .filter(l => l.includes(":"))
      .map(l => l.replace(/^\[/, "").replace(/\]$/, "").trim())
      .join("\n");
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

    const { 
      script, 
      voice1, 
      voice2,
      useTimeContext = false,
      timezoneOffset = 330 // Default IST
    } = await req.json();

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

    console.log(`[Broadcast Audio] Generating full broadcast audio without chunking.`);

    const callGeminiTTS = async (key: string, fullScript: string) => {
      const ai = new GoogleGenAI({ apiKey: key });

      let systemInstruction = `You are directing a high-energy professional FM radio broadcast. 
Two RJ hosts are live on air — maintain consistent vocal energy, natural pacing, and distinct character voices throughout.

All inline tags like [enthusiasm] or [laughs] are official Gemini TTS audio direction tags — they control vocal delivery automatically. Never speak them aloud.`;

      if (useTimeContext) {
        const timeCtx = getTimeContext(timezoneOffset);
        systemInstruction = `You are directing a professional FM radio broadcast.
Current time period: ${timeCtx.period.toUpperCase()}

${timeCtx.systemTone}

Maintain this tone consistently across the entire broadcast.
All inline tags like [enthusiasm] or [laughs] are official Gemini TTS 
audio direction tags — they control vocal delivery automatically. 
Never speak them aloud.`;
      }

      return await withGeminiRetry(() =>
        (ai as any).models.generateContent({
          model: TTS_AI_MODEL,
          system_instruction: systemInstruction,
          contents: fullScript,
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

    let ttsResponse;
    let attempts = 0;
    const maxAttempts = 2; // 1 initial + 1 retry

    while (attempts < maxAttempts) {
      try {
        attempts++;
        ttsResponse = await callGeminiTTS(activeKey, cleanedScript);
        break; // Success!
      } catch (err: any) {
        console.error(`[Broadcast Audio] Attempt ${attempts} failed:`, err.message);

        if (attempts < maxAttempts) {
          console.log("[Broadcast Audio] Retrying in 2 seconds...");
          await new Promise(resolve => setTimeout(resolve, 2000));

          // If first attempt with user key failed, try fallback on retry if applicable
          if (activeKey === userApiKey && user.plan !== "pro") {
            activeKey = serverApiKey;
          }
        } else {
          throw err; // Final attempt failed
        }
      }
    }

    const audioData = (ttsResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error(`Failed to generate audio after ${attempts} attempts.`);
    }

    const wavBuffer = pcmToWav(Buffer.from(audioData, "base64"));
    const audioBase64 = wavBuffer.toString("base64");

    // ── Google Drive Auto-Backup ────────────────────────────────────────────────
    let driveUploadStatus = "none";
    let driveFileLink = null;

    if ((user.ownDriveKey || user.driveRefreshToken) && user.driveEnabled !== false && user.driveToggles?.broadcast !== false) {
      try {
        const jsonKey = user.ownDriveKey ? decrypt(user.ownDriveKey) : undefined;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `GenBox_Broadcast_${voice1}_${voice2}_${timestamp}.wav`;

        const driveResult = await uploadToDrive(jsonKey, wavBuffer, fileName, "audio/wav", user.driveFolderId, user.driveRefreshToken);
        driveUploadStatus = "success";
        driveFileLink = driveResult.webViewLink;

        if (driveResult.detectedFolderId && !user.driveFolderId) {
          user.driveFolderId = driveResult.detectedFolderId;
          await user.save();
        }
        console.log(`[Drive Upload] Success: ${fileName}`);
      } catch (error) {
        console.error("[Drive Upload Error]", error);
        driveUploadStatus = "failed";
      }
    }

    return NextResponse.json({
      audioBase64,
      driveUploadStatus,
      driveFileLink,
      usage: {
        broadcastCount: user.broadcastCount ?? 0,
        dailyBroadcastCount: user.dailyBroadcastCount ?? 0,
        dailyLimit: PRO_DAILY_BROADCAST_LIMIT,
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
