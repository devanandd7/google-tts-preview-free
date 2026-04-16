"use client";

import { useState, useRef } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

type Mode = "direct" | "ai";
type Stage = "input" | "review";

interface AudioItem {
  id: string;
  voice: string;
  script: string;
  audioBase64: string;
  createdAt: Date;
}

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
  const [editedScript, setEditedScript] = useState("");

  // Shared
  const [voice, setVoice] = useState("Kore");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Audio history list — stays across multiple generations
  const [audioHistory, setAudioHistory] = useState<AudioItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const resetAIStage = () => {
    setStage("input");
    setError("");
    setEditedScript("");
    setUserIdea("");
  };

  const handleModeSwitch = (m: Mode) => {
    setMode(m);
    setStage("input");
    setError("");
    setDirectScript("");
    setUserIdea("");
    setEditedScript("");
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
      setEditedScript(data.script);
      setStage("review");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Final step: generate TTS audio — does NOT hide the form
  const handleGenerateAudio = async () => {
    const script = mode === "direct" ? directScript : editedScript;
    if (!script.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Add to history — form stays visible
      const newItem: AudioItem = {
        id: Date.now().toString(),
        voice,
        script: script.slice(0, 120) + (script.length > 120 ? "…" : ""),
        audioBase64: data.audioBase64,
        createdAt: new Date(),
      };
      setAudioHistory(prev => [newItem, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = (id: string) => {
    const el = audioRefs.current[id];
    if (!el) return;

    if (playingId === id) {
      el.pause();
      setPlayingId(null);
    } else {
      // Pause any other playing
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId]!.pause();
      }
      el.play();
      setPlayingId(id);
    }
  };

  const handleAudioEnded = (id: string) => {
    if (playingId === id) setPlayingId(null);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
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

      {/* BODY — two-column layout */}
      <div className="flex-1 flex overflow-hidden max-w-[1400px] w-full mx-auto">

        {/* ========== LEFT: CREATOR (always visible) ========== */}
        <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6 min-w-0">
          <div>
            <h1 className="text-2xl font-black text-white">Generation Studio</h1>
            <p className="text-slate-500 mt-1 text-sm">Write or generate a script, pick a voice, produce audio.</p>
          </div>

          {/* MODE TABS */}
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 gap-1 w-fit">
            <button
              onClick={() => handleModeSwitch("direct")}
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
              onClick={() => handleModeSwitch("ai")}
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

          {/* ---- DIRECT MODE ---- */}
          {mode === "direct" && (
            <div className="space-y-5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Your Script
                    <span className="ml-2 font-normal text-slate-500">— use tags like [whispers], [shouting], [pause]</span>
                  </label>
                  <textarea
                    rows={10}
                    value={directScript}
                    onChange={e => setDirectScript(e.target.value)}
                    placeholder={`# AUDIO PROFILE: Alex — The Tech Visionary\n\n## THE SCENE: A conference stage under bright lights.\n\n### DIRECTOR'S NOTES\nStyle: Bold, confident\nPace: Medium\nAccent: American, neutral\n\n#### TRANSCRIPT\n[excitedly] Welcome to the future! [pause] What we're about to show you... has never been done before.`}
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
                {loading ? <><Spinner /> Generating…</> : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    Generate Voice
                  </>
                )}
              </button>
            </div>
          )}

          {/* ---- AI MODE — STEP 1: Idea ---- */}
          {mode === "ai" && stage === "input" && (
            <div className="space-y-5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                {/* Step indicator */}
                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className="flex items-center gap-1.5 font-semibold text-violet-400"><span className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-white">1</span> Your Idea</span>
                  <span className="w-6 h-px bg-slate-700" />
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600"><span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">2</span> Review Script</span>
                  <span className="w-6 h-px bg-slate-700" />
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600"><span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">3</span> Generate</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Describe your idea
                  </label>
                  <textarea
                    rows={4}
                    value={userIdea}
                    onChange={e => setUserIdea(e.target.value)}
                    placeholder="e.g., An excited morning radio DJ welcoming London to a rainy Thursday..."
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all text-sm resize-none leading-relaxed"
                  />
                </div>
                <div className="flex gap-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl text-violet-300 text-xs">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Gemini will write a full director-style script with tags. Review before generating.
                </div>
              </div>

              {error && <ErrorBox message={error} />}

              <button
                onClick={handleGenerateScript}
                disabled={loading || !userIdea.trim()}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-violet-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
              >
                {loading ? <><Spinner /> Writing script…</> : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                    Generate Script with AI
                  </>
                )}
              </button>
            </div>
          )}

          {/* ---- AI MODE — STEP 2: Review & Edit ---- */}
          {mode === "ai" && stage === "review" && (
            <div className="space-y-5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                {/* Step indicator */}
                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-500"><span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">1</span> Your Idea</span>
                  <span className="w-6 h-px bg-slate-700" />
                  <span className="flex items-center gap-1.5 font-semibold text-violet-400"><span className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-white">2</span> Review Script</span>
                  <span className="w-6 h-px bg-slate-700" />
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600"><span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">3</span> Generate</span>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-300">AI-Generated Script</label>
                  <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-full">Edit freely</span>
                </div>
                <textarea
                  rows={12}
                  value={editedScript}
                  onChange={e => setEditedScript(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all font-mono text-sm resize-none leading-relaxed"
                />
                <VoiceSelector voice={voice} onChange={setVoice} />
              </div>

              {error && <ErrorBox message={error} />}

              <div className="flex gap-3">
                <button
                  onClick={resetAIStage}
                  className="flex items-center justify-center px-5 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm rounded-xl transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleGenerateAudio}
                  disabled={loading || !editedScript.trim()}
                  className="flex-1 flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
                >
                  {loading ? <><Spinner /> Generating…</> : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      Generate Voice
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ========== RIGHT: AUDIO HISTORY SIDEBAR ========== */}
        <aside className="w-[360px] shrink-0 border-l border-slate-800 flex flex-col bg-slate-950">
          <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Generated Audio</h2>
              <p className="text-xs text-slate-500 mt-0.5">All clips from this session</p>
            </div>
            {audioHistory.length > 0 && (
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-full">
                {audioHistory.length} clip{audioHistory.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {audioHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-slate-600 text-sm">No audio yet</p>
                <p className="text-slate-700 text-xs">Generate your first voice clip on the left</p>
              </div>
            ) : (
              audioHistory.map((item, idx) => (
                <div
                  key={item.id}
                  className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition-colors"
                >
                  {/* Hidden audio element */}
                  <audio
                    ref={el => { audioRefs.current[item.id] = el; }}
                    src={`data:audio/wav;base64,${item.audioBase64}`}
                    onEnded={() => handleAudioEnded(item.id)}
                    className="hidden"
                  />

                  {/* Top row: index + voice tag + time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-mono">#{audioHistory.length - idx}</span>
                      <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                        {item.voice}
                      </span>
                    </div>
                    <span className="text-xs text-slate-600">{formatTime(item.createdAt)}</span>
                  </div>

                  {/* Script preview */}
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 font-mono">
                    {item.script}
                  </p>

                  {/* Controls row */}
                  <div className="flex items-center gap-2 pt-1">
                    {/* Play / Pause button */}
                    <button
                      onClick={() => togglePlay(item.id)}
                      className="flex items-center gap-2 flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
                    >
                      {playingId === item.id ? (
                        <>
                          <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                          </svg>
                          <span className="text-indigo-400">Pause</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                          </svg>
                          Play
                        </>
                      )}
                    </button>

                    {/* Download button */}
                    <a
                      href={`data:audio/wav;base64,${item.audioBase64}`}
                      download={`voicegen-${item.voice}-${item.id}.wav`}
                      title="Download WAV"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-500/20 hover:border-emerald-500/30 border border-transparent text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
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
    <svg className="animate-spin h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24">
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
