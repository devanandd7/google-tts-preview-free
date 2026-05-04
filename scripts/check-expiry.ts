import { connectDB } from "../lib/mongodb";
import User from "../models/User";
import { sendEmail, getExpiryWarningTemplate } from "../lib/mail";

/**
 * Run this script via a Cron Job (e.g., daily at 9 AM)
 * It checks for users whose Pro plan expires in exactly 3 days.
 */
async function checkExpirations() {
  console.log("[Expiry Check] Starting daily scan...");
  await connectDB();

  const threeDaysFromNowStart = new Date();
  threeDaysFromNowStart.setDate(threeDaysFromNowStart.getDate() + 3);
  threeDaysFromNowStart.setHours(0, 0, 0, 0);

  const threeDaysFromNowEnd = new Date();
  threeDaysFromNowEnd.setDate(threeDaysFromNowEnd.getDate() + 3);
  threeDaysFromNowEnd.setHours(23, 59, 59, 999);

  const usersToWarn = await User.find({
    plan: "pro",
    planExpiresAt: {
      $gte: threeDaysFromNowStart,
      $lte: threeDaysFromNowEnd,
    },
  });

  console.log(`[Expiry Check] Found ${usersToWarn.length} users to warn.`);

  for (const user of usersToWarn) {
    const html = getExpiryWarningTemplate(user.name || "GenBox User", 3);
    await sendEmail(user.email, "Action Required: Your Pro Plan is expiring soon!", html);
    console.log(`[Expiry Check] Warning sent to ${user.email}`);
  }

  console.log("[Expiry Check] Scan complete.");
  process.exit(0);
}

checkExpirations().catch(err => {
  console.error("[Expiry Check Error]", err);
  process.exit(1);
});
