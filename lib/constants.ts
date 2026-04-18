// ── Free tier all-time limits ─────────────────────────────────────────────────
export const FREE_DIRECT_TTS_LIMIT = 3;
export const FREE_AI_SCRIPT_LIMIT  = 2;

// ── Pro tier daily limits (reset each UTC day) ────────────────────────────────
export const PRO_DAILY_DIRECT_TTS_LIMIT  = 9;
export const PRO_DAILY_AI_SCRIPT_LIMIT   = 9;
export const PRO_DAILY_BROADCAST_LIMIT   = 5;
export const PRO_DAILY_IMAGE_LIMIT       = 21;

// ── Pricing ───────────────────────────────────────────────────────────────────
export const PRO_PRICE_INR   = 49;                     // ₹49/month
export const PRO_PRICE_PAISE = PRO_PRICE_INR * 100;   // Razorpay uses paise

// ── Subscription duration ─────────────────────────────────────────────────────
export const PRO_DURATION_DAYS = 30;
export const PRO_DURATION_MS   = PRO_DURATION_DAYS * 24 * 60 * 60 * 1000;
