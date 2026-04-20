import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import User from "../models/User";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const MONGODB_URL = process.env.MONGODB_URL;

async function run() {
  if (!MONGODB_URL) {
    console.error("MONGODB_URL not found");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URL, { dbName: "voicegen" });
  
  const allUsers = await User.find({}).select("email plan planStatus paymentHistory createdAt");
  
  console.log(`\nFound ${allUsers.length} total users in database.\n`);

  let paidCount = 0;
  allUsers.forEach((u, i) => {
    const payments = u.paymentHistory?.length || 0;
    if (payments > 0) paidCount++;
    
    console.log(`${i + 1}. ${u.email || 'No Email'}`);
    console.log(`   Plan: ${u.plan} (${u.planStatus})`);
    console.log(`   Payments: ${payments} recorded`);
    console.log(`   Created: ${u.createdAt?.toLocaleDateString()}`);
    console.log("--------------------------------------------------");
  });

  console.log(`\nSummary:`);
  console.log(`- Total Users: ${allUsers.length}`);
  console.log(`- Users with Payments: ${paidCount}`);
  
  await mongoose.disconnect();
}

run().catch(console.error);
