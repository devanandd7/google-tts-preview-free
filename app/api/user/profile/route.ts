import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
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

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Get the real email directly from Clerk backend (always reliable) ──
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? "";

    console.log(`[Profile] userId=${userId} email=${email}`);

    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    // ── Fallback: search by email (handles test→live Clerk key migration) ──
    if (!user && email) {
      user = await User.findOne({ email });
      if (user) {
        console.log(`[Profile] Migrating clerkId for ${email}: ${user.clerkId} → ${userId}`);
        user.clerkId = userId;
        await user.save();
      }
    }

    // ── Still not found — auto-create ──
    const isAdmin = ADMIN_EMAILS.includes(email);
    if (!user) {
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
    } else {
      // Always sync email and upgrade admin to Pro if not already
      let needsSave = false;
      if (user.email !== email) {
        user.email = email;
        needsSave = true;
      }
      if (isAdmin && user.plan !== "pro") {
        user.plan = "pro";
        user.planStatus = "active";
        needsSave = true;
      }
      if (needsSave) await user.save();
    }

    // ── Reset daily counters if new UTC day ──
    const didReset = resetDailyIfNeeded(user);
    if (didReset) await user.save();

    const now = new Date();
    const expiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // ── Ensure Admin always has Pro plan in the response ──
    const plan = isAdmin ? "pro" : (user.plan ?? "free");
    const planStatus = isAdmin ? "active" : (user.planStatus ?? "none");

    return NextResponse.json({
      plan,
      planStatus,
      isAdmin,
      email: user.email,

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
        directTts:  isAdmin ? 999999 : getProDailyLimit("direct"),
        aiScript:   isAdmin ? 999999 : getProDailyLimit("aiScript"),
        broadcast:  isAdmin ? 999999 : getProDailyLimit("broadcast"),
        image:      isAdmin ? 999999 : getProDailyLimit("image"),
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
