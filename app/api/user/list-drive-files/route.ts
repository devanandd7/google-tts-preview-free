import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { decrypt } from "@/lib/encryption";
import { listDriveFiles } from "@/lib/google-drive";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ clerkId: userId });

    if (!user || (!user.ownDriveKey && !user.driveRefreshToken)) {
      return NextResponse.json({ files: [] }); // Not configured yet
    }

    const jsonKey = user.ownDriveKey ? decrypt(user.ownDriveKey) : undefined;
    const driveResult = await listDriveFiles(jsonKey, user.driveFolderId, user.driveRefreshToken);

    if (driveResult.detectedFolderId && !user.driveFolderId) {
      user.driveFolderId = driveResult.detectedFolderId;
      await user.save();
    }

    return NextResponse.json({ 
      files: driveResult.files, 
      folderExists: driveResult.folderExists 
    });
  } catch (error: any) {
    console.error("[List Drive Files Error]", error);
    // If it's an auth error, maybe the key is invalid
    if (error.message?.includes("invalid_grant") || error.message?.includes("credentials")) {
        return NextResponse.json({ error: "Invalid Google Drive credentials. Please update them in settings.", code: "INVALID_CREDENTIALS" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to fetch Drive files" }, { status: 500 });
  }
}
