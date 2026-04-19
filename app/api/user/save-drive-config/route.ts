import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { encrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jsonKey, driveEnabled, driveToggles, driveFolderId } = await req.json();
    
    let encryptedKey = undefined;
    if (jsonKey) {
      try {
        const parsed = JSON.parse(jsonKey);
        if (parsed.type !== "service_account") {
          return NextResponse.json({ error: "Invalid JSON format. Must be a service_account key." }, { status: 400 });
        }
        encryptedKey = encrypt(jsonKey);
      } catch (e) {
        return NextResponse.json({ error: "Invalid JSON format." }, { status: 400 });
      }
    }

    await connectDB();
    const updateData: any = {};
    if (encryptedKey) updateData.ownDriveKey = encryptedKey;
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
