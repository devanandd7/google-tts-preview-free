import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { decrypt } from "@/lib/encryption";
import { withGeminiRetry } from "@/lib/gemini";
import { uploadToDrive } from "@/lib/google-drive";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ clerkId: userId });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // STRICT PRO ONLY GATE
    if (user.plan !== "pro") {
      return NextResponse.json(
        {
          error: "AI Music generation is available for PRO plan users only.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    const { prompt, lyrics, duration, instrumental } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Musical style/prompt is required" }, { status: 400 });
    }

    let finalPrompt = prompt.trim();

    if (instrumental) {
      finalPrompt = "Instrumental only, no vocals. " + finalPrompt;
    }

    if (lyrics && lyrics.trim()) {
      finalPrompt = `Create a track matching this style: ${finalPrompt}\n\nWith the following lyrics:\n${lyrics.trim()}`;
    }

    const customApiKey = user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY;

    const attemptMusicGen = async (apiKey: string) => {
      const ai = new GoogleGenAI({ apiKey });
      const isFull = duration === "full";
      const modelName = isFull ? "lyria-3-pro-preview" : "lyria-3-clip-preview";

      const config = {
        responseModalities: ["AUDIO", "TEXT"],
      };

      const response = await ai.models.generateContent({
        model: modelName,
        contents: finalPrompt,
        config,
      });

      let base64Audio = null;
      let generatedText = null;

      if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content?.parts) {
        throw new Error("No output content generated from models.");
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Audio = part.inlineData.data;
        } else if (part.text) {
          generatedText = part.text;
        }
      }

      if (!base64Audio) {
        throw new Error("Failed to generate audio content.");
      }

      return {
        audioBase64: base64Audio,
        lyricsOrStructure: generatedText,
        tokenUsage: response.usageMetadata?.totalTokenCount || 0,
      };
    };

    let result;
    let usedKeyType = "server";

    try {
      if (customApiKey) {
        usedKeyType = "custom";
        try {
          console.log("[Music Gen] Attempting with User Custom API Key");
          result = await withGeminiRetry(() => attemptMusicGen(customApiKey));
        } catch (e: any) {
          console.warn("[Music Gen Fallback] User custom key failed. Trying server key.");
          if (!serverApiKey) throw e;
          usedKeyType = "server";
          result = await withGeminiRetry(() => attemptMusicGen(serverApiKey));
        }
      } else {
        if (!serverApiKey) {
          throw new Error("No Gemini API key available on server either.");
        }
        console.log("[Music Gen] Attempting with Server API Key");
        result = await withGeminiRetry(() => attemptMusicGen(serverApiKey));
      }
    } catch (e: any) {
      const errMsg = e.message || "";
      if (errMsg.includes("SAFETY") || e.code === "SAFETY_BLOCK") {
        return NextResponse.json(
          { error: "Content blocked by safety filters.", code: "SAFETY_BLOCK" },
          { status: 400 }
        );
      }
      if (errMsg.includes("QUOTA") || e.code === "QUOTA_EXCEEDED" || errMsg.includes("429")) {
        const keySource = usedKeyType === "custom" ? "your Custom API Key" : "our Server API Key";
        return NextResponse.json(
          {
            error: `Gemini API limit exceeded on ${keySource}. Lyria Music models have very strict quotas. Please wait or try your own API key.`,
            code: "QUOTA_EXCEEDED",
          },
          { status: 429 }
        );
      }
      throw e;
    }

    // ── Record music generation (all-time total) ──────────────────────────────
    user.musicCount = (user.musicCount ?? 0) + 1;
    await user.save();

    // ── Google Drive Auto-Backup ────────────────────────────────────────────────
    let driveUploadStatus = "none";
    let driveFileLink = null;

    if ((user.ownDriveKey || user.driveRefreshToken) && result.audioBase64 && user.driveEnabled !== false && user.driveToggles?.music !== false) {
      try {
        const jsonKey = user.ownDriveKey ? decrypt(user.ownDriveKey) : undefined;
        const buffer = Buffer.from(result.audioBase64, "base64");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const cleanPrompt = prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "_").trim();
        const fileName = `GenBox_Music_${cleanPrompt || "Track"}_${timestamp}.mp3`;
        
        const driveResult = await uploadToDrive(jsonKey, buffer, fileName, "audio/mpeg", user.driveFolderId, user.driveRefreshToken);
        driveUploadStatus = "success";
        driveFileLink = driveResult.webViewLink;

        if (driveResult.detectedFolderId && !user.driveFolderId) {
          user.driveFolderId = driveResult.detectedFolderId;
          await user.save();
        }
        console.log(`[Drive Upload] Success: ${fileName}`);
      } catch (error) {
        console.error("[Drive Upload Error]", error);
        driveUploadStatus = "failed";
      }
    }

    return NextResponse.json({
      audioBase64: `data:audio/mp3;base64,${result.audioBase64}`,
      generatedLyrics: result.lyricsOrStructure,
      tokenUsage: result.tokenUsage,
      driveUploadStatus,
      driveFileLink,
      usage: {
        musicCount: user.musicCount,
        plan: user.plan,
      },
    });
  } catch (error: any) {
    console.error("Music generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI Music. Please try again or check lyrics." },
      { status: 500 }
    );
  }
}
