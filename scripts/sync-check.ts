import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import Razorpay from "razorpay";
import User from "../models/User";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const MONGODB_URL = process.env.MONGODB_URL;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

async function run() {
  if (!MONGODB_URL || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Missing configuration in .env.local");
    process.exit(1);
  }

  console.log("Connecting to Database and Razorpay API...\n");

  await mongoose.connect(MONGODB_URL, { dbName: "voicegen" });
  
  const rzp = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });

  // 1. Fetch Latest Payments from Razorpay (Online List)
  const rzpPayments = await rzp.payments.all({
    count: 20, // get last 20
  });

  const capturedPayments = rzpPayments.items.filter(p => p.status === "captured");

  // 2. Fetch all Payment History from MongoDB
  const usersWithPayments = await User.find({ "paymentHistory.0": { $exists: true } }).select("email paymentHistory");
  const dbPaymentIds = new Set();
  usersWithPayments.forEach(u => {
    u.paymentHistory.forEach(p => dbPaymentIds.add(p.razorpayPaymentId));
  });

  console.log("==================================================");
  console.log("       RAZORPAY (ONLINE) vs DATABASE (LOCAL)      ");
  console.log("==================================================\n");

  if (capturedPayments.length === 0) {
    console.log("No captured payments found in Razorpay.");
  } else {
    capturedPayments.forEach((p, i) => {
      const email = p.email || (p as any).notes?.email || "Unknown";
      const isSynced = dbPaymentIds.has(p.id);
      const amount = typeof p.amount === 'string' ? parseInt(p.amount) : p.amount;
      
      console.log(`${i + 1}. [${isSynced ? "SYNCED" : "MISSING"}]`);
      console.log(`   Email:      ${email}`);
      console.log(`   Amount:     ₹${(amount as number) / 100}`);
      console.log(`   Date:       ${new Date(p.created_at * 1000).toLocaleString()}`);
      console.log(`   Payment ID: ${p.id}`);
      console.log(`   Order ID:   ${p.order_id}`);
      console.log("--------------------------------------------------");
    });
  }

  const missingCount = capturedPayments.filter(p => !dbPaymentIds.has(p.id)).length;
  console.log(`\nSummary:`);
  console.log(`- Razorpay Captured: ${capturedPayments.length}`);
  console.log(`- Database Recorded: ${dbPaymentIds.size}`);
  console.log(`- DISCREPANCY (Missing in DB): ${missingCount}`);
  console.log("\n==================================================\n");

  await mongoose.disconnect();
}

run().catch(console.error);
