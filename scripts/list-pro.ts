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
  
  const proUsers = await User.find({ 
    $or: [
      { plan: "pro" },
      { planStatus: "active" }
    ]
  }).select("email plan planStatus planExpiresAt clerkId createdAt");
  
  console.log("\n==================================================");
  console.log("           GENBOX PRO USERS DIRECTORY           ");
  console.log("==================================================\n");

  if (proUsers.length === 0) {
    console.log("No pro users found in the database.");
  } else {
    proUsers.forEach((u, i) => {
      const expiry = u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString() : "N/A";
      const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A";
      console.log(`${i + 1}. [${u.plan.toUpperCase()}] ${u.email}`);
      console.log(`   Status:  ${u.planStatus}`);
      console.log(`   Joined:  ${created}`);
      console.log(`   Expires: ${expiry}`);
      console.log(`   ClerkID: ${u.clerkId}`);
      console.log("--------------------------------------------------");
    });
  }
  
  console.log(`\nTotal Pro/Active Users: ${proUsers.length}`);
  console.log("==================================================\n");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
