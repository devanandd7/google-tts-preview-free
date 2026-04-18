import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import { PRO_DAILY_BROADCAST_LIMIT } from "@/lib/constants";

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

// ─── Fallback: Batch by Speaker ───────────────────────────────────────────────
function groupBySpeaker(
  script: string,
  voice1: string,
  voice2: string
): { v1Lines: { idx: number; text: string }[]; v2Lines: { idx: number; text: string }[] } {
  const v1Lines: { idx: number; text: string }[] = [];
  const v2Lines: { idx: number; text: string }[] = [];
  let idx = 0;

  for (const rawLine of script.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("[")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const rawName = line.slice(1, colonIdx).trim();
    const isV2 = rawName.toLowerCase().includes(voice2.toLowerCase());
    const isV1 = rawName.toLowerCase().includes(voice1.toLowerCase());

    if (!isV1 && !isV2) continue;

    const text = line.slice(colonIdx + 1).replace(/\]\s*$/, "").trim();
    if (!text) continue;

    if (isV2 && !isV1) {
      v2Lines.push({ idx, text });
    } else {
      v1Lines.push({ idx, text });
    }
    idx++;
  }

  return { v1Lines, v2Lines };
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

    // STRICT PRO ONLY GATE
    if (user.plan !== "pro") {
      return NextResponse.json(
        {
          error: "AI Broadcast features are available for PRO plan users only.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // NOTE: The broadcast count and daily limit were already enforced and
    // incremented in generate-broadcast-script. This route only converts the
    // already-generated script to audio — no additional quota deducted here.

    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const activeKey = userApiKey || process.env.GEMINI_API_KEY!;
    const ai = new GoogleGenAI({ apiKey: activeKey });

    // ── STRATEGY 1: Multi-Speaker TTS (1 API request) ────────────────────────
    const cleanedScript = cleanScriptForMultiSpeaker(script, voice1, voice2);
    console.log(`[Broadcast Audio] Attempting Multi-Speaker TTS — script length: ${cleanedScript.length} chars`);

    let audioBase64: string | null = null;

    try {
      const multiSpeakerResponse = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: cleanedScript,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: voice1,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voice1 },
                    },
                  },
                  {
                    speaker: voice2,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voice2 },
                    },
                  },
                ],
              },
            },
          },
        })
      );

      const rawAudio = multiSpeakerResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (rawAudio) {
        console.log("[Broadcast Audio] ✅ Multi-Speaker TTS succeeded — 1 request used.");
        const pcmBuffer = Buffer.from(rawAudio, "base64");
        const wavBuffer = pcmToWav(pcmBuffer);
        audioBase64 = wavBuffer.toString("base64");
      } else {
        console.warn("[Broadcast Audio] Multi-Speaker returned no audio data — activating fallback.");
      }
    } catch (multiErr: any) {
      console.warn(`[Broadcast Audio] Multi-Speaker TTS failed (${multiErr?.message}) — activating fallback.`);
    }

    // ── STRATEGY 2: Fallback — Batch by Speaker (2 API requests) ─────────────
    if (!audioBase64) {
      console.log("[Broadcast Audio] Running 2-request batch fallback...");

      const { v1Lines, v2Lines } = groupBySpeaker(script, voice1, voice2);

      if (v1Lines.length === 0 && v2Lines.length === 0) {
        return NextResponse.json({ error: "Could not parse any dialogue from the script." }, { status: 500 });
      }

      const makeBatchRequest = async (voiceName: string, lines: { idx: number; text: string }[]) => {
        if (lines.length === 0) return [];
        const batchText = lines.map((l) => l.text).join("\n[pause]\n");
        const response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: batchText,
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
        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return data ? [Buffer.from(data, "base64")] : [];
      };

      const [v1Buffers, v2Buffers] = await Promise.all([
        makeBatchRequest(voice1, v1Lines),
        makeBatchRequest(voice2, v2Lines),
      ]);

      const allBuffers = [...v1Buffers, ...v2Buffers];
      if (allBuffers.length === 0) {
        return NextResponse.json({ error: "Both TTS strategies failed to return audio." }, { status: 500 });
      }

      console.log(`[Broadcast Audio] ✅ Batch fallback succeeded — ${allBuffers.length === 2 ? "2 requests" : "1 request"} used.`);

      const pcmBuffer = Buffer.concat(allBuffers);
      const wavBuffer = pcmToWav(pcmBuffer);
      audioBase64 = wavBuffer.toString("base64");
    }

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
