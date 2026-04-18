import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";

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

// ─── Text Chunker (max chars per chunk) ──────────────────────────────────────
function chunkText(text: string, maxLen: number = 2500): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  // Split on sentence boundaries first
  const sentences = text.match(/[^.!?।]+[.!?।]*/g) || [text];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      // If a single sentence exceeds maxLen, hard-split it
      if (sentence.length > maxLen) {
        let remaining = sentence;
        while (remaining.length > maxLen) {
          chunks.push(remaining.slice(0, maxLen).trim());
          remaining = remaining.slice(maxLen);
        }
        current = remaining;
      } else {
        current = sentence;
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

// ─── Robust Script Line Parser ────────────────────────────────────────────────
// Parses lines like: [VoiceName: spoken text here]
// Uses first-colon-only split to avoid breaking on colons in text
function parseBroadcastScript(
  script: string,
  voice1: string,
  voice2: string
): { voiceName: string; text: string }[] {
  const blocks: { voiceName: string; text: string }[] = [];

  for (const rawLine of script.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("[")) continue;

    // Find FIRST colon — everything before is the name, after is text
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const rawName = line.slice(1, colonIdx).trim();

    // Guard: expression tags like [laughs: ha ha] could appear if LLM formats them oddly.
    // Only skip lines where the "name" before colon is clearly NOT a speaker voice name.
    const EXPRESSION_TAGS = ["laughs","chuckles","nervous laugh","excitedly","softly",
      "nervously","sighs","surprised","seriously","warmly","sadly","angrily","proudly",
      "slowly","quickly","whispers"];
    const isExpressionTag = EXPRESSION_TAGS.some(tag =>
      rawName.toLowerCase() === tag
    );
    if (isExpressionTag) continue; // Skip — not a speaker line

    // Remove trailing ] and any surrounding whitespace from the text
    const rawText = line
      .slice(colonIdx + 1)
      .replace(/\]\s*$/, "")
      .trim();

    if (!rawText) continue;

    // Match speaker to voice1 or voice2 (case-insensitive partial match)
    const isVoice2 = rawName.toLowerCase().includes(voice2.toLowerCase());
    const isVoice1 = rawName.toLowerCase().includes(voice1.toLowerCase());
    let voiceName: string;

    if (isVoice2 && !isVoice1) {
      voiceName = voice2;
    } else if (isVoice1) {
      voiceName = voice1;
    } else {
      // Fallback: alternate based on position
      voiceName = blocks.length % 2 === 0 ? voice1 : voice2;
    }

    // Sub-chunk each dialogue line to stay within TTS safe limits (2500 chars)
    const subChunks = chunkText(rawText, 2500);
    for (const chunk of subChunks) {
      blocks.push({ voiceName, text: chunk });
    }
  }

  // Fallback if parsing produced nothing
  if (blocks.length === 0) {
    console.warn("[Broadcast] Script parsing produced 0 blocks — sending full script to voice1");
    const fallbackChunks = chunkText(script, 2500);
    for (const chunk of fallbackChunks) {
      blocks.push({ voiceName: voice1, text: chunk });
    }
  }

  return blocks;
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

    // STRICT LIMIT: Max 1 broadcast generation per user to save tokens,
    // UNLESS the user is a Pro user utilizing their own custom API key.
    if (user.broadcastCount >= 1 && !(user.plan === "pro" && user.ownApiKey)) {
      return NextResponse.json(
        { error: "Broadcast limit reached. You can only generate 1 broadcast. Please add your own API key in Pro Settings to generate more." },
        { status: 403 }
      );
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

    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    // ── Parse the script into per-speaker blocks with chunking ────────────────
    const blocks = parseBroadcastScript(script, voice1, voice2);
    console.log(`[Broadcast Audio] Parsed ${blocks.length} blocks from script`);

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

    // Process each block sequentially (rate limit safe)
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      console.log(`[Broadcast Audio] Block ${i + 1}/${blocks.length} — voice: ${block.voiceName}, chars: ${block.text.length}`);

      let ttsResponse;
      try {
        // Direct call using the active key. No fallback!
        ttsResponse = await attemptTTS(activeKey, block.voiceName, block.text);
      } catch (err: any) {
        throw err;
      }

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        return NextResponse.json(
          { error: `No audio data returned for block ${i + 1} (voice: ${block.voiceName})` },
          { status: 500 }
        );
      }
      audioBuffers.push(Buffer.from(audioData, "base64"));
    }

    // Concat all raw PCM buffers and build a single WAV
    const pcmBuffer = Buffer.concat(audioBuffers);
    const wavBuffer = pcmToWav(pcmBuffer);

    // broadcastCount was already incremented in the script generation route.
    // We only track it once per script/audio pair to avoid double-counting.
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
