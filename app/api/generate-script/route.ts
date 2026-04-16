import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

export async function POST(req: Request) {
  try {
    const { prompt, language = "hindi" } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const isHindi = language === "hindi";

    const langInstruction = isHindi
      ? `IMPORTANT: Write the TRANSCRIPT section in natural, conversational Hindi (Devanagari script). Mix in a few English words naturally where Indians commonly do (Hinglish style is fine). The Audio Profile, Scene, and Director's Notes sections can be in English, but the TRANSCRIPT must be in Hindi.`
      : `Write the TRANSCRIPT section in natural, fluent English.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a master TTS script director for Google Gemini's native audio model. Your scripts are vivid, emotionally rich, and highly performable.

Given a user's idea, generate a fully-formed, emotionally expressive TTS director-style script with ALL of these sections:

**# AUDIO PROFILE**
Give the narrator/character a name and role (e.g., "Rajesh — Warm Storyteller / Fatherly Figure"). Define their personality, age, and speaking style briefly.

**## THE SCENE**  
Describe the physical environment, time of day, mood, and emotional atmosphere in 2–3 vivid sentences. This sets the stage for the performance.

**### DIRECTOR'S NOTES**  
- **Style:** (e.g., Conversational, nostalgic, theatrical, suspenseful)
- **Pace:** (e.g., Slow with dramatic pauses, energetic, measured)
- **Accent:** (e.g., Warm baritone, London street accent, neutral American)

**#### TRANSCRIPT**  
Write 80–120 words of spoken text. Heavily use inline emotion and performance tags:
- [pause] — silence for dramatic effect
- [whispers] — spoken very softly, intimately
- [shouting] — raised, emotional voice
- [excitedly] — energized delivery
- [laughs] — brief laugh in the middle of speech
- [sighs] — audible exhale, emotional
- [softly] — gentle, tender tone
- [slowly] — drawn out delivery

Match the emotional journey of the user's idea. Use contrasting emotions (e.g., joy then sadness then resolve). The transcript should feel like a real human performance, not a reading.

${langInstruction}

User's idea: ${prompt}

Return ONLY the formatted script. No commentary, no explanations.`,
    });

    const script = response.text;

    if (!script) {
      return NextResponse.json({ error: "Failed to generate script" }, { status: 500 });
    }

    return NextResponse.json({ script });
  } catch (err: any) {
    console.error("[Script Gen Error]", err);
    return NextResponse.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}

