import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { driveEnabled, driveToggles, driveFolderId } = await req.json();
    
    await connectDB();
    const updateData: any = {};
    if (typeof driveEnabled === 'boolean') updateData.driveEnabled = driveEnabled;
    if (driveToggles) updateData.driveToggles = driveToggles;
    if (driveFolderId !== undefined) updateData.driveFolderId = driveFolderId;

    await User.findOneAndUpdate(
      { clerkId: userId },
      updateData,
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "Google Drive configuration saved successfully." });
  } catch (error: any) {
    console.error("[Save Drive Config Error]", error);
    return NextResponse.json({ error: error.message || "Failed to save configuration" }, { status: 500 });
  }
}
