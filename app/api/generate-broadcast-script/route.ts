import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { FREE_BROADCAST_LIMIT } from "@/lib/constants";
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
    if (durationMinutes > 9) {
      return NextResponse.json({ error: "Duration cannot exceed 9 minutes" }, { status: 400 });
    }

    // ── Enforce limits ──
    if (user.plan === "free") {
      if (user.broadcastCount >= FREE_BROADCAST_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan limit reached (${FREE_BROADCAST_LIMIT} Broadcasts). Upgrade to Pro to get unlimited generations.`,
            limitReached: true,
            type: "broadcast",
          },
          { status: 403 }
        );
      }
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
      ? `IMPORTANT: Write the dialouge in natural, conversational Hindi (Devanagari script). Mix in English words naturally (Hinglish). CRITICAL: Ensure you match the genders when rendering Hindi grammar. ${voice1} is ${gender1} and ${voice2} is ${gender2}. Never break this gender rule.`
      : `Write the dialogue in natural, fluent English matching the styles of the voices.`;

    const minWords = durationMinutes * 160;
    const maxWords = durationMinutes * 190;

    const attemptScriptGen = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are an expert podcast scriptwriter. 

Given a user's idea, write a highly engaging 2-person dialogue broadcast between two speakers.

**CRITICAL INSTRUCTIONS FOR FORMATTING:**
You must strictly use the format "[VoiceName:" before each line, and "]" to close the line name. No other formatting. Do not output anything before the script. Do not output intro paragraphs or "Here is the script". Simply output the dialogue directly.

Example format:
[Puck: Welcome back to the show, everyone. Today we have a great topic.]
[Kore: I am so excited to dive into this. It's been on my mind all week.]
[Puck: Me too.]

DO NOT USE COLONS OR BRACKETS INSIDE THE ACTUAL SPOKEN TEXT. The only brackets should encase the speaker name and their line.

Target length: ${minWords} to ${maxWords} words to fit a ${durationMinutes}-minute broadcast.
Speaker 1 Name: ${voice1} (Gender: ${gender1})
Speaker 2 Name: ${voice2} (Gender: ${gender2})

Make it dynamic, emotional, and performable. 
${langInstruction}

User's topic: ${prompt}`,
        })
      );
    };

    let response;
    try {
      response = await attemptScriptGen(userApiKey || serverApiKey);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      if (userApiKey && (msg.includes("denied access") || msg.includes("permission_denied") || msg.includes("api_key_invalid") || msg.includes("quota") || msg.includes("exceeded"))) {
        console.warn("[Broadcast Script Fallback] User custom key failed. Falling back to server key.");
        response = await attemptScriptGen(serverApiKey);
      } else {
        throw err;
      }
    }

    const script = response.text;

    if (!script) {
      return NextResponse.json({ error: "Failed to generate broadcast script" }, { status: 500 });
    }

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
