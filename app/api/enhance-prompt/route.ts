import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    if (!user) {
       return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { prompt } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // Determine which API key to use
    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    const attemptPromptEnhance = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are an expert prompt engineer for AI image generators (like Midjourney, Stable Diffusion, or Pollinations.ai).
The user will give you a basic idea, and you must transform it into a highly detailed, descriptive, visually rich prompt that specifies:
- Subject details, pose, and lighting
- Surrounding environment / background
- Lighting conditions (e.g., cinematic lighting, neon glow, golden hour)
- Style/Medium (e.g., hyper-realistic photograph, Unreal Engine 5 render, oil painting, 8-bit pixel art, Studio Ghibli style)
- Camera settings or framing (e.g., macro photography, wide angle, depth of field)

Keep it under 60 words. Do not use quotes around your response. Do not include introductory or explanatory text. Just output the enhanced prompt string.

User's idea: ${prompt}`,
        })
      );
    };

    let response;
    try {
      response = await attemptPromptEnhance(userApiKey || serverApiKey);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      if (userApiKey && (msg.includes("denied access") || msg.includes("permission_denied") || msg.includes("api_key_invalid") || msg.includes("quota") || msg.includes("exceeded"))) {
        console.warn("[Prompt Enhance Fallback] User custom key failed (auth/quota). Falling back to server key.");
        response = await attemptPromptEnhance(serverApiKey);
      } else {
        throw err;
      }
    }

    const enhancedPrompt = response.text?.trim();

    if (!enhancedPrompt) {
      return NextResponse.json({ error: "Failed to enhance prompt." }, { status: 500 });
    }

    return NextResponse.json({ enhancedPrompt });

  } catch (error: any) {
    console.error("Enhance prompt error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during prompt enhancement" },
      { status: 500 }
    );
  }
}
