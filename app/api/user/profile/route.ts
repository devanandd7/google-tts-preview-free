import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      // Auto-create user record on first visit
      const email =
        (sessionClaims?.email as string) ||
        (sessionClaims?.primaryEmail as string) ||
        "";
      const isAdmin = email === "devanandutkarsh7@gail.com" || email === "devanandutkarsh7@gmail.com";
      user = await User.create({ clerkId: userId, email, plan: isAdmin ? "pro" : "free" });
    } else {
       // Just in case existing user logs in and is admin, force plan to pro
       const email =
        (sessionClaims?.email as string) ||
        (sessionClaims?.primaryEmail as string) ||
        user.email || "";
       const isAdmin = email === "devanandutkarsh7@gail.com" || email === "devanandutkarsh7@gmail.com";
       if (isAdmin && user.plan !== "pro") {
         user.plan = "pro";
         await user.save();
       }
    }

    return NextResponse.json({
      plan: user.plan,
      directTtsCount: user.directTtsCount,
      aiScriptCount: user.aiScriptCount,
      hasOwnApiKey: !!user.ownApiKey,
      planActivatedAt: user.planActivatedAt,
    });
  } catch (err: any) {
    console.error("[Profile GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
