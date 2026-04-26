// lib/tts-tags.ts
//
// RESEARCH FINDING (Google AI / Gemini TTS):
// Gemini 3.1 Flash TTS does NOT have a fixed closed list of tags.
// It interprets natural language style descriptors with 200+ recognized tags.
// Source: Google AI documentation & community research.
//
// STRATEGY: Do NOT over-restrict. Use a broad set of known-good tags.
// The sanitizer only strips tags that are structurally broken or
// are known to cause literal readout (e.g. speaker labels).

// ─── Tags that are VERIFIED to work with Gemini TTS ────────────────────────
export const ALLOWED_TTS_TAGS = [
  // Delivery & Persona
  "professional", "conversational", "authoritative", "analytical",
  "narrative", "casual", "formal",

  // Core Emotions (Gemini natively supports all of these)
  "energetic", "serious", "urgent", "calm", "empathetic",
  "optimistic", "somber", "enthusiastic", "neutral", "warm",
  "determination", "enthusiasm", "admiration", "awe", "hope",
  "positive", "interest", "curiosity", "amusement", "excitement",

  // Pacing
  "slow", "fast", "emphasis", "louder", "softer",

  // Human Inflections
  "thoughtful", "questioning", "sigh", "sighs", "chuckle",
  "laughs", "whispers",

  // Pause variants — ALL will be converted to "..." by sanitizer
  // Listed here so validateScript doesn't warn about them
  "pause", "short pause", "long pause",
];

// ─── Legacy / variant tag mapping ──────────────────────────────────────────
// Maps tags the LLM sometimes hallucinates → safe equivalents
const TAG_MAPPING: Record<string, string> = {
  // Pause underscore/space variants
  "long_pause":  "long pause",
  "short_pause": "short pause",

  // Common LLM hallucinations
  "engaged":      "enthusiastic",
  "informative":  "professional",
  "confident":    "authoritative",
  "care":         "empathetic",
  "gratitude":    "warm",
  "happy":        "enthusiasm",
  "excited":      "enthusiastic",
  "sad":          "somber",
  "angry":        "determination",
  "surprised":    "awe",
  "cheerful":     "optimistic",
  "breaking_news":"authoritative",
  "rhythmic":     "enthusiastic",
  "staccato":     "emphasis",
  "breath":       "thoughtful",
  "inhale":       "thoughtful",
  "amused":       "amusement",
};

export const getTagsString = () =>
  [
    // The actual working set we want the LLM to use
    "[professional]", "[conversational]", "[authoritative]", "[analytical]",
    "[energetic]", "[serious]", "[urgent]", "[calm]", "[empathetic]",
    "[optimistic]", "[warm]", "[enthusiastic]", "[neutral]",
    "[determination]", "[enthusiasm]", "[admiration]", "[awe]", "[hope]",
    "[interest]", "[curiosity]", "[amusement]",
    "[slow]", "[fast]", "[emphasis]", "[louder]", "[softer]",
    "[thoughtful]", "[sighs]", "[laughs]", "[whispers]",
    "[short pause]", "[long pause]",
  ].join(", ");

// ─── Sanitizer ──────────────────────────────────────────────────────────────
// Applied right before sending to TTS API.
// Converts pause variants to ellipsis (natural breathing pause).
// Maps legacy tags. Strips truly unknown/broken tags.
export function sanitizeScriptTags(rawScript: string): string {
  return rawScript.replace(/\[([a-zA-Z0-9_\-\s]+)(?:=[^\]]+)?\]/g, (match, tagContent) => {
    const cleanTag = tagContent.trim().toLowerCase();

    // ── PAUSE → Ellipsis ────────────────────────────────────────────────────
    // TTS reads "[pause]" literally. Ellipsis triggers a natural breath.
    if (
      cleanTag === "pause" ||
      cleanTag === "short pause" || cleanTag === "short_pause" ||
      cleanTag === "long pause"  || cleanTag === "long_pause"  ||
      cleanTag.startsWith("pause=")
    ) {
      return "... ";
    }

    // ── Valid tag → keep ────────────────────────────────────────────────────
    if (ALLOWED_TTS_TAGS.includes(cleanTag)) {
      return match;
    }

    // ── Legacy/variant → remap ──────────────────────────────────────────────
    if (TAG_MAPPING[cleanTag]) {
      return `[${TAG_MAPPING[cleanTag]}]`;
    }

    // ── Unknown → strip ─────────────────────────────────────────────────────
    // Better to remove silently than have TTS read "[xyz]" aloud.
    return "";
  });
}

// ─── Speaker label stripper ─────────────────────────────────────────────────
// Removes "[Ananya: ]" or "Ananya: " prefixes before TTS call.
export function stripSpeakerLabels(script: string): string {
  return script.replace(/^\[?[\w\s\u0900-\u097F]+(:\]?|:)\s*/gm, "");
}