import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME admin endpoint to fix Pro user after test→live Clerk key migration.
 * Protected by a secret token. Call once then you can leave it.
 *
 * Usage:
 *   GET /api/admin/fix-pro-user?secret=genbox_fix_2024
 *
 * What it does:
 *   1. Gets your current Clerk live userId + email
 *   2. Searches DB by email for the old Pro record
 *   3. Updates clerkId to the new live one
 *   4. If no record found — creates a new Pro record
 */
export async function GET(req: NextRequest) {
  // Simple secret guard
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "genbox_fix_2024") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  // Fetch real email from Clerk backend
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const email =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? "";

  await connectDB();

  // Check if already exists by live clerkId
  let user = await User.findOne({ clerkId: userId });
  let action = "";

  if (user) {
    // Force upgrade to Pro regardless of current plan
    user.plan = "pro";
    user.planStatus = "active";
    if (!user.planActivatedAt) user.planActivatedAt = new Date();
    if (!user.planExpiresAt || new Date(user.planExpiresAt) < new Date()) {
      user.planExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }
    await user.save();
    action = `Found by clerkId (was: ${user.plan}) → upgraded to Pro`;
  } else if (email) {
    // Try to find by email (old test-mode record)
    user = await User.findOne({ email });
    if (user) {
      const oldClerkId = user.clerkId;
      user.clerkId = userId;
      user.plan = "pro";
      user.planStatus = "active";
      if (!user.planExpiresAt) {
        user.planExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }
      await user.save();
      action = `Migrated clerkId from ${oldClerkId} → ${userId} and confirmed Pro plan`;
    }
  }

  if (!user) {
    // Create fresh Pro record
    user = await User.create({
      clerkId: userId,
      email,
      plan: "pro",
      planStatus: "active",
      planActivatedAt: new Date(),
      planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    action = `Created new Pro record for ${email}`;
  }

  return NextResponse.json({
    success: true,
    action,
    clerkId: userId,
    email,
    plan: user.plan,
    planStatus: user.planStatus,
    planExpiresAt: user.planExpiresAt,
    message: "✅ Done! Refresh the studio page now.",
  });
}
