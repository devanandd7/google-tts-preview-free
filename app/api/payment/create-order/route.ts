import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { PRO_PRICE_PAISE } from "@/lib/constants";

export async function POST() {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "dummy",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy",
    });

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ clerkId: userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.plan === "pro") {
      return NextResponse.json({ error: "Already on Pro plan" }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount: PRO_PRICE_PAISE,
      currency: "INR",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: { clerkId: userId },
    });

    // Save order ID to user
    user.razorpayOrderId = order.id;
    await user.save();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error("[Create Order]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
