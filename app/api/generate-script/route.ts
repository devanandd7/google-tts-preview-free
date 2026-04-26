import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getTagsString, ALLOWED_TTS_TAGS } from "@/lib/tts-tags";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import {
  FREE_AI_SCRIPT_LIMIT,
  PRO_DAILY_AI_SCRIPT_LIMIT,
  TEXT_AI_MODEL,
} from "@/lib/constants";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import {
  resetDailyIfNeeded,
  isProDailyLimitReached,
  getDailyCount,
  incrementUsage,
} from "@/lib/usage";
import { VOICE_MAPPING, VOICE_GENDERS } from "@/lib/voices";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = [
  "devanandutkarsh7@gail.com",
  "devanandutkarsh7@gmail.com",
];

// Gemini TTS: prompt field hard limit.
// Total output must fit within this limit.
const PROMPT_CHAR_LIMIT = 4680;

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER  — all voice-consistency logic lives here
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the complete TTS director-style prompt.
 *
 * Key design principles (derived from Gemini 3.1 Flash TTS research):
 *
 * 1. DOMINANT EMOTION per section — pick 1–2 emotions per story beat,
 *    never switch emotion every sentence.
 *
 * 2. TAG FORMULA: [expressive] → text → [pacing] → [re-entry expressive] → text
 *    Tags must NEVER be adjacent (no [positive][pause]).
 *
 * 3. ENERGY CLIFF rule — never jump from a high-energy tag ([determination],
 *    [hope], [positive]) directly to [neutral]. Always buffer with
 *    [short pause] then a mid-energy re-entry tag.
 *
 * 4. SECTION TRANSITION rule — every new story section starts fresh with
 *    its own dominant emotion tag, never inherits the previous section's energy.
 *
 * 5. POST-PAUSE re-entry — after every [pause] or [long pause], the NEXT
 *    token MUST be a re-entry expressive tag, never raw text.
 *
 * 6. MAX 1 expressive tag per 3 sentences — emotion comes from word choice,
 *    not tag density. Over-tagging breaks output stability.
 *
 * 7. Overall Character budget — ensure the TOTAL generated script (all sections)
 *    is strictly under 4680 characters to fit within production limits.
 */
function buildPrompt({
  voice,
  gender,
  minWords,
  maxWords,
  durationMinutes,
  langInstruction,
  userPrompt,
}: {
  voice: string;
  gender: string;
  minWords: number;
  maxWords: number;
  durationMinutes: number;
  langInstruction: string;
  userPrompt: string;
}): string {
  return `You are a professional TTS script writer. Your only job is to write a spoken-word script for the Google Gemini 3.1 Flash TTS engine.

## CHARACTER BRIEF:
Narrator: ${voice}
Style: Confident, warm, professional. Delivery like a top-rated news anchor or FM host.
Energy: Consistently HIGH from the first word to the last. No dipping, no fading.

## DIRECTOR'S NOTES (apply to the entire script):
- The narrator MUST maintain identical vocal energy throughout. Write the script so every section feels equally important.
- Use inline emotion tags to guide delivery. These tags reset the model's internal state at each new paragraph.
- Start each major topic/section with a high-energy tag to prevent energy decay.
- Use "..." (ellipsis) for natural pauses between sections — do NOT write [pause].
- After "...", always follow with a high-energy re-entry tag.

## ASSIGNMENT:
User's idea: ${userPrompt}

Target: ${minWords}–${maxWords} words for a ${durationMinutes}-minute broadcast.
${voice} must introduce themselves naturally in the opening line.

## VOICE CONSISTENCY RULES:

RULE 1 — DOMINANT EMOTION PER SECTION:
Each topic/section uses 1–2 dominant emotion tags. Do not switch tags every sentence.
❌ WRONG: [optimistic] sentence. [neutral] sentence. [analytical] sentence.
✅ RIGHT:  [optimistic] Two or three sentences. ... [analytical] Next topic here.

RULE 2 — ENERGY RESET PATTERN (mandatory every ~300 words or new topic):
At the start of EVERY major section, inject a high-energy tag:
→ [energetic] OR [determination] OR [enthusiasm] OR [authoritative]
This prevents the TTS model from losing energy over long scripts.

RULE 3 — TAG FORMULA (strict order):
[expressive tag] → spoken text (2–3 sentences) → "..." → [re-entry expressive tag] → text
❌ WRONG: [optimistic] text ... text [analytical] text   ← No re-entry tag after "..."
✅ RIGHT:  [optimistic] Text here. ... [analytical] Next section.

RULE 4 — ENERGY CLIFF PREVENTION:
NEVER drop from a high-energy tag directly to [neutral].
Always use a bridge: [professional], [calm], [conversational] before [neutral].

RULE 5 — TAG DENSITY:
MAX 1 expressive tag per 3 sentences. Emotion comes from word choice, not just tags.

RULE 6 — MOMENTUM:
Never place "..." immediately after a high-energy tag.
Let the high-energy sentence finish completely, then pause.
✅ RIGHT: [enthusiasm] This is incredible news. ... [analytical] Let me break it down.

## APPROVED TAGS:
You can ONLY use these inline emotion tags:
${getTagsString()}

STRICTLY FORBIDDEN (will be silently deleted by the TTS pipeline):
❌ [pause] → write "..." instead
❌ [long pause] → write "..." instead
❌ [informative] → use [professional] or [analytical]
❌ [engaged] → use [enthusiastic] or [energetic]
❌ [happy] → use [enthusiasm] or [amusement]
❌ [breaking_news] → use [authoritative] or [urgency]
❌ Any tag not in the APPROVED list above

## SPACING:
- Use double line breaks (\n\n) between every paragraph.
- Use "..." at section transitions, always followed by a re-entry tag.

## LANGUAGE:
${langInstruction}

## TECHNICAL LIMITS:
- TOTAL SCRIPT MUST be UNDER ${PROMPT_CHAR_LIMIT} characters.
- Return ONLY raw spoken dialogue with inline emotion tags.
- NO markdown, NO speaker prefixes, NO commentary, NO fences.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE INSTRUCTION BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildLangInstruction(
  language: string,
  gender: string,
  voice: string
): string {
  const isHindi = language === "hindi";

  if (isHindi) {
    return `TRANSCRIPT LANGUAGE: Natural, conversational Hindi (Devanagari script).
Hinglish style is acceptable — mix English terms where Indians naturally would.

GENDER LOCK (${gender.toUpperCase()}) — NEVER BREAK THIS:
The narrator ${voice} is strictly ${gender}.
${gender === "female"
        ? `Use exclusively feminine Hindi forms:
  Verbs    → मैं जाती हूँ, मैं करती हूँ, मैं बताती हूँ
  Adjectives → मैं खुश हूँ, मैं तैयार हूँ
  Self-ref  → "मैं" with feminine verb agreement ALWAYS`
        : gender === "male"
          ? `Use exclusively masculine Hindi forms:
  Verbs    → मैं जाता हूँ, मैं करता हूँ, मैं बताता हूँ
  Adjectives → मैं खुश हूँ, मैं तैयार हूँ
  Self-ref  → "मैं" with masculine verb agreement ALWAYS`
          : `Use gender-neutral phrasing. Avoid gendered verb forms where possible.`
      }
CRITICAL: A single gender violation (wrong verb form) will break the entire audio persona.`;
  }

  return `TRANSCRIPT LANGUAGE: Natural, fluent English.
Tone and delivery must authentically match a ${gender} narrator named ${voice}.
${gender === "female"
      ? `Voice should be warm, articulate, and authoritative — confident femininity.`
      : gender === "male"
        ? `Voice should be grounded, clear, and measured — confident masculinity.`
        : `Voice should be clear, calm, and universally relatable.`
    }`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT VALIDATOR  — catches tag errors before returning to client
// ─────────────────────────────────────────────────────────────────────────────

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
}

// Tags are now managed via lib/tts-tags.ts

function validateScript(script: string): ValidationResult {
  const warnings: string[] = [];

  // 1. Unknown tags (not in approved set)
  const allTagsInScript = [...script.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].toLowerCase());
  for (const tag of allTagsInScript) {
    if (!ALLOWED_TTS_TAGS.includes(tag)) {
      warnings.push(`UNKNOWN tag [${tag}] — not in ALLOWED_TTS_TAGS list`);
    }
  }

  // 2. Adjacent tags (two tags with no text between them)
  const adjacentTagPattern = /\[[^\]]+\]\s*\[[^\]]+\]/g;
  const adjacentMatches = script.match(adjacentTagPattern);
  if (adjacentMatches && adjacentMatches.length > 0) {
    warnings.push(`Adjacent tags (${adjacentMatches.length}x): ${adjacentMatches.slice(0, 3).join(", ")}`);
  }

  // 3. High-energy tag directly followed by [neutral] (energy cliff)
  const energyCliff = /\[(energetic|enthusiasm|determination|authoritative|enthusiasm|awe|excitement)\][^[]{0,120}\[neutral\]/gi;
  if (energyCliff.test(script)) {
    warnings.push(`Energy cliff: high-energy tag drops directly to [neutral] — add a bridge tag`);
  }

  // 4. Overall character limit
  if (script.length > PROMPT_CHAR_LIMIT) {
    warnings.push(`Script length ${script.length} exceeds hard limit of ${PROMPT_CHAR_LIMIT} chars`);
  }

  return { isValid: warnings.length === 0, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── DB & User ─────────────────────────────────────────────────────────────
    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    const currentEmail =
      user?.email ||
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
    } else if (
      user.plan === "pro" &&
      user.planExpiresAt &&
      new Date(user.planExpiresAt) <= new Date()
    ) {
      user.plan = "free";
      user.planStatus = "expired";
      await user.save();
    }

    // Reset daily counters if UTC date changed
    resetDailyIfNeeded(user);

    // ── Request Body ──────────────────────────────────────────────────────────
    const {
      prompt,
      language = "hindi",
      voice = "Sunidhi",
      durationMinutes = 1,
    } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const maxDuration = user.plan === "pro" ? 5 : 2;
    if (durationMinutes > maxDuration) {
      return NextResponse.json(
        {
          error: `Duration limit exceeded. Your plan allows up to ${maxDuration} minutes.`,
        },
        { status: 400 }
      );
    }

    // ── Quota Check ───────────────────────────────────────────────────────────
    if (!isAdmin) {
      if (user.plan === "free") {
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
      } else if (
        user.plan === "pro" &&
        isProDailyLimitReached(user, "aiScript")
      ) {
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
    }

    // ── API Keys ──────────────────────────────────────────────────────────────
    const userApiKey =
      user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    // ── Build Prompt ──────────────────────────────────────────────────────────
    const gender = VOICE_GENDERS[voice] ?? "neutral";
    const geminiVoiceName = VOICE_MAPPING[voice] || voice;

    const minWords = durationMinutes * 120;
    const maxWords = durationMinutes * 150;

    const langInstruction = buildLangInstruction(language, gender, voice);

    const fullPrompt = buildPrompt({
      voice,
      gender,
      minWords,
      maxWords,
      durationMinutes,
      langInstruction,
      userPrompt: prompt.trim(),
    });

    // ── Gemini Call ───────────────────────────────────────────────────────────
    const attemptScriptGen = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        (ai as any).models.generateContent({
          model: TEXT_AI_MODEL,
          contents: fullPrompt,
        })
      );
    };

    let response: any;
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

      if (userApiKey && isKeyError) {
        console.warn(
          "[Script Gen] User key failed. Falling back to server key."
        );
        response = await attemptScriptGen(serverApiKey);
      } else {
        throw err;
      }
    }

    const script: string = response?.text ?? "";
    if (!script) {
      return NextResponse.json(
        { error: "Failed to generate script" },
        { status: 500 }
      );
    }

    // ── Validate Script Quality ───────────────────────────────────────────────
    const validation = validateScript(script);
    if (!validation.isValid) {
      console.warn("[Script Validation Warnings]", validation.warnings);
      // We still return the script but include warnings in dev mode
      // In production you could trigger a retry here if warnings.length > 2
    }

    // ── Record Usage ──────────────────────────────────────────────────────────
    incrementUsage(user, "aiScript");
    await user.save();

    return NextResponse.json({
      script,
      tokenUsage: response?.usageMetadata?.totalTokenCount ?? 0,
      usage: {
        aiScriptCount: user.aiScriptCount,
        dailyAiScriptCount: getDailyCount(user, "aiScript"),
        dailyLimit: PRO_DAILY_AI_SCRIPT_LIMIT,
        plan: user.plan,
      },
      // Include in dev for debugging; strip in production if preferred
      _validation:
        process.env.NODE_ENV === "development" ? validation : undefined,
    });
  } catch (err: any) {
    console.error("[Script Gen Error]", err);
    const code = err?.code ?? "UNKNOWN";
    const status = code === "OVERLOADED" ? 503 : 500;
    return NextResponse.json(
      {
        error: err.message || "Something went wrong",
        code,
        retryAfter: err?.retryAfter,
      },
      { status }
    );
  }
}