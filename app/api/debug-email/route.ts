import { NextResponse } from "next/server";
import { sendEmail, getFreeWelcomeTemplate } from "@/lib/mail";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Provide ?email=... query param" }, { status: 400 });
  }

  console.log("[Debug Email] Sending test email to:", email);
  const result = await sendEmail(
    email, 
    "GenBox Test Email 🧪", 
    getFreeWelcomeTemplate("Test User")
  );

  return NextResponse.json(result);
}
