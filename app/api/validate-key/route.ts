import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// In-memory rate limiting map: { userId: { count, resetTime } }
// Note: Normally you'd use Redis for this in production. Let's use a simple memory cache for now.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_ATTEMPTS_PER_HOUR = 5;

// Cleanup old entries every so often to avoid memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
        if (now > value.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 60 * 60 * 1000); // Check hourly

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate Limiting Logic
        const now = Date.now();
        let userLimit = rateLimitMap.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
            userLimit = { count: 0, resetTime: now + 60 * 60 * 1000 }; // 1 hour from now
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

        if (!apiKey) {
            return NextResponse.json({ valid: false, error: "API key is required" }, { status: 400 });
        }

        // Lightweight test call to Google TTS API
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); // Use a fast/cheap model to test

            // Just a tiny prompt to verify the key
            await model.generateContent("Test");

            return NextResponse.json({ valid: true });
        } catch (apiError: any) {
            console.error("API Key Validation Error:", apiError.message);
            // Determine if it's an auth error vs something else
            let errorMsg = "Invalid API Key or API error.";
            if (apiError.message?.includes('API key not valid')) {
                errorMsg = "API key not valid. Please check and try again.";
            }
            return NextResponse.json({ valid: false, error: errorMsg }, { status: 400 });
        }

    } catch (err: any) {
        console.error("Validation Route Error:", err);
        return NextResponse.json({ valid: false, error: "Internal Server Error" }, { status: 500 });
    }
}
