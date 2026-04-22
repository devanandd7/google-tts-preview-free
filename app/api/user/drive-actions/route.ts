import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { decrypt } from "@/lib/encryption";
import { getGoogleAuth, createBackupFolder } from "@/lib/google-drive";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await req.json();

    await connectDB();
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "disconnect") {
      user.ownDriveKey = undefined;
      user.driveRefreshToken = undefined;
      user.driveEmail = undefined;
      user.driveFolderId = undefined;
      await user.save();
      return NextResponse.json({ success: true, message: "Drive disconnected" });
    }

    if (action === "create-folder") {
      const jsonKey = user.ownDriveKey ? decrypt(user.ownDriveKey) : undefined;
      const authObj = await getGoogleAuth(jsonKey, user.driveRefreshToken);
      const folderId = await createBackupFolder(authObj);
      
      user.driveFolderId = folderId;
      await user.save();
      
      return NextResponse.json({ success: true, folderId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Drive Actions Error]", error);
    return NextResponse.json({ error: error.message || "Action failed" }, { status: 500 });
  }
}
