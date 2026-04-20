import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import Razorpay from "razorpay";
import User from "../models/User";
import { PRO_DURATION_MS, PRO_PRICE_PAISE } from "../lib/constants";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const MONGODB_URL = process.env.MONGODB_URL;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

async function run() {
  if (!MONGODB_URL || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Missing configuration in .env.local");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URL, { dbName: "voicegen" });
  
  const rzp = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });

  console.log("Fetching captured payments from Razorpay...");
  const rzpPayments = await rzp.payments.all({ count: 50 });
  const capturedPayments = rzpPayments.items.filter(p => p.status === "captured");

  const users = await User.find({}).select("email paymentHistory clerkId");
  const dbPaymentIds = new Set();
  users.forEach(u => {
    u.paymentHistory.forEach(p => dbPaymentIds.add(p.razorpayPaymentId));
  });

  console.log(`Found ${capturedPayments.length} captured payments on Razorpay.`);
  console.log(`Found ${dbPaymentIds.size} payments already synced in DB.\n`);

  let upgradedCount = 0;

  for (const p of capturedPayments) {
    if (dbPaymentIds.has(p.id)) continue;

    const email = p.email || (p as any).notes?.email;
    const clerkId = (p as any).notes?.clerkId;

    if (!email && !clerkId) {
      console.log(`[Skip] Payment ${p.id} has no email or clerkId metadata.`);
      continue;
    }

    // Try to find user by clerkId or email
    let user = null;
    if (clerkId) user = await User.findOne({ clerkId });
    if (!user && email) user = await User.findOne({ email });

    if (!user) {
      console.log(`[Skip] Payment ${p.id} belongs to ${email || clerkId}, but no user record exists in DB.`);
      continue;
    }

    console.log(`[Syncing] Upgrading ${user.email} for payment ${p.id}...`);

    const paidAt = new Date(p.created_at * 1000);
    const expiresAt = new Date(paidAt.getTime() + PRO_DURATION_MS);

    user.plan = "pro";
    user.planStatus = "active";
    user.planActivatedAt = paidAt;
    user.planExpiresAt = expiresAt;
    user.razorpayPaymentId = p.id;
    user.razorpayOrderId = p.order_id;

    user.paymentHistory.push({
      razorpayOrderId: p.order_id,
      razorpayPaymentId: p.id,
      amountPaise: (typeof p.amount === 'string' ? parseInt(p.amount) : p.amount) || PRO_PRICE_PAISE,
      currency: p.currency || "INR",
      paidAt: paidAt,
      planActivatedAt: paidAt,
      planExpiresAt: expiresAt,
    });

    await user.save();
    upgradedCount++;
  }

  console.log(`\n==================================================`);
  console.log(`           SMART SYNC COMPLETED                  `);
  console.log(`==================================================`);
  console.log(`- Total Missing Payments Fixed: ${upgradedCount}`);
  console.log(`==================================================\n`);

  await mongoose.disconnect();
}

run().catch(console.error);
