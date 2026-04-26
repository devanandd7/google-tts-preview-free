import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getTagsString } from "@/lib/tts-tags";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { PRO_DAILY_BROADCAST_LIMIT, TEXT_AI_MODEL } from "@/lib/constants";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import {
  resetDailyIfNeeded,
  isProDailyLimitReached,
  getDailyCount,
  incrementUsage,
} from "@/lib/usage";
import { VOICE_MAPPING, VOICE_GENDERS } from "@/lib/voices";
import { getTimeContext } from "@/lib/time-context";

const ADMIN_EMAILS = ["devanandutkarsh7@gmail.com"];

export async function POST(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    const currentEmail =
      ((user?.email) ||
      (sessionClaims?.email as string) ||
      (sessionClaims?.primaryEmail as string) ||
      "").toLowerCase();
    
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

    // ── Quota check (Bypass for Admin) ──────────────────────────────────────────
    if (isAdmin) {
      // Admin has no limits
    } else {
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

      // Daily broadcast limit for Pro users
      if (isProDailyLimitReached(user, "broadcast")) {
        return NextResponse.json(
          {
            error: `Daily broadcast limit reached (${PRO_DAILY_BROADCAST_LIMIT} per day). Resets at midnight UTC.`,
            limitReached: true,
            type: "broadcast",
            dailyCount: getDailyCount(user, "broadcast"),
            dailyLimit: PRO_DAILY_BROADCAST_LIMIT,
          },
          { status: 403 }
        );
      }
    }

    const { 
      prompt, 
      language = "hindi", 
      voice1 = "Dev", 
      voice2 = "Sunidhi", 
      durationMinutes = 1,
      useTimeContext = false,
      timezoneOffset = 330 // Default IST
    } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    const maxDuration = user.plan === "pro" ? 5 : 2;
    if (durationMinutes > maxDuration) {
      return NextResponse.json({ error: `Duration limit exceeded. Your plan allows up to ${maxDuration} minutes.` }, { status: 400 });
    }

    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    const isHindi = language === "hindi";

    const gender1 = VOICE_GENDERS[voice1] ?? "male";
    const gender2 = VOICE_GENDERS[voice2] ?? "female";

    // ── Time Context Injection ───────────────────────────────────────────────
    let timeInfo = "";
    if (useTimeContext) {
      const timeCtx = getTimeContext(timezoneOffset);
      timeInfo = `
## TIME-BASED TONE (CRITICAL — match this exactly):
Current Period: ${timeCtx.period.toUpperCase()} (${timeCtx.greeting})
Local Time: ${timeCtx.timeString}
Energy Level: ${timeCtx.energy}
Pace: ${timeCtx.pace}
Mood: ${timeCtx.mood}
Preferred Tags: ${timeCtx.tags}

OPENING: The opening line MUST reflect the time of day. Use "${timeCtx.greeting} listeners!" or similar.
TIME MENTION: At some point in the opening or transition, NATURALLY mention that "it's currently ${timeCtx.timeString}" or "the clock shows ${timeCtx.timeString}".
TONE DIRECTION: ${timeCtx.systemTone}`;
    }

    const langInstruction = isHindi
      ? `LANGUAGE: Write ALL spoken dialogue in natural, conversational Hindi (Devanagari script). Mix in English words naturally (Hinglish). 
CRITICAL GENDER RULES: 
- ${voice1} is ${gender1}. 
- ${voice2} is ${gender2}. 
- YOU MUST use strict gendered Hindi grammar (e.g., 'kar raha hoon' vs 'kar rahi hoon'). 
- NEVER mix up the gendered verbs or adjectives for these speakers. This is for a production broadcast, so accuracy is mandatory.`
      : `LANGUAGE: Write ALL spoken dialogue in natural, fluent conversational English.`;

    const minWords = durationMinutes * 160;
    const maxWords = durationMinutes * 185;

    const attemptScriptGen = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        (ai as any).models.generateContent({
          model: TEXT_AI_MODEL,
          contents: `You are a professional LIVE RADIO BROADCAST writer. Create an energetic, 
natural 2-host show that sounds like a real RJ morning show — NOT a formal podcast, 
NOT two people reading a textbook.

## STRICT FORMATTING — FOLLOW EXACTLY:
1. Every line MUST start with [VoiceName: and end with ]
2. Example: [Puck: Hahaha! Arre yaar, yeh toh mujhe pata hi nahi tha!]
3. Keep lines SHORT — max 180 characters of spoken text per line
4. Split longer thoughts into multiple short punchy lines
5. NEVER put colons (:) inside the spoken text — use "—" or rephrase
6. Write ONLY the dialogue — no stage directions, no headers, no preamble
7. Alternate speakers naturally — max 3 consecutive lines per speaker

## THE GOLDEN RULE — WRITE HOW PEOPLE ACTUALLY TALK:
Embed REAL human sounds and reactions DIRECTLY in the text:

- Laughter: "Hahaha!", "Hehe!", "Ahaha yaar!", "Haha sach mein!"
- Surprise: "Ohhh!", "Wah wah!", "Arre!", "Wait WHAT?!", "Seriously?!"
- Excitement: "Yesss!", "Bilkul bilkul!", "Ohoho!"
- Thinking: "Hmmmm...", "Matlab...", "Ahhh..."
- Agreement: "Haan haan!", "Exactly!", "Bilkul!"
- Shock: "No way!", "Yeh toh kamal ho gaya!"

## OFFICIAL GEMINI 3.1 TTS TAG LIBRARY:
CRITICAL RULE: You can ONLY use the following inline emotion tags: 
\${getTagsString()}

Do not invent or use any other tags (e.g., do not use [happy] or [gasps]).
Place ONE tag at a time — NEVER two tags consecutively. Always follow a tag immediately with spoken text.

Pacing and Spacing:
- Use "..." (ellipsis) where topics change — DO NOT write [pause], TTS reads it literally.
- Always follow "..." with a high-energy re-entry tag.
- Always include double line breaks (\\n\\n) between paragraphs.

### CORRECT TAG USAGE EXAMPLES:
✅ [energetic] Good morning dosto!
✅ Hahaha! [amusement] Yaar yeh toh mujhe pata hi nahi tha!
✅ [curiosity] Matlab... sach mein aisa hota hai?
✅ [sighs] Haan yaar, ... [enthusiasm] aaj ka din alag hi tha.

### WRONG — NEVER DO THIS:
❌ [radio dj] [excitedly] Good morning  ← two tags consecutive
❌ [warmly] hello  ← not an official tag
❌ [like a tired detective]  ← invented tag, will break output
❌ [pause]  ← TTS reads it literally! Use "..." instead

## ENERGY ARC & FLOW — MUST VARY DYNAMICALLY:
- HIGH energy opening — hook the audience immediately
- PERIODIC ENERGY RESET: At the start of EVERY new topic, inject [energetic], [enthusiasm], or [determination] to prevent voice energy from fading.
- EMOTIONAL STABILITY: Use 1-2 dominant emotions per story section. Do not switch tags every sentence.
- MOMENTUM: Never place "..." immediately after a high-energy tag. Let momentum carry the sentence through, then pause.
- VARIED SUMMARIES: Vary section endings: 1st [neutral], 2nd [optimistic], 3rd [professional].
- TECHNICAL CONTENT: Break long technical sentences into fragments. Use [emphasis] on key numbers.
- RE-ENTRY: After every "...", you MUST provide a re-entry tag. Never leave a pause without a follow-up energy instruction.
- Warm sign-off — memorable, heartfelt close

## REFERENCE — CORRECT RADIO STYLE:
[\${voice1}: [energetic] Good morning dosto! Main hoon \${voice1} — aur mere saath hain \${voice2}!]
[\${voice2}: [laughs] Hahaha! Shukriya \${voice1}! Aaj ka topic ekdum zabardast hai!]
[\${voice1}: Arre bilkul! [amusement] Warna main toh studio mein so jaata!]
[${voice2}: [awe] Wait seriously?! ... [enthusiasm] Bhai, tune coffee nahi pee kya?]
[\${voice1}: [authoritative] Pee toh li — par suno, aaj ka topic sunke neend ude gi!]
[\${voice2}: [thoughtful] Ohoho! Batao batao — main ready hoon!]
[\${voice1}: [slow] Aaj baat karenge... ... [curiosity] zindagi ki choti choti khushiyon ki.]
[\${voice2}: [sighs] Ahh... \${voice1} yeh toh dil ko chhu gaya. Sach mein hum bhool jaate hain.]
[\${voice1}: Haan yaar. ... [enthusiasm] Aur aaj hum isko feel karenge — theek hai?]
[\${voice2}: [optimistic] Bilkul! Listeners — chai pakad lo, hum shuru karte hain!]

## CONTENT:
Speaker 1: ${voice1} (${gender1}) — energetic, humorous, drives the show
Speaker 2: ${voice2} (${gender2}) — warm, witty, great at reactions and depth
Target: ${minWords}–${maxWords} words for a ${durationMinutes}-minute broadcast
Topic: ${prompt}
${timeInfo}

${langInstruction}

Write the broadcast directly — open with HIGH ENERGY.
STRICT LIMIT: The entire script MUST be UNDER 4450 characters. If it exceeds this, the production will fail.`
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
        console.warn("[Broadcast Script Fallback] User key failed. Falling back to server key.");
        response = await attemptScriptGen(serverApiKey);
      } else {
        throw err;
      }
    }

    const script = (response as any).text;
    if (!script) {
      return NextResponse.json({ error: "Failed to generate broadcast script" }, { status: 500 });
    }

    // ── Record usage (daily + all-time) ──────────────────────────────────────────
    incrementUsage(user, "broadcast");
    await user.save();

    return NextResponse.json({
      script,
      tokenUsage: (response as any)?.usageMetadata?.totalTokenCount || 0,
      usage: {
        broadcastCount: user.broadcastCount,
        dailyBroadcastCount: getDailyCount(user, "broadcast"),
        dailyLimit: PRO_DAILY_BROADCAST_LIMIT,
        plan: user.plan,
      },
    });
  } catch (err: any) {
    console.error("[Broadcast Script Error]", err);
    const code = err?.code ?? "UNKNOWN";
    const status = code === "OVERLOADED" ? 503 : code === "QUOTA_EXCEEDED" ? 429 : 500;
    return NextResponse.json(
      { error: err.message || "Something went wrong", code, retryAfter: err?.retryAfter },
      { status }
    );
  }
}
