import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

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
    const { script, voice = "Kore" } = await req.json();

    if (!script?.trim()) {
      return NextResponse.json({ error: "Missing script" }, { status: 400 });
    }

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

    // Prepend a strict voice-lock instruction so Gemini does NOT override the voice
    const lockedScript = `[VOICE OVERRIDE — STRICT: Use ONLY the prebuilt voice named "${voice}" (${gender}). Do NOT switch gender. Do NOT use any other voice. Render everything below as-is.]\n\n${script}`;

    const ttsResponse = await ai.models.generateContent({
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
    });

    const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      return NextResponse.json({ error: "Failed to generate audio — no audio data returned" }, { status: 500 });
    }

    const pcmBuffer = Buffer.from(audioData, "base64");
    const wavBuffer = pcmToWav(pcmBuffer);

    return NextResponse.json({ audioBase64: wavBuffer.toString("base64") });
  } catch (err: any) {
    console.error("[TTS Error]", err);
    return NextResponse.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}
