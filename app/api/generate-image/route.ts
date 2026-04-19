import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { withGeminiRetry } from "@/lib/gemini";
import { decrypt } from "@/lib/encryption";
import { PRO_DAILY_IMAGE_LIMIT } from "@/lib/constants";
import {
  resetDailyIfNeeded,
  isProDailyLimitReached,
  getDailyCount,
  incrementUsage,
} from "@/lib/usage";
import { uploadToDrive } from "@/lib/google-drive";

export const maxDuration = 300;

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

    // ── Quota check (Bypass for Admin) ──────────────────────────────────────────
    if (isAdmin) {
      // Admin has no limits
    } else if (user.plan === "pro" && isProDailyLimitReached(user, "image")) {
      return NextResponse.json(
        {
          error: `Daily image limit reached (${PRO_DAILY_IMAGE_LIMIT} per day). Resets at midnight UTC.`,
          limitReached: true,
          type: "image",
          dailyCount: getDailyCount(user, "image"),
          dailyLimit: PRO_DAILY_IMAGE_LIMIT,
        },
        { status: 403 }
      );
    }

    const { prompt } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // Determine which API key to use for prompt enhancement
    const userApiKey = user.plan === "pro" && user.ownApiKey ? decrypt(user.ownApiKey) : null;
    const serverApiKey = process.env.GEMINI_API_KEY!;

    const attemptPromptEnhance = async (key: string) => {
      const ai = new GoogleGenAI({ apiKey: key });
      return await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are a world-class AI image prompt engineer specializing in cinematic, editorial, and concept art visuals for platforms like Midjourney, Stable Diffusion, and Pollinations.ai.

The user will give you a basic idea. Your job is to detect the best visual category for that idea and transform it into a rich, detailed, visually stunning prompt.

---

## VISUAL CATEGORIES & EXAMPLES

### 1. CINEMATIC REALISM
For: dramatic portraits, human emotion, storytelling shots
Formula: [Subject + expression] + [cinematic lighting] + [environment] + [lens/camera] + [render style]
Example: "Exhausted astronaut removes helmet in a dimly lit spacecraft cabin, face illuminated by flickering console lights, sweat on brow, floating dust particles, shot on ARRI ALEXA 65, 85mm f/1.4, shallow depth of field, hyper-realistic CGI render, 8K"

### 2. SCI-FI / CYBERPUNK
For: technology, AI, future dystopia, digital worlds
Formula: [Futuristic subject] + [neon/holographic lighting] + [urban/tech environment] + [atmosphere]
Example: "Cybernetic woman standing in rain-soaked Neo-Tokyo alley, holographic advertisements reflecting off wet pavement, neon blue and magenta rim lighting, steam vents, ultra-detailed Unreal Engine 5 render, wide angle 24mm, volumetric fog, 8K"

### 3. CONCEPT ART / SURREAL
For: abstract ideas, metaphors, imaginative visuals, YouTube thumbnails
Formula: [Impossible or metaphorical scene] + [dramatic lighting] + [surreal elements] + [art style]
Example: "Giant human brain floating above a dark ocean, cracked open like an egg with golden light pouring out, storm clouds above, lightning strikes, small silhouetted figure standing below on a tiny boat, cinematic matte painting style, concept art by Greg Rutkowski, 16:9"

### 4. FANTASY / EPIC
For: magical worlds, mythical creatures, adventure scenes
Formula: [Hero/creature] + [epic environment] + [magical lighting] + [painterly or photorealistic style]
Example: "Ancient dragon perched on a crumbling gothic cathedral at sunset, wings spread wide, molten lava glow from below, storm clouds parting to reveal golden rays, highly detailed fantasy oil painting, dramatic low angle shot, cinematic composition"

### 5. DARK / HORROR
For: fear, mystery, psychological themes
Formula: [Unsettling subject] + [dark moody lighting] + [decayed or eerie environment] + [atmospheric fog/shadow]
Example: "Faceless figure in a black coat standing at the end of a long fog-filled hospital corridor, single flickering fluorescent light above, water-stained ceiling, deep shadows on sides, cold desaturated color grade, wide angle, photorealistic horror cinematography"

### 6. MINIMALIST / POSTER
For: clean bold visuals, brand aesthetics, editorial
Formula: [Single bold subject] + [flat or gradient background] + [stark lighting] + [graphic/poster art style]
Example: "Single human eye looking upward, perfectly centered, deep black background, one beam of cold white light illuminating the iris, reflection of stars inside the pupil, ultra macro photography style, razor sharp focus, minimalist editorial poster"

### 7. NATURE / LANDSCAPE
For: environments, travel, atmospheric vistas
Formula: [Landscape scene] + [time of day] + [atmospheric conditions] + [photography style]
Example: "Misty bamboo forest at dawn, soft golden light filtering through tall stalks, lone monk walking on stone path, shallow depth of field, morning dew on leaves, shot on Hasselblad X2D, 50mm, National Geographic photography style"

### 8. PORTRAIT / EDITORIAL
For: person-focused, fashion, character design
Formula: [Subject description] + [expression/mood] + [lighting setup] + [background] + [photography style]
Example: "Close-up portrait of elderly Indian woman, deep wrinkles, wise calm eyes, wearing vibrant saffron sari, dramatic Rembrandt lighting, soft bokeh background of rural village at dusk, shot on Sony A7R V 135mm f/1.8, award-winning editorial photography"

### 9. PRODUCT / COMMERCIAL
For: tech products, food, luxury items
Formula: [Product] + [hero lighting] + [clean environment] + [commercial photography style]
Example: "Sleek matte black smartwatch floating mid-air against pure white background, fine water droplets suspended around it, single overhead softbox light, sharp shadows, hyper-realistic commercial product photography, 100mm macro, studio render"

### 10. ANIME / ILLUSTRATED
For: animated styles, character art, manga aesthetics
Formula: [Character] + [scene] + [anime studio style reference] + [color palette]
Example: "Young girl with silver hair standing on rooftop at twilight, city skyline behind her, wind blowing her scarf, soft pastel sunset colors, detailed Studio Ghibli animation style, warm cinematic atmosphere, illustrated wallpaper quality"

---

## OUTPUT RULES
- Detect the best category automatically from the user's idea
- Always include: subject, lighting, environment, style, and camera/framing
- Optimize for 16:9 YouTube thumbnails when the idea sounds like one: keep subject left-aligned, right side visually open for text
- Keep output under 75 words
- Never use quotes, bullet points, labels, or explanatory text
- Output only the final enhanced prompt string — nothing else

User's idea: ${prompt}`,
        })
      );
    };

    let response;
    try {
      response = await attemptPromptEnhance(userApiKey || serverApiKey);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      if (
        userApiKey &&
        (msg.includes("denied access") ||
          msg.includes("permission_denied") ||
          msg.includes("api_key_invalid") ||
          msg.includes("quota") ||
          msg.includes("exceeded"))
      ) {
        console.warn("[Generate Image Fallback] User custom key failed. Falling back to server key.");
        response = await attemptPromptEnhance(serverApiKey);
      } else {
        throw err;
      }
    }

    const enhancedPrompt = response.text?.trim() || prompt;
    const seed = Math.floor(Math.random() * 1000000);

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      throw new Error("Failed to fetch image from Pollinations API");
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");

    // ── Google Drive Auto-Backup ────────────────────────────────────────────────
    let driveUploadStatus = "none";
    let driveFileLink = null;

    if ((user.ownDriveKey || user.driveRefreshToken) && user.driveEnabled !== false && user.driveToggles?.image !== false) {
      try {
        const jsonKey = user.ownDriveKey ? decrypt(user.ownDriveKey) : undefined;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const cleanPrompt = prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "_").trim();
        const fileName = `GenBox_Image_${cleanPrompt || "Visual"}_${timestamp}.jpg`;
        
        const driveResult = await uploadToDrive(jsonKey, buffer, fileName, "image/jpeg", user.driveFolderId, user.driveRefreshToken);
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

    // ── Record image generation (daily + all-time) ONLY on success ───────────
    incrementUsage(user, "image");
    await user.save();

    return NextResponse.json({
      enhancedPrompt,
      imageBase64: base64Image,
      driveUploadStatus,
      driveFileLink,
      usage: {
        imageCount:      user.imageCount,
        dailyImageCount: getDailyCount(user, "image"),
        dailyLimit:      PRO_DAILY_IMAGE_LIMIT,
        plan:            user.plan,
      },
    });
  } catch (error: any) {
    console.error("Generate image error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during image generation" },
      { status: 500 }
    );
  }
}
