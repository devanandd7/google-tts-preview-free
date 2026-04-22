import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// 1. Manually parse .env files (.env.local, .env, ../.env)
const potentialPaths = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", ".env")
];

for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
        const envFile = fs.readFileSync(p, "utf-8");
        envFile.split("\n").forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match && !process.env[match[1].trim()]) {
                process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const VOICES = [
    { name: "Kore", gender: "female" },
    { name: "Leda", gender: "female" },
    { name: "Aoede", gender: "female" },
    { name: "Callirrhoe", gender: "female" },
    { name: "Autonoe", gender: "female" },
    { name: "Despina", gender: "female" },
    { name: "Erinome", gender: "female" },
    { name: "Laomedeia", gender: "female" },
    { name: "Achernar", gender: "female" },
    { name: "Schedar", gender: "female" },
    { name: "Gacrux", gender: "female" },
    { name: "Pulcherrima", gender: "female" },
    { name: "Vindemiatrix", gender: "female" },
    { name: "Sulafat", gender: "female" },
    { name: "Puck", gender: "male" },
    { name: "Charon", gender: "male" },
    { name: "Fenrir", gender: "male" },
    { name: "Enceladus", gender: "male" },
    { name: "Iapetus", gender: "male" },
    { name: "Umbriel", gender: "male" },
    { name: "Algieba", gender: "male" },
    { name: "Algenib", gender: "male" },
    { name: "Rasalgethi", gender: "male" },
    { name: "Alnilam", gender: "male" },
    { name: "Achird", gender: "male" },
    { name: "Zubenelgenubi", gender: "male" },
    { name: "Sadachbia", gender: "male" },
    { name: "Sadaltager", gender: "male" },
];

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateSample(voiceName: string, gender: string, language: string) {
    const pubDir = path.join(process.cwd(), "public", "samples", language);
    if (!fs.existsSync(pubDir)) {
        fs.mkdirSync(pubDir, { recursive: true });
    }

    const outPath = path.join(pubDir, `${voiceName.toLowerCase()}.wav`);
    if (fs.existsSync(outPath)) {
        console.log(`[SKIP] ${language}/${voiceName} already exists.`);
        return;
    }

    let script = "";
    if (language === "english") {
        script = `Hi, I am ${voiceName}. Have a listen to my voice. I can bring your scripts and stories to life with real emotion.`;
    } else {
        const verb = gender === "female" ? "सकती हूँ" : "सकता हूँ";
        script = `नमस्ते, मेरा नाम ${voiceName} है। आप मेरी आवाज़ सुन रहे हैं। मैं आपकी स्क्रिप्ट और कहानियों को बड़ी आसानी से पढ़कर सुना ${verb}।`;
    }

    const lockedScript = `[VOICE OVERRIDE — STRICT: Use ONLY the prebuilt voice named "${voiceName}" (${gender}). Do NOT switch gender. Do NOT use any other voice. Render everything below as-is.]\n\n${script}`;

    console.log(`Generating ${language}/${voiceName}...`);
    try {
        const response = await ai.models.generateContent({
            model: process.env.TTS_AI_MODEL || "gemini-3.1-flash-tts-preview",
            contents: lockedScript,
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) {
            throw new Error("No audio data returned");
        }

        const pcmBuffer = Buffer.from(audioData, "base64");
        const wavBuffer = pcmToWav(pcmBuffer);

        fs.writeFileSync(outPath, wavBuffer);
        console.log(`[SUCCESS] Saved ${outPath}`);
    } catch (e: any) {
        console.error(`[ERROR] Failed to generate ${language}/${voiceName}: ${e.message}`);
        throw e;
    }
}

async function main() {
    console.log("Starting generation. Note: Gemini Free Tier TTS limit is 3 RPM. Expected time: ~19 minutes.");
    for (const v of VOICES) {
        // English
        while (true) {
            try {
                await generateSample(v.name, v.gender, "english");
                await sleep(21000); // 21s delay to enforce < 3 requests per minute
                break;
            } catch (err: any) {
                if (err?.message?.includes("429") || err?.message?.includes("503") || err?.message?.includes("quota") || err?.message?.includes("Resource has been exhausted")) {
                    console.log(`Rate limited on english/${v.name}. Sleeping for 30s...`);
                    await sleep(30000);
                } else {
                    console.error("Unknown error, moving to next voice.", err?.message);
                    break;
                }
            }
        }

        // Hindi
        while (true) {
            try {
                await generateSample(v.name, v.gender, "hindi");
                await sleep(21000);
                break;
            } catch (err: any) {
                if (err?.message?.includes("429") || err?.message?.includes("503") || err?.message?.includes("quota") || err?.message?.includes("Resource has been exhausted")) {
                    console.log(`Rate limited on hindi/${v.name}. Sleeping for 30s...`);
                    await sleep(30000);
                } else {
                    console.error("Unknown error, moving to next voice.", err?.message);
                    break;
                }
            }
        }
    }
    console.log("All audio samples generated completely!");
}

main();
