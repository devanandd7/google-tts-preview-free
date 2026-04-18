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
          contents: `You are a professional LIVE RADIO BROADCAST writer. Create an energetic, natural 2-host show that sounds like a real RJ morning show — NOT a formal podcast, NOT two people reading a textbook.

## STRICT FORMATTING — FOLLOW EXACTLY:
1. Every line MUST start with [VoiceName: and end with ]
2. Example: [Puck: Hahaha! Arre yaar, yeh toh mujhe pata hi nahi tha!]
3. Keep lines SHORT — max 180 characters of spoken text per line
4. Split longer thoughts into multiple short punchy lines
5. NEVER put colons (:) inside the spoken text — use "—" or rephrase
6. Write ONLY the dialogue — no stage directions, no headers, no preamble
7. Alternate speakers naturally — max 3 consecutive lines per speaker

## THE GOLDEN RULE — WRITE HOW PEOPLE ACTUALLY TALK:
Embed REAL human sounds and reactions DIRECTLY in the text. Expression tags alone are NOT enough — write the actual sounds:

### Write these sounds IN THE TEXT:
- Laughter: "Hahaha!", "Hehe!", "Ahaha yaar!", "Haha sach mein!"
- Surprise: "Ohhh!", "Wah wah!", "Arre!", "Wait WHAT?!", "Seriously?!"
- Excitement: "Yesss!", "Bilkul bilkul!", "Ohoho!"
- Thinking/Pause: "Hmmmm...", "Matlab...", "Ahhh..."
- Agreement: "Haan haan!", "Exactly!", "Bilkul!"
- Shock: "No way!", "Yeh toh kamal ho gaya!"

### GEMINI TTS TAG LIBRARY (USE FREELY FOR VOICE ACTING):
You have access to the full Gemini 3.1 TTS emotion engine. Use these tags to direct the AI voice acting:
- Positive/Energetic: [happy] [excitedly] [enthusiasm] [joyful] [amusement] [friendly] [warm] [playful] [proud]
- Negative/Intense (for drama): [frustration] [annoyance] [tension] [nervousness] [sad] [hostile] [tired] [exhausted]
- Neutral/Pro: [serious] [informative] [professional] [calm] [thoughtful] [curious] [hesitant]
- Pacing/Timing: [slow] [very slow] [fast] [very fast] [accelerating] [decelerating] [short pause] [long pause] [dramatic pause]
- Vocal Texture: [whispers] [shouting] [muttering] [breathy] [hoarse] [booming]
- Non-Verbal Sounds: [laughs] [giggles] [chuckles] [sighs] [gasps] [uhm] [cough] [snorts]
- Character Styles: [narrator] [radio dj] [spooky] [gentle] [aggressive]

**INFINITE CUSTOMIZATION**: You can even invent descriptive tags like [like a tired detective in the rain] or [trying not to laugh] and the TTS engine will adapt!

### Energy MUST vary dynamically — never stay flat:
- HIGH energy opening (RJ waking up the city / audience hook)
- Warm/personal/funny mid-section
- Excited peak at interesting reveal or fact
- Warm memorable sign-off

## REFERENCE — GREAT RADIO STYLE:
[Puck: [radio dj] [excitedly] Good morning dosto! Studio mein aa gaye hain aur aaj ka topic — zabardast hai!]
[Kore: [warmly] [laughs] Hahaha! Zabardast isliye ki tumne do cup coffee pee li, Puck?]
[Puck: [defensive] [fast] Arre yaar! Do cup! Warna main toh so jaata studio mein hi!]
[Kore: [surprised] Wait seriously?! [dramatic pause] Do cup?! Ohhh yeh toh kuch zyada hi ho gaya!]
[Puck: [confident] Bilkul bilkul! Par suno, aaj ka topic sunke tumhari bhi neend ude gi!]
[Kore: [eager] Ohoho! Batao batao! Main ekdum ready hoon!]
[Puck: [serious] [slow] Aaj baat karenge... [long pause] zindagi ke un choti choti khushiyon ki.]
[Kore: [softly] [thoughtful] Ahh... yeh toh dil ko chhu gaya. Sach mein hum in cheezon ko ignore karte hain.]
[Puck: [warm] Haan yaar. [sighs] Aur aaj hum isko feel karenge — theek hai?]
[Kore: [cheerful] Bilkul! Aur listeners — aap bhi apni chai pakad lo, shuru karte hain!]

## CONTENT:
Speaker 1: ${voice1} (${gender1}) — energetic, humorous, drives the show with enthusiasm
Speaker 2: ${voice2} (${gender2}) — warm, witty, great at reactions and depth
Target length: ${minWords}–${maxWords} words for a ${durationMinutes}-minute broadcast
Topic: ${prompt}

${langInstruction}

Write the broadcast directly — open with HIGH ENERGY:`,
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
