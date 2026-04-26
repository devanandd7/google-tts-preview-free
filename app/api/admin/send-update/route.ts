import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { sendEmail, getUpdateTemplate } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    // Simple check: replace with your actual admin clerkId or a role check
    const isAdmin = userId === process.env.ADMIN_CLERK_ID;
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content } = await req.json();

    await connectDB();
    const users = await User.find({}, "email name");

    console.log(`[Admin] Sending update email to ${users.length} users...`);

    const emailHtml = getUpdateTemplate(title, content);

    // Send emails in batches or concurrently
    const emailPromises = users.map(user => 
      sendEmail(user.email, `GenBox Update: ${title}`, emailHtml)
    );

    await Promise.all(emailPromises);

    return NextResponse.json({ success: true, count: users.length });
  } catch (err: any) {
    console.error("[Admin Update Email]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
