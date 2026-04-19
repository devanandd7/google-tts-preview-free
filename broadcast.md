# GenBox TTS: Script & Broadcast Logic Documentation

This document explains the internal logic for generating Audio from the "Script Page" (Single Voice) and "Broadcast Page" (Multi-Voice). It is designed to help debug future issues related to API limits, chunking, and voice consistency.

---

## 1. Single Voice (Script Page) Logic
**Endpoint:** `/api/generate/route.ts`

### How it works:
1. **Model Used:** `gemini-3.1-flash-tts-preview`
2. **Chunking Mechanism:** 
   - Gemini has a hard limit on how many characters it can process in a single request (around ~3000-4000 characters).
   - To bypass this, the server takes the full script and splits it into smaller pieces using the `chunkText` function (max 3000 characters per chunk).
3. **Execution:**
   - The server runs a `for` loop, sending each chunk to the Gemini API one by one.
   - Once all chunks return audio, the server stitches (concatenates) all the audio buffers together.
4. **User Experience:**
   - The user only sends **1 request** from the browser.
   - The user receives **1 complete audio file**.
   - No "API Exceed" errors happen because the payload size is always kept under the limit.

---

## 2. Multi-Voice Broadcast Logic
**Endpoint:** `/api/generate-broadcast-audio/route.ts`

### Previous Flawed Logic (Why it failed):
- It used an older model (`gemini-2.5-flash-preview-tts`).
- It attempted to send the **entire** broadcast script (which can be 5000+ characters for a 5-minute show) in a **single API call** to Gemini.
- **Result:** Gemini rejected the request due to payload/character limits, resulting in an "API Quota Exceeded" or "Invalid Argument" error.

### Current Updated Logic (The Fix):
1. **Model Upgraded:** Now uses `gemini-3.1-flash-tts-preview`, matching the stability of the Script page.
2. **Internal Chunking Added:** 
   - The script is parsed to maintain the `[Speaker: Text]` format.
   - The script is then chunked line-by-line until a chunk hits ~3000 characters.
   - This ensures that long conversations are broken down safely without cutting a speaker's line in half.
3. **Multi-Speaker Config:**
   - For each chunk, the server uses Gemini's `multiSpeakerVoiceConfig` to pass both voice configurations (e.g., `Voice1` mapped to `Puck`, `Voice2` mapped to `Kore`) in the same request.
4. **Stitching:**
   - The audio chunks are merged in chronological order and returned as a single 1-request response to the user.

---

## 3. Known Limitations & Solutions

### A. Volume Inconsistency (The "Far Away" Voice Issue)
**Problem:** 
When audio is generated in chunks, the AI loses the "emotional momentum" from the previous chunk. It treats the new chunk as a fresh start. Sometimes, the AI randomly assigns a different "mic distance" or lowers the energy/volume of the voice, making it sound inconsistent (like the speaker moved further from the mic).

**Why it happens:**
Gemini TTS evaluates context per-request. When a script is arbitrarily chunked at 3000 characters, the next chunk might start mid-thought or mid-conversation without the preceding emotional build-up. The AI guesses the required volume/emotion, often incorrectly defaulting to a lower energy state.

**How to Mitigate it (The Fixes):**
1. **Prompt Engineering (Immediate Solution):** 
   - Encourage the script generation prompt to add strong, explicit emotional tags at the start of scenes or chunks. 
   - Example: `[Priyanka: (speaking clearly and loudly)]` or `[Energetic tone]`. This forces the AI to establish a high baseline volume for that chunk.
2. **Smarter Chunking (Code Level Solution):**
   - Instead of breaking exactly at 3000 characters, adjust the chunking logic to break strictly at the end of a scene, a long pause, or a major paragraph. This reduces the chance of "mid-thought" volume drops.
3. **Audio Normalization (Future Update):** 
   - The ultimate technical fix is applying a dynamic range compressor or normalization algorithm to the stitched PCM buffer before converting it to WAV.
   - Example: Processing the final buffer through `FFmpeg` or using the `Web Audio API` on the frontend to equalize the decibel levels of all chunks so they sound uniform.

### B. Voice Drift (Character Forgetting Voice)
**Problem:** 
A character suddenly sounds like the default voice or a different gender in later chunks.

**How it was fixed:**
By keeping the `Speaker: ` prefix in every single line of the chunk, we force Gemini's `multiSpeakerVoiceConfig` to constantly remap the text to the correct prebuilt voice. Never strip the speaker names before sending them to the API.

---

## 4. Quota Tracking (Important Distinction)
- **User Database Quota:** The platform only deducts **1 Broadcast limit** per user click on the frontend.
- **Gemini API Key Quota:** Google counts **every internal chunk** as 1 API call. A 5-minute broadcast (~4500 characters) will consume roughly 2 API calls from your Google AI Studio key. Ensure you use a paid tier or multiple API keys if handling heavy traffic, as the daily limits on free keys are easily exhausted by long chunks.
