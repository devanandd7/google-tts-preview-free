import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

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
    const isAdmin = ADMIN_EMAILS.includes(email);

    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      // First visit — auto-create record
      user = await User.create({
        clerkId: userId,
        email,
        plan: isAdmin ? "pro" : "free",
        planStatus: isAdmin ? "active" : "none",
        planActivatedAt: isAdmin ? new Date() : undefined,
        planExpiresAt: isAdmin
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // admin gets 1-year
          : undefined,
      });
    } else {
      // Ensure admin is always pro
      const currentEmail = email || user.email || "";
      if (ADMIN_EMAILS.includes(currentEmail) && user.plan !== "pro") {
        user.plan = "pro";
        user.planStatus = "active";
        if (!user.planExpiresAt) {
          user.planExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }
        await user.save();
      } else {
        // Auto-expire check for non-admins
        await checkAndExpirePlan(user);
      }
    }

    const now = new Date();
    const expiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    return NextResponse.json({
      plan: user.plan,
      planStatus: user.planStatus ?? "none",
      directTtsCount: user.directTtsCount,
      aiScriptCount: user.aiScriptCount,
      hasOwnApiKey: !!user.ownApiKey,
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
