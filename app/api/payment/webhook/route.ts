import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { PRO_DURATION_MS, PRO_PRICE_PAISE } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Razorpay Webhook Handler
 * 
 * This is the ROBUST way to handle payments. 
 * Even if the user closes their browser, Razorpay sends a server-to-server 
 * notification here to ensure the user gets their Pro plan.
 */
export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-razorpay-signature");
    const rawBody = await req.text();

    // Use Webhook Secret from environment (User needs to set this in Razorpay Dashboard)
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured in .env.local");
      return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
    }

    // 1. Verify that the request actually came from Razorpay
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("[Webhook] Signature verification failed. Unauthorized request.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    console.log(`[Webhook] Processing event: ${event.event}`);

    // 2. Handle successful payment
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const clerkId = payment.notes?.clerkId; // We passed this in create-order/route.ts

      if (!clerkId) {
        console.error("[Webhook] No clerkId found in payment notes. Cannot identify user.");
        return NextResponse.json({ status: "ignored", reason: "no_clerk_id" });
      }

      await connectDB();
      const user = await User.findOne({ clerkId });

      if (!user) {
        console.error(`[Webhook] User with clerkId ${clerkId} not found in DB.`);
        return NextResponse.json({ status: "ignored", reason: "user_not_found" });
      }

      // 3. Prevent duplicate processing (in case verify API already ran)
      const isAlreadyProcessed = user.paymentHistory.some(p => p.razorpayPaymentId === paymentId);
      if (isAlreadyProcessed) {
        console.log(`[Webhook] Payment ${paymentId} already processed for ${user.email}. Skipping.`);
        return NextResponse.json({ status: "ok", message: "already_processed" });
      }

      // 4. Upgrade User to Pro
      const now = new Date();
      const expiresAt = new Date(now.getTime() + PRO_DURATION_MS);

      user.plan = "pro";
      user.planStatus = "active";
      user.planActivatedAt = now;
      user.planExpiresAt = expiresAt;
      user.razorpayPaymentId = paymentId;
      user.razorpayOrderId = orderId;

      user.paymentHistory.push({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amountPaise: payment.amount || PRO_PRICE_PAISE,
        currency: payment.currency || "INR",
        paidAt: now,
        planActivatedAt: now,
        planExpiresAt: expiresAt,
      });

      await user.save();
      console.log(`[Webhook] Success: Upgraded ${user.email} to Pro until ${expiresAt.toISOString()}`);
    }

    // Always return 200 to Razorpay to acknowledge receipt
    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("[Webhook Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
