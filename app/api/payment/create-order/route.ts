import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { PRO_PRICE_PAISE } from "@/lib/constants";

/** Helper: is the user's pro plan still valid right now? */
function isPlanActive(user: any): boolean {
  if (user.plan !== "pro") return false;
  if (!user.planExpiresAt) return false;
  return new Date(user.planExpiresAt) > new Date();
}

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Payment gateway not configured. Please contact support." },
        { status: 503 }
      );
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    await connectDB();
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Block if they already have an active (non-expired) pro plan
    if (isPlanActive(user)) {
      return NextResponse.json(
        { error: "You already have an active Pro plan.", alreadyPro: true },
        { status: 400 }
      );
    }

    const receipt = `rcpt_${userId.slice(-8)}_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: PRO_PRICE_PAISE,
      currency: "INR",
      receipt,
      notes: {
        clerkId: userId,
        email: user.email || "",
        type: user.plan === "pro" ? "renewal" : "upgrade",
      },
    });

    // Persist the pending order ID
    user.razorpayOrderId = order.id;
    await user.save();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      isRenewal: user.plan === "pro", // so UI can tailor messaging
    });
  } catch (err: any) {
    console.error("[Create Order]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
