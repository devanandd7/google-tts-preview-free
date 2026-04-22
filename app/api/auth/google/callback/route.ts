import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google-drive";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // We passed userId as state

  if (!code || !userId) {
    return new NextResponse("Invalid request", { status: 400 });
  }

  try {
    await connectDB();
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // If no refresh token, we might need to ask the user to re-consent
      // But usually 'prompt: consent' handles this
    }

    oauth2Client.setCredentials(tokens);

    // Get user email from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Save to user profile
    await User.findOneAndUpdate(
      { clerkId: userId },
      {
        driveRefreshToken: tokens.refresh_token,
        driveEmail: email,
        driveEnabled: true
      }
    );

    // Redirect back to settings/sidebar using the request's origin to avoid hardcoded localhost
    const redirectUrl = new URL("/studio", req.url);
    redirectUrl.searchParams.set("drive_success", "true");
    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("[Google OAuth Callback Error]", error.response?.data || error.message);
    const redirectUrl = new URL("/studio", req.url);
    redirectUrl.searchParams.set("drive_error", "true");
    return NextResponse.redirect(redirectUrl);
  }
}
