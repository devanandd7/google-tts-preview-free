import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import User from "../models/User";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const MONGODB_URL = process.env.MONGODB_URL;

async function run() {
  if (!MONGODB_URL) {
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URL, { dbName: "voicegen" });
  
  const paymentId = "pay_SfXWzRd6jllAEY";
  const orderId = "order_SfXWpZllPEoUlf";
  
  console.log(`Searching for Payment ID: ${paymentId} or Order ID: ${orderId}...`);

  const userByPaymentId = await User.findOne({ "paymentHistory.razorpayPaymentId": paymentId });
  const userByOrderId = await User.findOne({ razorpayOrderId: orderId });
  const userByEmail = await User.findOne({ email: "crosseye315@gmail.com" });

  if (userByPaymentId) {
    console.log("Found user by Payment ID:", userByPaymentId.email);
  } else {
    console.log("No user found with this Payment ID in history.");
  }

  if (userByOrderId) {
    console.log("Found user by Order ID field:", userByOrderId.email, "| Plan:", userByOrderId.plan);
  } else {
    console.log("No user found with this Order ID in the main field.");
  }

  if (userByEmail) {
    console.log("\nUser 'crosseye315@gmail.com' Details:");
    console.log("Plan:", userByEmail.plan);
    console.log("Status:", userByEmail.planStatus);
    console.log("Payment History Length:", userByEmail.paymentHistory?.length);
    console.log("Main RazorpayOrderId field:", userByEmail.razorpayOrderId);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
