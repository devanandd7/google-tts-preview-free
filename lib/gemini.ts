/**
 * Gemini API retry utility with exponential backoff.
 * Handles 503 (UNAVAILABLE) and 429 (RESOURCE_EXHAUSTED) gracefully.
 */

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1200; // 1.2s initial backoff

/** Checks if a Gemini/fetch error is a transient overload (503/429) */
export function isOverloadError(err: any): boolean {
  const msg: string = (err?.message || err?.toString() || "").toLowerCase();
  const status = err?.status ?? err?.code;

  if (msg.includes("exceeded your current quota") || msg.includes("quota exceeded for metric")) {
    return false; // Hard quota limit, do not retry
  }

  return (
    status === 503 ||
    status === 429 ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    // Only match soft overload quota errors, not hard exhausted quota
    (msg.includes("quota") && !msg.includes("exceeded your current quota") && !msg.includes("quota exceeded for metric")) ||
    msg.includes("overloaded")
  );
}

/** Sleep helper */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fn` up to MAX_RETRIES times with exponential backoff on transient errors.
 * Re-throws a classified error on exhaustion or non-retryable failure.
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      if (!isOverloadError(err)) {
        // Non-retryable — rethrow immediately
        throw classifyGeminiError(err);
      }

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1.2s → 2.4s → 4.8s (with ±20% jitter)
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4);
        console.warn(
          `[Gemini] Overloaded (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms…`
        );
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw classifyGeminiError(lastError, true);
}

/** Converts raw Gemini errors into user-friendly, front-end readable errors */
export function classifyGeminiError(err: any, exhausted = false): Error {
  const msg: string = err?.message || err?.toString() || "Unknown error";

  // Check for hard quota limit first
  if (msg.toLowerCase().includes("exceeded your current quota") || msg.toLowerCase().includes("quota exceeded for metric") || msg.toLowerCase().includes("429")) {
    const e = new Error("Gemini API quota exceeded or rate limit hit. Your current key is temporarily exhausted.");
    (e as any).code = "QUOTA_EXCEEDED";
    return e;
  }

  if (exhausted || isOverloadError(err)) {
    const e = new Error(
      "Gemini is currently experiencing high demand (Overloaded). We retried automatically but the service is still busy. Please wait 30–60 seconds."
    );
    (e as any).code = "OVERLOADED";
    (e as any).retryAfter = 30;
    return e;
  }

  if (msg.toLowerCase().includes("api_key") || msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("invalid")) {
    const e = new Error("Invalid or missing Gemini API key. Please check your key in Pro Settings.");
    (e as any).code = "INVALID_KEY";
    return e;
  }

  if (msg.toLowerCase().includes("safety") || msg.toLowerCase().includes("blocked")) {
    const e = new Error("Your content was blocked by Gemini's safety filters. Please revise your script.");
    (e as any).code = "SAFETY_BLOCK";
    return e;
  }

  const e = new Error(msg || "Something went wrong with the AI service. Please try again.");
  (e as any).code = "UNKNOWN";
  return e;
}
