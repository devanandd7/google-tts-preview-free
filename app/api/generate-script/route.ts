import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_AI_SCRIPT_LIMIT } from "@/lib/constants";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";

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
      // Auto-expire -- treat as free for this request
      user.plan = "free";
      user.planStatus = "expired";
      await user.save();
    }

    const { prompt, language = "hindi", voice = "Kore", durationMinutes = 1 } = await req.json();

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
    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    const isHindi = language === "hindi";

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

    const langInstruction = isHindi
      ? `IMPORTANT: Write the TRANSCRIPT section in natural, conversational Hindi (Devanagari script). Mix in a few English words naturally where Indians commonly do (Hinglish style is fine). The Audio Profile, Scene, and Director's Notes sections can be in English, but the TRANSCRIPT must be in Hindi.\nCRITICAL RULE: The narrator is a ${gender}. You MUST write all Hindi verbs, adjectives, and pronouns from a strictly ${gender} perspective (e.g., if female, use 'मैं जाती हूँ', 'मैं खुश हूँ'; if male, use 'मैं जाता हूँ'). NEVER break this gender rule.`
      : `Write the TRANSCRIPT section in natural, fluent English. Determine the tone to perfectly match a strictly ${gender} narrator.`;

    const minWords = durationMinutes * 120;
    const maxWords = durationMinutes * 150;

    const attemptScriptGen = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
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
Write ${minWords}–${maxWords} words of spoken text to explicitly target an engaging, precise ${durationMinutes}-minute audio performance. Heavily use inline emotion and performance tags:
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
        })
      );
    };

    let response;
    try {
      response = await attemptScriptGen(userApiKey || serverApiKey);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      if (userApiKey && (msg.includes("denied access") || msg.includes("permission_denied") || msg.includes("api_key_invalid"))) {
        console.warn("[Script Gen Fallback] User custom key denied access. Falling back to server key.");
        response = await attemptScriptGen(serverApiKey);
      } else {
        throw err;
      }
    }

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
    const code = err?.code ?? "UNKNOWN";
    const status = code === "OVERLOADED" ? 503 : 500;
    return NextResponse.json(
      { error: err.message || "Something went wrong", code, retryAfter: err?.retryAfter },
      { status }
    );
  }
}
