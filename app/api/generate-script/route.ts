import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_AI_SCRIPT_LIMIT, PRO_DAILY_AI_SCRIPT_LIMIT, TEXT_AI_MODEL } from "@/lib/constants";
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
          model: TEXT_AI_MODEL,
          contents: `You are a master TTS script director for Google Gemini 3.1 Flash TTS. 
Your scripts are natural, emotionally grounded, and professionally performable. 
Avoid melodrama — aim for authentic human conversation.

Given a user's idea, generate a complete TTS director-style script:

**# AUDIO PROFILE**
Name: ${voice}. Define personality, age, speaking style based on the idea.
CRITICAL: ${voice} must introduce themselves naturally in the first few lines.

**## THE SCENE**
2 brief sentences: physical environment, mood, emotional atmosphere.

**### DIRECTOR'S NOTES**
- Style: (e.g., Warm conversational, professional, thoughtful storytelling)
- Pace: (e.g., Steady, unhurried, measured)
- Tone: (e.g., Grounded, calm, authoritative but friendly)

**#### TRANSCRIPT**
Write ${minWords}–${maxWords} words targeting a ${durationMinutes}-minute performance.

Use ONLY these officially supported Gemini 3.1 Flash TTS inline tags:

PAUSE TAGS (for pacing):
- [short pause] — brief breath or hesitation
- [pause] — 1-second silence for natural pacing  
- [long pause] — longer dramatic silence

EXPRESSIVE TAGS (for emotion — use sparingly, max 1 per 3 sentences):
- [positive] — warm, welcoming delivery
- [neutral] — calm, steady, relaxed tone
- [curiosity] — thoughtful, slightly wondering
- [interest] — engaged, focused delivery
- [hope] — gentle optimism in voice
- [amusement] — light, warm humor (NOT over-laughing)
- [determination] — grounded, confident emphasis
- [sighs] — soft natural exhale
- [laughs] — brief, genuine laugh mid-speech
- [whispers] — intimate, soft delivery
- [slow] — draw out for emotional weight
- [fast] — slightly quicken pace for energy

CRITICAL TAG RULES (follow strictly or audio breaks):
1. NEVER place two tags directly next to each other — always text between them
2. Maximum 1 tag per 3 sentences — emotion comes from word choice, not tags
3. Tags are in English only, even if script is in Hindi/other language
4. Wrong: [positive][pause] — Right: [positive] Aaj ki baat suniye. [pause]

Emotional arc: Subtle and real. No dramatic highs/lows. 
Feel like a real human speaking — not a voice performance demo.

${langInstruction}
User's idea: ${prompt}

Return ONLY the formatted script. No commentary, no explanations.`
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
        aiScriptCount: user.aiScriptCount,
        dailyAiScriptCount: getDailyCount(user, "aiScript"),
        dailyLimit: PRO_DAILY_AI_SCRIPT_LIMIT,
        plan: user.plan,
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
