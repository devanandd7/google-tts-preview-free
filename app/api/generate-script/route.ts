import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a professional TTS script writer for Google Gemini's native audio generation model.

Given a user's topic or idea, generate a fully-formed TTS director-style prompt that includes:

1. **# AUDIO PROFILE** – Give the character a name and define their archetype (Radio DJ, News Anchor, Storyteller, etc.)
2. **## THE SCENE** – Describe the physical environment and emotional vibe in 2–3 sentences.
3. **### DIRECTOR'S NOTES** – Specific performance guidance: Style, Pace, Accent (all labeled separately).
4. **#### TRANSCRIPT** – The actual spoken text (60–100 words). Use inline audio tags like [whispers], [excitedly], [shouting], [laughs], [pause] where appropriate to add expressive performance.

Format it clearly with the markdown headings above. Be creative and match the tone of the user's idea.

User's idea: ${prompt}

Return ONLY the script, no extra commentary.`,
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
