import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { PRO_DURATION_MS, PRO_PRICE_PAISE } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment fields" },
        { status: 400 }
      );
    }

    // ── Verify HMAC signature ──────────────────────────────────────────────
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid payment signature — possible tampering detected." },
        { status: 400 }
      );
    }

    // ── Update user in DB ──────────────────────────────────────────────────
    await connectDB();
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PRO_DURATION_MS);

    // Store full payment record for audit / future reference
    user.paymentHistory.push({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amountPaise: PRO_PRICE_PAISE,
      currency: "INR",
      paidAt: now,
      planActivatedAt: now,
      planExpiresAt: expiresAt,
    });

    // Activate / renew Pro
    user.plan = "pro";
    user.planStatus = "active";
    user.razorpayPaymentId = razorpay_payment_id;
    user.razorpayOrderId = razorpay_order_id;
    user.planActivatedAt = now;
    user.planExpiresAt = expiresAt;

    await user.save();

    return NextResponse.json({
      success: true,
      plan: "pro",
      planActivatedAt: now.toISOString(),
      planExpiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error("[Verify Payment]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
