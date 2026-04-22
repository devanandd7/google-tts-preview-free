import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_AI_SCRIPT_LIMIT, PRO_DAILY_AI_SCRIPT_LIMIT } from "@/lib/constants";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import {
  resetDailyIfNeeded,
  isProDailyLimitReached,
  getDailyCount,
  incrementUsage,
} from "@/lib/usage";
import { VOICE_MAPPING, VOICE_GENDERS } from "@/lib/voices";

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

    // Reset daily counters if UTC date changed
    resetDailyIfNeeded(user);

    const { prompt, language = "hindi", voice = "Sunidhi", durationMinutes = 1 } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // ── Quota check (Bypass for Admin) ──────────────────────────────────────────
    if (isAdmin) {
      // Admin has no limits
    } else if (user.plan === "free") {
      if ((user.aiScriptCount ?? 0) >= FREE_AI_SCRIPT_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan limit reached (${FREE_AI_SCRIPT_LIMIT} AI script generations). Upgrade to Pro for more.`,
            limitReached: true,
            type: "ai",
          },
          { status: 403 }
        );
      }
    } else if (user.plan === "pro" && isProDailyLimitReached(user, "aiScript")) {
      return NextResponse.json(
        {
          error: `Daily limit reached (${PRO_DAILY_AI_SCRIPT_LIMIT} AI script generations per day). Resets at midnight UTC.`,
          limitReached: true,
          type: "ai",
          dailyCount: getDailyCount(user, "aiScript"),
          dailyLimit: PRO_DAILY_AI_SCRIPT_LIMIT,
        },
        { status: 403 }
      );
    }

    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    const isHindi = language === "hindi";

    const gender = VOICE_GENDERS[voice] ?? "neutral";
    const geminiVoiceName = VOICE_MAPPING[voice] || voice;

    const langInstruction = isHindi
      ? `IMPORTANT: Write the TRANSCRIPT section in natural, conversational Hindi (Devanagari script). Mix in a few English words naturally where Indians commonly do (Hinglish style is fine). The Audio Profile, Scene, and Director's Notes sections can be in English, but the TRANSCRIPT must be in Hindi.\nCRITICAL RULE: The narrator is a ${gender}. You MUST write all Hindi verbs, adjectives, and pronouns from a strictly ${gender} perspective (e.g., if female, use 'मैं जाती हूँ', 'मैं खुश हूँ'; if male, use 'मैं जाता हूँ'). NEVER break this gender rule.`
      : `Write the TRANSCRIPT section in natural, fluent English. Determine the tone to perfectly match a strictly ${gender} narrator.`;

    const minWords = durationMinutes * 120;
    const maxWords = durationMinutes * 150;

    const attemptScriptGen = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are a master TTS script director for Google Gemini's native audio model. Your scripts are vivid, emotionally rich, and highly performable.

Given a user's idea, generate a fully-formed, emotionally expressive TTS director-style script with ALL of these sections:

**# AUDIO PROFILE**
Name: ${voice}. Role: Warm Storyteller / Character role based on the idea. Define their personality, age, and speaking style briefly.
CRITICAL: The narrator MUST introduce themselves as "${voice}" or refer to themselves by this name within the script naturally (e.g., "Namaste, main hoon ${voice}..." or "Hi, I'm ${voice}...").

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
      const isKeyError = 
        err.code === "QUOTA_EXCEEDED" || 
        err.code === "INVALID_KEY" || 
        err.code === "OVERLOADED" ||
        msg.includes("denied access") ||
        msg.includes("permission_denied") ||
        msg.includes("api_key_invalid") ||
        msg.includes("quota") ||
        msg.includes("exceeded") ||
        msg.includes("invalid");

      if (userApiKey && isKeyError && user.plan !== "pro") {
        console.warn("[Script Gen Fallback] User custom key failed. Falling back to server key.");
        response = await attemptScriptGen(serverApiKey);
      } else {
        throw err;
      }
    }

    const script = response.text;
    if (!script) {
      return NextResponse.json({ error: "Failed to generate script" }, { status: 500 });
    }

    // ── Record usage (daily + all-time, both free and pro) ───────────────────────
    incrementUsage(user, "aiScript");
    await user.save();

    return NextResponse.json({
      script,
      tokenUsage: response?.usageMetadata?.totalTokenCount || 0,
      usage: {
        aiScriptCount:      user.aiScriptCount,
        dailyAiScriptCount: getDailyCount(user, "aiScript"),
        dailyLimit:         PRO_DAILY_AI_SCRIPT_LIMIT,
        plan:               user.plan,
      },
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
