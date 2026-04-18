import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
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
      user.plan = "free";
      user.planStatus = "expired";
      await user.save();
    }

    const { prompt, language = "hindi", voice1 = "Puck", voice2 = "Kore", durationMinutes = 1 } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    if (durationMinutes > 5) {
      return NextResponse.json({ error: "Duration cannot exceed 5 minutes" }, { status: 400 });
    }

    // STRICT LIMIT: Max 1 broadcast generation per user to save tokens,
    // UNLESS the user is a Pro user utilizing their own custom API key.
    if (user.broadcastCount >= 1 && !(user.plan === "pro" && user.ownApiKey)) {
      return NextResponse.json(
        { error: "Broadcast limit reached. You can only generate 1 broadcast. Please add your own API key in Pro Settings to generate more." },
        { status: 403 }
      );
    }

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
    const gender1 = VOICE_GENDERS[voice1] ?? "neutral";
    const gender2 = VOICE_GENDERS[voice2] ?? "neutral";

    const langInstruction = isHindi
      ? `LANGUAGE: Write ALL spoken dialogue in natural, conversational Hindi (Devanagari script). Mix in English words naturally (Hinglish). Match gender strictly: ${voice1} is ${gender1}, ${voice2} is ${gender2}. Use correct gendered Hindi grammar for each speaker at all times.`
      : `LANGUAGE: Write ALL spoken dialogue in natural, fluent conversational English.`;

    // Target: ~175 words/min for natural speech pacing
    const minWords = durationMinutes * 160;
    const maxWords = durationMinutes * 185;

    const attemptScriptGen = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are an expert podcast scriptwriter creating a 2-person broadcast dialogue.

## STRICT FORMATTING RULES — MUST FOLLOW EXACTLY:
1. Every line MUST start with [VoiceName: and end with ]
2. Example: [Puck: Welcome back everyone, today we explore something fascinating.]
3. Keep each speaker line SHORT — maximum 200 characters of spoken text per line
4. Split longer thoughts into multiple short lines for the same speaker
5. NEVER put colons (:) inside the spoken text — use "—" or rephrase instead
6. NEVER put brackets ([ or ]) inside the spoken text EXCEPT for the expression tags listed below
7. Write ONLY the dialogue — no stage directions, no headers, no "Here is the script" intro
8. Alternate speakers naturally — no speaker should have more than 3 consecutive lines

## EXPRESSION TAGS — USE FREELY for maximum natural, human delivery:
These tags control speech delivery and emotion. Use them inline within any line of spoken text:

### Emotion & Tone:
- [laughs] — burst of laughter
- [chuckles] — light, brief amusement
- [sighs] — audible exhale of emotion
- [nervous laugh] — anxious laughter
- [whispers] — intimate, hushed voice
- [excitedly] — high energy, enthusiastic
- [softly] — gentle, tender tone
- [nervously] — hesitant, anxious
- [seriously] — weighted, grave delivery
- [warmly] — friendly, approachable
- [surprised] — shocked reaction tone
- [sadly] — low, mournful delivery
- [angrily] — firm, raised intensity
- [proudly] — confident, elevated

### Pacing & Rhythm:
- [slowly] — drawn-out delivery
- [quickly] — fast-paced speech
- [pause] — brief natural pause for effect
- [long pause] — extended dramatic silence
- [silence] — complete stop
- [...] — trailing off, unfinished thought

### Example of great usage:
[Puck: [excitedly] Yaar, yeh topic toh bahut interesting hai — main bohot excited hun!]
[Kore: [laughs] Haan, pehle mujhe bhi [sighs] ajeeb laga tha, par ab samajh aa gaya.]
[Puck: [seriously] Lekin isko genuinely seriously lena chahiye [pause] kyunki yeh sabke liye important hai.]
[Kore: [softly] Bilkul sahi... [slowly] aur main chahti hun ki log ise samjhein.]

## AUDIO QUALITY RULES:
- Use expression tags to add personality, rhythm, and emotion — don't overuse them, keep it natural
- Alternate between energetic and calm moments for dynamic listening experience
- Short punchy lines work better than long run-on sentences for spoken audio

## CONTENT:
Speaker 1: ${voice1} (${gender1})
Speaker 2: ${voice2} (${gender2})
Target length: ${minWords}–${maxWords} words for a ${durationMinutes}-minute broadcast
Topic: ${prompt}

${langInstruction}

Start the dialogue directly without any preamble:`,
        })
      );
    };

    let response;
    try {
      // Direct call using the active key. No fallback!
      response = await attemptScriptGen(userApiKey || serverApiKey);
    } catch (err: any) {
      throw err;
    }

    const script = response.text;

    if (!script) {
      return NextResponse.json({ error: "Failed to generate broadcast script" }, { status: 500 });
    }

    // Increment broadcastCount on EVERY script generation (prevents quota bypass
    // where users could call script endpoint unlimited times without generating audio)
    user.broadcastCount += 1;
    await user.save();

    return NextResponse.json({
      script,
      tokenUsage: response?.usageMetadata?.totalTokenCount || 0,
      usage: {
        broadcastCount: user.broadcastCount,
        plan: user.plan
      }
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
