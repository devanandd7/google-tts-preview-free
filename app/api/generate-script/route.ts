import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_AI_SCRIPT_LIMIT } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    let user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      // Auto-create user record and assign "pro" directly if email matches admin
      const email =
        (sessionClaims?.email as string) ||
        (sessionClaims?.primaryEmail as string) ||
        "";
      const isAdmin = email === "devanandutkarsh7@gail.com" || email === "devanandutkarsh7@gmail.com";
      user = await User.create({ clerkId: userId, email, plan: isAdmin ? "pro" : "free" });
    } else {
       // Just in case existing user logs in and is admin, force plan to pro
       const email =
        (sessionClaims?.email as string) ||
        (sessionClaims?.primaryEmail as string) ||
        user.email || "";
       const isAdmin = email === "devanandutkarsh7@gail.com" || email === "devanandutkarsh7@gmail.com";
       if (isAdmin && user.plan !== "pro") {
         user.plan = "pro";
         await user.save();
       }
    }

    const { prompt, language = "hindi" } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

     // ── Enforce limits ──
     if (user.plan === "free") {
        if (user.aiScriptCount >= FREE_AI_SCRIPT_LIMIT) {
          return NextResponse.json(
            {
              error: `Free plan limit reached (${FREE_AI_SCRIPT_LIMIT} AI script generations). Upgrade to Pro to get unlimited generations.`,
              limitReached: true,
              type: "ai",
            },
            { status: 403 }
          );
        }
      }

    // Determine which API key to use
    const apiKey =
      user.plan === "pro" && user.ownApiKey
        ? user.ownApiKey
        : process.env.GEMINI_API_KEY!;

    const ai = new GoogleGenAI({ apiKey });

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

    // Increment usage counter for free users
    if (user.plan === "free") {
      user.aiScriptCount += 1;
      await user.save();
    }

    return NextResponse.json({ 
        script,
        usage: {
            aiScriptCount: user.aiScriptCount,
            plan: user.plan
        }
    });

  } catch (err: any) {
    console.error("[Script Gen Error]", err);
    return NextResponse.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}
