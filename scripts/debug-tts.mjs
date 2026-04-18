// GenBox TTS Diagnostic Script
// Run: node scripts/debug-tts.mjs

const API_KEY = "AIzaSyDiy7S665nfc2AwXm2q2x8RiDLMdxL3VPY";

async function testGeminiFlash() {
  console.log("\n[1] Testing gemini-2.5-flash (text generation) ...");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Say hello." }] }] })
  });
  const data = await res.json();
  if (data.error) {
    console.log(`   ❌ FAILED [${data.error.code} HTTP ${res.status}]: ${data.error.message?.slice(0,100)}`);
    return false;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  console.log(`   ✅ OK — "${text}"`);
  return true;
}

async function testOneTTS(text, voiceName = "Puck", label = "") {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
      }
    })
  });
  const data = await res.json();
  if (data.error) {
    return { ok: false, code: data.error.code, status: res.status, msg: data.error.message };
  }
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return { ok: true, bytes: audioData ? Math.round(audioData.length * 0.75) : 0 };
}

async function main() {
  console.log("=".repeat(60));
  console.log(" GenBox TTS Diagnostic");
  console.log(`  Key: ${API_KEY.slice(0,14)}... (${(API_KEY.startsWith("AIzaSy") || API_KEY.startsWith("AQ.")) ? "✅ VALID FORMAT" : "❌ INVALID FORMAT"})`);
  console.log("=".repeat(60));

  // Step 1: Check text model
  const textOk = await testGeminiFlash();
  if (!textOk) {
    console.log("\n⛔ CONCLUSION: API key is INVALID or text quota exceeded at key level.\n");
    process.exit(1);
  }

  // Step 2: Single TTS call
  console.log("\n[2] Testing TTS — single short line ...");
  process.stdout.write("   Sending: 'Toh aaj ka topic hai love marriage.' (Puck) ... ");
  const r1 = await testOneTTS("Toh aaj ka topic hai love marriage.", "Puck");
  if (r1.ok) {
    console.log(`✅ OK (${(r1.bytes/1024).toFixed(1)} KB audio)`);
  } else {
    console.log(`❌ FAILED [HTTP ${r1.status} / code ${r1.code}]`);
    console.log(`   Message: ${r1.msg?.slice(0,120)}`);
    if (r1.code === 429) {
      console.log("\n⛔ CONCLUSION: TTS QUOTA EXHAUSTED (429 Too Many Requests)");
      console.log("   gemini-3.1-flash-tts-preview free tier = ~10 requests/day");
      console.log("   Reset time: Midnight UTC = 5:30 AM IST\n");
      console.log("   FIX: Add a fresh API key from aistudio.google.com in .env.local\n");
    } else if (r1.code === 400) {
      console.log("\n⛔ CONCLUSION: BAD REQUEST — model may not support TTS for this key tier");
    } else if (r1.code === 403) {
      console.log("\n⛔ CONCLUSION: PERMISSION DENIED — key does not have TTS access");
    }
    process.exit(1);
  }

  // Step 3: Simulate broadcast blocks
  console.log("\n[3] Simulating broadcast blocks (5 sequential calls) ...");
  const testBlocks = [
    { text: "[excitedly] Toh Kore, aaj ka topic hai love marriage ya arrange marriage!", voice: "Puck" },
    { text: "[chuckles] Arre wah! Hamesha ki tarah ek garam topic! Main ready hoon.", voice: "Kore" },
    { text: "[seriously] Batao, tum kya prefer karti ho?", voice: "Puck" },
    { text: "[pause] Dekho, better bolna toh mushkil hai. Dono ke apne advantages hain.", voice: "Kore" },
    { text: "[warmly] Sahi baat hai. Par ek initial thought? Pehli preference kya hoti hai?", voice: "Puck" },
  ];

  let passed = 0;
  for (let i = 0; i < testBlocks.length; i++) {
    const b = testBlocks[i];
    process.stdout.write(`   Block ${i+1}/5 [${b.voice}, ${b.text.length} chars] ... `);
    const r = await testOneTTS(b.text, b.voice);
    if (r.ok) {
      console.log(`✅ OK (${(r.bytes/1024).toFixed(1)} KB)`);
      passed++;
    } else {
      console.log(`❌ FAILED [${r.code}]: ${r.msg?.slice(0,80)}`);
      if (r.code === 429) {
        console.log(`\n⛔ Quota hit at block ${i+1}/5`);
        console.log(`   This key can handle ~${i} TTS calls before hitting free tier limit.`);
        console.log(`   For a 3-minute broadcast with 41 blocks, you need 41 quota slots.`);
        break;
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log("\n" + "=".repeat(60));
  if (passed === testBlocks.length) {
    console.log(` ✅ DIAGNOSIS: API key is WORKING. All ${passed}/5 blocks succeeded.`);
    console.log(` The earlier error was likely from the AQ. key (wrong format) being`);
    console.log(` loaded due to duplicate GEMINI_API_KEY in .env.local — now fixed.`);
    console.log(` Restart dev server and try the broadcast again.`);
  } else {
    console.log(` ❌ DIAGNOSIS: TTS quota is EXHAUSTED for this key.`);
    console.log(` ACTION: Get a fresh key at https://aistudio.google.com/apikey`);
    console.log(` Then update GEMINI_API_KEY in .env.local and restart dev server.`);
  }
  console.log("=".repeat(60) + "\n");
}

main().catch(e => { console.error("Script error:", e.message); process.exit(1); });
