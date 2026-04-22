import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { TEXT_AI_MODEL } from "@/lib/constants";

// In-memory rate limiting map: { userId: { count, resetTime } }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_ATTEMPTS_PER_HOUR = 5;

// Cleanup old entries hourly to avoid memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
        if (now > value.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 60 * 60 * 1000);

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate Limiting
        const now = Date.now();
        let userLimit = rateLimitMap.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
            userLimit = { count: 0, resetTime: now + 60 * 60 * 1000 };
        }

        if (userLimit.count >= MAX_ATTEMPTS_PER_HOUR) {
            return NextResponse.json(
                { valid: false, error: "Too many validation attempts. Please try again later." },
                { status: 429 }
            );
        }

        userLimit.count += 1;
        rateLimitMap.set(userId, userLimit);

        const { apiKey } = await req.json();

        if (!apiKey?.trim()) {
            return NextResponse.json({ valid: false, error: "API key is required" }, { status: 400 });
        }

        // Use same @google/genai SDK as the rest of the app — supports both AQ. and AIzaSy keys
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
            await ai.models.generateContent({
                model: TEXT_AI_MODEL,
                contents: "hi",
            });
            return NextResponse.json({ valid: true });
        } catch (apiError: any) {
            const msg: string = (apiError?.message || "").toLowerCase();

            // Quota exceeded = key IS valid, just at its daily limit
            if (msg.includes("quota") || msg.includes("exceeded") || msg.includes("resource_exhausted") || apiError?.status === 429) {
                return NextResponse.json({ valid: true });
            }

            // Auth/key errors = key is genuinely invalid
            if (
                msg.includes("api key not valid") ||
                msg.includes("api_key_invalid") ||
                msg.includes("invalid api key") ||
                msg.includes("permission_denied") ||
                apiError?.status === 401 ||
                apiError?.status === 403
            ) {
                return NextResponse.json(
                    { valid: false, error: "Invalid API key. Please check and try again." },
                    { status: 400 }
                );
            }

            // Unknown error — assume valid (don't block user)
            console.warn("[validate-key] Unexpected error during validation:", apiError.message);
            return NextResponse.json({ valid: true });
        }

    } catch (err: any) {
        console.error("[validate-key] Route error:", err);
        return NextResponse.json({ valid: false, error: "Internal Server Error" }, { status: 500 });
    }
}
