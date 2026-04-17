import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { encrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey } = await req.json();

    await connectDB();
    const user = await User.findOne({ clerkId: userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.plan !== "pro") {
      return NextResponse.json({ error: "Only Pro users can add an API key" }, { status: 403 });
    }

    // Encrypt before saving if present
    const rawKey = apiKey?.trim() || "";
    user.ownApiKey = rawKey ? encrypt(rawKey) : "";
    await user.save();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
