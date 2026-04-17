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

  return (
    status === 503 ||
    status === 429 ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
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
  if (exhausted || isOverloadError(err)) {
    const e = new Error(
      "Gemini is currently experiencing high demand. We retried automatically but the service is still overloaded. Please wait 30–60 seconds and try again."
    );
    (e as any).code = "OVERLOADED";
    (e as any).retryAfter = 30;
    return e;
  }

  const msg: string = err?.message || err?.toString() || "Unknown error";

  if (msg.toLowerCase().includes("api_key") || msg.toLowerCase().includes("api key")) {
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
