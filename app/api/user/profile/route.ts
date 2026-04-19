import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { decrypt } from "@/lib/encryption";
import {
  resetDailyIfNeeded,
  getDailyCount,
  getProDailyLimit,
} from "../../../../lib/usage";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["devanandutkarsh7@gail.com", "devanandutkarsh7@gmail.com"];

/** Auto-expire plan if time has passed */
async function checkAndExpirePlan(user: any) {
  if (user.plan === "pro" && user.planExpiresAt) {
    const isExpired = new Date(user.planExpiresAt) <= new Date();
    if (isExpired && user.planStatus !== "expired") {
      user.plan = "free";
      user.planStatus = "expired";
      await user.save();
    }
  }
}

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email =
      (sessionClaims?.email as string) ||
      (sessionClaims?.primaryEmail as string) ||
      "";

    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    // ── Fallback: if clerkId not found (e.g. after switching test→live keys),
    //    try to find the existing record by email and migrate the clerkId ──
    if (!user && email) {
      user = await User.findOne({ email });
      if (user) {
        console.log(`[Profile] Migrating clerkId for ${email}: ${user.clerkId} → ${userId}`);
        user.clerkId = userId;
        await user.save();
      }
    }

    // Still not found — auto-create
    if (!user) {
      const isAdmin = ADMIN_EMAILS.includes(email);
      user = await User.create({
        clerkId: userId,
        email,
        plan: isAdmin ? "pro" : "free",
        planStatus: isAdmin ? "active" : "none",
        planActivatedAt: isAdmin ? new Date() : undefined,
        planExpiresAt: isAdmin
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : undefined,
      });
    }

    // Reset daily counters if a new day has started (UTC)
    const didReset = resetDailyIfNeeded(user);
    if (didReset) await user.save();

    const now = new Date();
    const expiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    return NextResponse.json({
      plan: user.plan,
      planStatus: user.planStatus ?? "none",

      // All-time totals
      directTtsCount:  user.directTtsCount  ?? 0,
      aiScriptCount:   user.aiScriptCount   ?? 0,
      broadcastCount:  user.broadcastCount  ?? 0,
      imageCount:      user.imageCount      ?? 0,
      musicCount:      user.musicCount      ?? 0,

      // Daily counters + limits (for UI progress bars)
      dailyDirectTtsCount:  getDailyCount(user, "direct"),
      dailyAiScriptCount:   getDailyCount(user, "aiScript"),
      dailyBroadcastCount:  getDailyCount(user, "broadcast"),
      dailyImageCount:      getDailyCount(user, "image"),
      proLimits: {
        directTts:  getProDailyLimit("direct"),
        aiScript:   getProDailyLimit("aiScript"),
        broadcast:  getProDailyLimit("broadcast"),
        image:      getProDailyLimit("image"),
      },

      hasOwnApiKey: !!user.ownApiKey,
      ownApiKey: user.ownApiKey ? decrypt(user.ownApiKey) : null,
      planActivatedAt: user.planActivatedAt?.toISOString() ?? null,
      planExpiresAt: expiresAt?.toISOString() ?? null,
      daysLeft,
      paymentCount: user.paymentHistory?.length ?? 0,
    });
  } catch (err: any) {
    console.error("[Profile GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
