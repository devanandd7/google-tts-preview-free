import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import User from "../models/User";
import { PRO_PRICE_PAISE } from "../lib/constants";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const MONGODB_URL = process.env.MONGODB_URL;

async function run() {
  if (!MONGODB_URL) {
    console.error("MONGODB_URL not found");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URL, { dbName: "voicegen" });
  
  const email = "crosseye315@gmail.com";
  const user = await User.findOne({ email });

  if (!user) {
    console.error(`User ${email} not found in database!`);
    process.exit(1);
  }

  console.log(`Upgrading ${email}...`);
  console.log(`Current Plan: ${user.plan} (${user.planStatus})`);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const record = {
    razorpayOrderId: "order_SfXWpZllPEoUlf",
    razorpayPaymentId: "pay_SfXWzRd6jllAEY",
    amountPaise: PRO_PRICE_PAISE,
    currency: "INR",
    paidAt: now,
    planActivatedAt: now,
    planExpiresAt: expiresAt
  };

  user.plan = "pro";
  user.planStatus = "active";
  user.planActivatedAt = now;
  user.planExpiresAt = expiresAt;
  
  // Add to history
  if (!user.paymentHistory) user.paymentHistory = [];
  user.paymentHistory.push(record as any);

  await user.save();

  console.log("\n✅ SUCCESS: User upgraded to PRO.");
  console.log(`   New Expiry: ${expiresAt.toLocaleString()}`);
  console.log(`   Payment ID: ${record.razorpayPaymentId} saved to history.`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
