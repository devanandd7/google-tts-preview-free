import Razorpay from "razorpay";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function test() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  console.log("Key ID:", key_id);
  console.log("Key Secret:", key_secret);

  if (!key_id || !key_secret) {
    console.error("Missing keys");
    return;
  }

  const razorpay = new Razorpay({
    key_id: key_id.trim(),
    key_secret: key_secret.trim(),
  });

  try {
    console.log("Attempting to create a test order...");
    const order = await razorpay.orders.create({
      amount: 100, // 1 INR
      currency: "INR",
      receipt: "test_receipt",
    });
    console.log("Order created successfully:", order.id);
  } catch (error: any) {
    console.error("Error creating order:", error);
    if (error.error) {
      console.error("Razorpay Error Details:", JSON.stringify(error.error, null, 2));
    }
  }
}

test();
