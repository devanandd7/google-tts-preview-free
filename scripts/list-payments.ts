import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import User from "../models/User";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const MONGODB_URL = process.env.MONGODB_URL;

async function run() {
  if (!MONGODB_URL) {
    console.error("MONGODB_URL not found in .env.local");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URL, { dbName: "voicegen" });
  
  const users = await User.find({ "paymentHistory.0": { $exists: true } }).select("email paymentHistory");
  
  const allPayments: any[] = [];
  users.forEach(u => {
    u.paymentHistory.forEach(p => {
      allPayments.push({
        email: u.email,
        orderId: p.razorpayOrderId,
        paymentId: p.razorpayPaymentId,
        amount: (p.amountPaise || 0) / 100,
        paidAt: p.paidAt,
        planExpiresAt: p.planExpiresAt
      });
    });
  });

  // Sort by date descending
  allPayments.sort((a, b) => {
    const dateA = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const dateB = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return dateB - dateA;
  });

  console.log("\n==================================================");
  console.log("           GENBOX PAYMENT HISTORY                ");
  console.log("==================================================\n");

  if (allPayments.length === 0) {
    console.log("No payments found in the database.");
  } else {
    allPayments.forEach((p, i) => {
      const dateStr = p.paidAt ? new Date(p.paidAt).toLocaleString() : "N/A";
      console.log(`${i + 1}. User: ${p.email}`);
      console.log(`   Amount:  ₹${p.amount}`);
      console.log(`   Date:    ${dateStr}`);
      console.log(`   Order:   ${p.orderId}`);
      console.log(`   PayID:   ${p.paymentId}`);
      console.log("--------------------------------------------------");
    });
  }
  
  console.log(`\nTotal Transactions: ${allPayments.length}`);
  console.log("==================================================\n");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
