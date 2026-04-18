/**
 * lib/usage.ts
 * Centralised daily-usage helpers for Pro users.
 *
 * Daily counters (dailyDirectTtsCount, dailyAiScriptCount, dailyBroadcastCount, dailyImageCount)
 * are stored on the User document and reset automatically whenever the UTC date changes.
 * All-time totals (directTtsCount, aiScriptCount, broadcastCount, imageCount, musicCount)
 * are never reset.
 */

import { IUser } from "@/models/User";
import {
  PRO_DAILY_DIRECT_TTS_LIMIT,
  PRO_DAILY_AI_SCRIPT_LIMIT,
  PRO_DAILY_BROADCAST_LIMIT,
  PRO_DAILY_IMAGE_LIMIT,
} from "@/lib/constants";

export type UsageType = "direct" | "aiScript" | "broadcast" | "image";

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Returns today's date string as "YYYY-MM-DD" in UTC */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the stored daily-reset date as "YYYY-MM-DD", or null */
function storedDate(user: IUser): string | null {
  if (!user.dailyUsageDate) return null;
  return new Date(user.dailyUsageDate).toISOString().slice(0, 10);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Resets all daily counters to 0 when the UTC date has changed.
 * Returns `true` when a reset occurred (caller should save the document).
 * Returns `false` when today's counters are still valid.
 *
 * Call this BEFORE reading or checking any daily counter.
 */
export function resetDailyIfNeeded(user: IUser): boolean {
  if (storedDate(user) !== todayUTC()) {
    user.dailyDirectTtsCount  = 0;
    user.dailyAiScriptCount   = 0;
    user.dailyBroadcastCount  = 0;
    user.dailyImageCount      = 0;
    user.dailyUsageDate       = new Date();
    return true;
  }
  return false;
}

/** Returns the daily limit for a Pro user for the given usage type */
export function getProDailyLimit(type: UsageType): number {
  switch (type) {
    case "direct":    return PRO_DAILY_DIRECT_TTS_LIMIT;
    case "aiScript":  return PRO_DAILY_AI_SCRIPT_LIMIT;
    case "broadcast": return PRO_DAILY_BROADCAST_LIMIT;
    case "image":     return PRO_DAILY_IMAGE_LIMIT;
  }
}

/** Returns the current daily count for the given type */
export function getDailyCount(user: IUser, type: UsageType): number {
  switch (type) {
    case "direct":    return user.dailyDirectTtsCount  ?? 0;
    case "aiScript":  return user.dailyAiScriptCount   ?? 0;
    case "broadcast": return user.dailyBroadcastCount  ?? 0;
    case "image":     return user.dailyImageCount      ?? 0;
  }
}

/**
 * Returns `true` if the Pro user has hit their daily limit for the given type.
 * Always call `resetDailyIfNeeded` first.
 */
export function isProDailyLimitReached(user: IUser, type: UsageType): boolean {
  return getDailyCount(user, type) >= getProDailyLimit(type);
}

/**
 * Increments BOTH the daily counter AND the all-time total for the given type.
 * Only call this AFTER a successful generation.
 */
export function incrementUsage(user: IUser, type: UsageType): void {
  switch (type) {
    case "direct":
      user.dailyDirectTtsCount = (user.dailyDirectTtsCount ?? 0) + 1;
      user.directTtsCount      = (user.directTtsCount      ?? 0) + 1;
      break;
    case "aiScript":
      user.dailyAiScriptCount  = (user.dailyAiScriptCount  ?? 0) + 1;
      user.aiScriptCount       = (user.aiScriptCount       ?? 0) + 1;
      break;
    case "broadcast":
      user.dailyBroadcastCount = (user.dailyBroadcastCount ?? 0) + 1;
      user.broadcastCount      = (user.broadcastCount      ?? 0) + 1;
      break;
    case "image":
      user.dailyImageCount     = (user.dailyImageCount     ?? 0) + 1;
      user.imageCount          = (user.imageCount          ?? 0) + 1;
      break;
  }
}
