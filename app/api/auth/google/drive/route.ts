import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOAuth2Client } from "@/lib/google-drive";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const oauth2Client = getOAuth2Client();

  // Scopes for full drive access (to find/create folders)
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  // Generate a secure random state or just use the userId for simplicity in this case
  // In production, use a more secure state token
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: userId,
  });

  return NextResponse.redirect(url);
}
