"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

type Mode = "direct" | "ai";
type Stage = "input" | "review" | "done";

const VOICES = [
  "Kore","Puck","Charon","Fenrir","Leda","Aoede","Callirrhoe","Autonoe",
  "Enceladus","Iapetus","Umbriel","Algieba","Despina","Erinome","Algenib",
  "Rasalgethi","Laomedeia","Achernar","Alnilam","Schedar","Gacrux",
  "Pulcherrima","Achird","Zubenelgenubi","Vindemiatrix","Sadachbia",
  "Sadaltager","Sulafat",
];

export default function StudioPage() {
  const [mode, setMode] = useState<Mode>("direct");
  const [stage, setStage] = useState<Stage>("input");

  // Direct mode
  const [directScript, setDirectScript] = useState("");

  // AI mode
  const [userIdea, setUserIdea] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [editedScript, setEditedScript] = useState("");

  // Shared
  const [voice, setVoice] = useState("Kore");
  const [audioBase64, setAudioBase64] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setStage("input");
    setAudioBase64("");
    setError("");
    setGeneratedScript("");
    setEditedScript("");
    setUserIdea("");
    setDirectScript("");
  };

  // Step 1 of AI mode: generate script
  const handleGenerateScript = async () => {
    if (!userIdea.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userIdea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedScript(data.script);
      setEditedScript(data.script);
      setStage("review");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Final step: generate TTS audio
  const handleGenerateAudio = async () => {
    const script = mode === "direct" ? directScript : editedScript;
    if (!script.trim()) return;
    setLoading(true);
    setError("");
    setAudioBase64("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAudioBase64(data.audioBase64);
      setStage("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight">VoiceGen AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm hidden sm:block">Studio</span>
            <UserButton />
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-8">

        {/* PAGE TITLE */}
        <div>
          <h1 className="text-3xl font-black text-white">Generation Studio</h1>
          <p className="text-slate-400 mt-1 text-sm">Choose your mode, write or generate your script, then produce your voice.</p>
        </div>

        {/* MODE TABS */}
        {stage === "input" && (
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 gap-1 w-fit">
            <button
              onClick={() => { setMode("direct"); reset(); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === "direct"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              Direct TTS
            </button>
            <button
              onClick={() => { setMode("ai"); reset(); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === "ai"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
              AI Script Builder
            </button>
          </div>
        )}

        {/* STEP INDICATOR for AI mode review */}
        {mode === "ai" && stage !== "done" && (
          <div className="flex items-center gap-3 text-sm">
            <div className={`flex items-center gap-2 font-semibold ${stage === "input" ? "text-violet-400" : "text-slate-500"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${stage === "input" ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-400"}`}>1</span>
              Your Idea
            </div>
            <div className="w-8 h-px bg-slate-700" />
            <div className={`flex items-center gap-2 font-semibold ${stage === "review" ? "text-violet-400" : "text-slate-500"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${stage === "review" ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-400"}`}>2</span>
              Review Script
            </div>
            <div className="w-8 h-px bg-slate-700" />
            <div className="flex items-center gap-2 font-semibold text-slate-500">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-slate-700 text-slate-400">3</span>
              Generate
            </div>
          </div>
        )}

        {/* ==================== DIRECT MODE ==================== */}
        {mode === "direct" && stage === "input" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Your Script
                  <span className="ml-2 font-normal text-slate-500">— use tags like [whispers], [shouting], [laughs], [pause]</span>
                </label>
                <textarea
                  rows={10}
                  value={directScript}
                  onChange={e => setDirectScript(e.target.value)}
                  placeholder={`# AUDIO PROFILE: Alex — The Tech Visionary\n\n## THE SCENE: A bustling conference stage under bright lights.\n\n### DIRECTOR'S NOTES\nStyle: Bold, confident, slightly theatrical\nPace: Medium with emphasis on key words\nAccent: American, neutral\n\n#### TRANSCRIPT\n[excitedly] Welcome to the future! [pause] What we're about to show you... has never been done before.`}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all font-mono text-sm resize-none leading-relaxed"
                />
              </div>

              <VoiceSelector voice={voice} onChange={setVoice} />
            </div>

            {error && <ErrorBox message={error} />}

            <button
              onClick={handleGenerateAudio}
              disabled={loading || !directScript.trim()}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {loading ? <Spinner /> : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  Generate Voice
                </>
              )}
            </button>
          </div>
        )}

        {/* ==================== AI MODE — STEP 1: Idea Input ==================== */}
        {mode === "ai" && stage === "input" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Describe your idea
                  <span className="ml-2 font-normal text-slate-500">— be as creative or simple as you like</span>
                </label>
                <textarea
                  rows={4}
                  value={userIdea}
                  onChange={e => setUserIdea(e.target.value)}
                  placeholder="e.g., An excited morning radio DJ welcoming London to a rainy Thursday with contagious energy..."
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all text-sm resize-none leading-relaxed"
                />
              </div>
              <div className="p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl text-violet-300 text-xs flex gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Gemini will write a full director-style script with audio tags. You can review and edit it before generating.
              </div>
            </div>

            {error && <ErrorBox message={error} />}

            <button
              onClick={handleGenerateScript}
              disabled={loading || !userIdea.trim()}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-violet-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {loading ? <Spinner /> : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                  Generate Script with AI
                </>
              )}
            </button>
          </div>
        )}

        {/* ==================== AI MODE — STEP 2: Review & Edit ==================== */}
        {mode === "ai" && stage === "review" && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-slate-300">AI-Generated Script</label>
                <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-full">Review & edit freely</span>
              </div>
              <textarea
                rows={14}
                value={editedScript}
                onChange={e => setEditedScript(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all font-mono text-sm resize-none leading-relaxed"
              />

              <VoiceSelector voice={voice} onChange={setVoice} />
            </div>

            {error && <ErrorBox message={error} />}

            <div className="flex gap-3">
              <button
                onClick={() => { setStage("input"); setError(""); setGeneratedScript(""); setEditedScript(""); }}
                className="flex items-center justify-center gap-2 px-5 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleGenerateAudio}
                disabled={loading || !editedScript.trim()}
                className="flex-1 flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
              >
                {loading ? <Spinner /> : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    Generate Voice
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================== DONE / AUDIO OUTPUT ==================== */}
        {stage === "done" && audioBase64 && (
          <div className="space-y-6 animate-slide-up">
            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-semibold text-sm">Voice generated successfully</span>
                <span className="ml-1 text-emerald-500/60 text-xs">· Voice: {voice}</span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                <audio
                  controls
                  autoPlay
                  className="w-full"
                  src={`data:audio/wav;base64,${audioBase64}`}
                >
                  Your browser does not support audio.
                </audio>
              </div>
              <a
                href={`data:audio/wav;base64,${audioBase64}`}
                download="voicegen-output.wav"
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download WAV
              </a>
            </div>
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm rounded-xl transition-colors"
            >
              ← Create Another
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// Shared sub-components
function VoiceSelector({ voice, onChange }: { voice: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-2">Voice</label>
      <select
        value={voice}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm transition-colors"
      >
        {VOICES.map(v => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-white/70" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" /></svg>
      {message}
    </div>
  );
}
