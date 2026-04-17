"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton, useUser, useSession } from "@clerk/nextjs";
import Link from "next/link";
import Script from "next/script";
import { toast } from "../components/Toaster";

// Extend window for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

type Language = "hindi" | "english";

type Mode = "direct" | "ai";
type Stage = "input" | "review";

interface UserProfile {
  plan: "free" | "pro";
  directTtsCount: number;
  aiScriptCount: number;
}

const LANG_KEY = "voicegen_language";

interface VoiceEntry { name: string; gender: "female" | "male" }

const VOICE_LIST: VoiceEntry[] = [
  // Female
  { name: "Kore",            gender: "female" },
  { name: "Leda",            gender: "female" },
  { name: "Aoede",           gender: "female" },
  { name: "Callirrhoe",      gender: "female" },
  { name: "Autonoe",         gender: "female" },
  { name: "Despina",         gender: "female" },
  { name: "Erinome",         gender: "female" },
  { name: "Laomedeia",       gender: "female" },
  { name: "Achernar",        gender: "female" },
  { name: "Schedar",         gender: "female" },
  { name: "Gacrux",          gender: "female" },
  { name: "Pulcherrima",     gender: "female" },
  { name: "Vindemiatrix",    gender: "female" },
  { name: "Sulafat",         gender: "female" },
  // Male
  { name: "Puck",            gender: "male" },
  { name: "Charon",          gender: "male" },
  { name: "Fenrir",          gender: "male" },
  { name: "Enceladus",       gender: "male" },
  { name: "Iapetus",         gender: "male" },
  { name: "Umbriel",         gender: "male" },
  { name: "Algieba",         gender: "male" },
  { name: "Algenib",         gender: "male" },
  { name: "Rasalgethi",      gender: "male" },
  { name: "Alnilam",         gender: "male" },
  { name: "Achird",          gender: "male" },
  { name: "Zubenelgenubi",   gender: "male" },
  { name: "Sadachbia",       gender: "male" },
  { name: "Sadaltager",      gender: "male" },
];

const FEMALE_VOICES = VOICE_LIST.filter(v => v.gender === "female");
const MALE_VOICES   = VOICE_LIST.filter(v => v.gender === "male");

interface AudioItem {
  id: string;
  voice: string;
  scriptPreview: string;
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

const SAMPLE_PROMPTS = [
  {
    label: "💕 Love Story",
    emoji: "💕",
    prompt: `Write a love story narrated by a father. It begins with a boy meeting a cute girl for the first time and slowly falling in love. Later, the boy forgets his girlfriend's birthday, leading to a fight between them. As tension rises, thunder echoes in the sky, and the sudden weather creates a romantic moment. In that moment, they forget their fight and rediscover their love for each other.`,
  },
  {
    label: "🎙️ Morning Radio",
    emoji: "🎙️",
    prompt: "An excited morning radio DJ welcoming London to a rainy Monday with contagious energy and humor.",
  },
  {
    label: "🎭 Drama Scene",
    emoji: "🎭",
    prompt: "A tense courtroom drama where a lawyer makes a passionate closing argument knowing their client is innocent.",
  },
  {
    label: "👻 Horror Story",
    emoji: "👻",
    prompt: "A horror story narrator describing someone exploring an abandoned house at midnight and hearing footsteps above them.",
  },
  {
    label: "😂 Stand-Up Comedy",
    emoji: "😂",
    prompt: "A stand-up comedian telling a relatable joke about fighting with a GPS navigation app.",
  },
  {
    label: "🚀 Motivational",
    emoji: "🚀",
    prompt: "A powerful motivational speech for developers who feel burned out and want to quit, delivered with raw energy.",
  },
];

export default function StudioPage() {
  const [mode, setMode] = useState<Mode>("direct");
  // Language — persisted in localStorage, default hindi
  const [language, setLanguage] = useState<Language>("hindi");
  const [stage, setStage] = useState<Stage>("input");

  const [directScript, setDirectScript] = useState("");
  const [userIdea, setUserIdea] = useState("");
  const [editedScript, setEditedScript] = useState("");

  const [voice, setVoice] = useState("Kore");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [customKeyError, setCustomKeyError] = useState("");
  const [customKeySuccess, setCustomKeySuccess] = useState("");
  const { user } = useUser();
  const { useRazorpay, Razorpay } = require("react-razorpay");
  const [RazorpayInstance, setRazorpayInstance] = useState<any>(null);

  useEffect(() => {
    if (Razorpay) {
       setRazorpayInstance(Razorpay);
    }
  }, [Razorpay])

  // Load profile
  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/payment/create-order", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (RazorpayInstance) {
          const options = {
            key: data.keyId,
            amount: data.amount,
            currency: data.currency,
            name: "VoiceGen AI",
            description: "Pro Subscription (One-Time)",
            order_id: data.orderId,
            handler: async function (response: any) {
              try {
                const verifyRes = await fetch("/api/payment/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });
                if (verifyRes.ok) {
                  await fetchProfile();
                  alert("Successfully upgraded to Pro!");
                } else {
                  alert("Payment verification failed.");
                }
              } catch (e) {
                console.error(e);
              }
            },
            prefill: {
              email: user?.primaryEmailAddress?.emailAddress,
            },
            theme: {
              color: "#4f46e5",
            },
          };

          const rzp = new RazorpayInstance(options);
          rzp.on("payment.failed", function (response: any) {
            alert("Payment failed: " + response.error.description);
          });
          rzp.open();
      } else {
          setError("Payment system initializing, please wait");
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    setCustomKeyError("");
    setCustomKeySuccess("");
    try {
      const res = await fetch("/api/user/update-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: customKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustomKeySuccess("API key saved successfully!");
      setCustomKey("");
    } catch (err: any) {
      setCustomKeyError(err.message);
    } finally {
      setSavingKey(false);
    }
  };


  const [audioHistory, setAudioHistory] = useState<AudioItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // Load persisted language on mount
  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Language | null;
    if (saved === "hindi" || saved === "english") setLanguage(saved);
  }, []);

  // Persist language whenever it changes
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

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

  const handleSamplePrompt = (prompt: string) => {
    setUserIdea(prompt);
    setStage("input");
    setEditedScript("");
    setError("");
  };

  const handleGenerateScript = async (idea?: string) => {
    const text = idea ?? userIdea;
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) {
          setError(data.error);
          return;
        }
        if (data.code === "OVERLOADED" || res.status === 503) {
          toast.overloaded(data.retryAfter ?? 30);
          return;
        }
        throw new Error(data.error);
      }
      setEditedScript(data.script);
      setStage("review");
      if (data.usage) {
        setProfile(prev => prev ? { ...prev, aiScriptCount: data.usage.aiScriptCount } : null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate script. Please try again.", "Script Generation Failed");
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      if (!res.ok) {
        if (data.limitReached) {
          setError(data.error);
          return;
        }
        if (data.code === "OVERLOADED" || res.status === 503) {
          toast.overloaded(data.retryAfter ?? 30);
          return;
        }
        if (data.code === "SAFETY_BLOCK") {
          toast.warning(
            "Your script was blocked by Gemini's safety filters. Please revise the content and try again.",
            "Content Blocked"
          );
          return;
        }
        throw new Error(data.error);
      }

      const newItem: AudioItem = {
        id: Date.now().toString(),
        voice,
        scriptPreview: script.slice(0, 100) + (script.length > 100 ? "…" : ""),
        audioBase64: data.audioBase64,
        createdAt: new Date(),
      };
      setAudioHistory(prev => [newItem, ...prev]);
      toast.success(`Voice "${voice}" generated successfully!`, "Audio Ready");
      if (data.usage) {
        setProfile(prev => prev ? { ...prev, directTtsCount: data.usage.directTtsCount } : null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate audio. Please try again.", "Generation Failed");
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

  const stepClass = (active: boolean) =>
    `flex items-center gap-1.5 font-semibold text-xs ${active ? "text-violet-400" : "text-slate-600"}`;
  const stepBubble = (active: boolean, n: number) =>
    `w-5 h-5 rounded-full flex items-center justify-center ${active ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-500"}`;

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
            {profile && (
               <div className="hidden sm:flex items-center gap-2 mr-2">
                 {profile.plan === "pro" ? (
                    <span className="px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      PRO PLAN
                    </span>
                 ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium rounded-full">
                        Free: {profile.directTtsCount}/3 TTS · {profile.aiScriptCount}/2 AI Scripts
                      </span>
                      <button onClick={handleUpgrade} className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-full transition-all shadow-lg active:scale-95">
                        Upgrade (₹49)
                      </button>
                    </div>
                 )}
               </div>
            )}
            {profile?.plan === "pro" && (
                <button onClick={() => setShowSettings(true)} className="p-2 mr-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Pro Settings">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                   </svg>
                </button>
            )}
            <UserButton />
          </div>
        </div>
      </header>

      {/* BODY: LEFT SIDEBAR + RIGHT CREATOR */}
      <div className="flex-1 flex flex-col-reverse lg:flex-row overflow-hidden max-w-[1400px] w-full mx-auto">

        {/* ===== LEFT: AUDIO HISTORY SIDEBAR ===== */}
        <aside className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col bg-slate-950/60 h-[350px] lg:h-auto lg:max-h-full overflow-hidden">
          <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-bold text-white">Generated Audio</h2>
              <p className="text-xs text-slate-500 mt-0.5">Session clips · play or download</p>
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
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-slate-600 text-sm">No clips yet</p>
                <p className="text-slate-700 text-xs max-w-[180px]">Generated voices will appear here ready to play & download</p>
              </div>
            ) : (
              audioHistory.map((item, idx) => (
                <div
                  key={item.id}
                  className={`group border rounded-2xl p-4 space-y-3 transition-all ${
                    playingId === item.id
                      ? "bg-indigo-950/40 border-indigo-500/40"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <audio
                    ref={el => { audioRefs.current[item.id] = el; }}
                    src={`data:audio/wav;base64,${item.audioBase64}`}
                    onEnded={() => handleAudioEnded(item.id)}
                    className="hidden"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-mono">#{audioHistory.length - idx}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        playingId === item.id
                          ? "text-indigo-300 bg-indigo-500/20 border-indigo-500/30"
                          : "text-slate-300 bg-slate-800 border-slate-700"
                      }`}>
                        {item.voice}
                      </span>
                    </div>
                    <span className="text-xs text-slate-600">{formatTime(item.createdAt)}</span>
                  </div>

                  <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 font-mono">
                    {item.scriptPreview}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePlay(item.id)}
                      className={`flex items-center gap-2 flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                        playingId === item.id
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                          : "bg-slate-800 hover:bg-slate-700 text-white"
                      }`}
                    >
                      {playingId === item.id ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                          </svg>
                          Pause
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                          </svg>
                          Play
                        </>
                      )}
                    </button>

                    <a
                      href={`data:audio/wav;base64,${item.audioBase64}`}
                      download={`voicegen-${item.voice}-${item.id}.wav`}
                      title="Download WAV"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-500/20 border border-transparent hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 transition-colors"
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

        {/* ===== RIGHT: CREATOR (always visible) ===== */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 lg:py-8 space-y-6 min-w-0">
          <div>
            <h1 className="text-2xl font-black text-white">Generation Studio</h1>
            <p className="text-slate-500 mt-1 text-sm">Write or generate a director-style script, pick a voice, produce audio.</p>
          </div>

          {/* MODE TABS */}
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 gap-1 w-fit">
            <button
              onClick={() => handleModeSwitch("direct")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === "direct" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              Direct TTS
            </button>
            <button
              onClick={() => handleModeSwitch("ai")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === "ai" ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20" : "text-slate-400 hover:text-white"
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
                    <span className="ml-2 font-normal text-slate-500">— use tags like [whispers], [shouting], [pause], [laughs]</span>
                  </label>
                  <textarea
                    rows={12}
                    value={directScript}
                    onChange={e => setDirectScript(e.target.value)}
                    placeholder={`# AUDIO PROFILE: Alex — The Tech Visionary\n\n## THE SCENE: A buzzing conference stage.\n\n### DIRECTOR'S NOTES\nStyle: Bold, confident, slightly theatrical\nPace: Medium with emphasis on key words\n\n#### TRANSCRIPT\n[excitedly] Welcome to the future! [pause] What we're about to show you... has never been done before.`}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all font-mono text-sm resize-none leading-relaxed"
                  />
                </div>
                <InlineVoiceGenRow
                  voice={voice}
                  onVoiceChange={setVoice}
                  onGenerate={handleGenerateAudio}
                  loading={loading}
                  disabled={!directScript.trim()}
                  accentClass="from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400"
                />
              </div>
              {error && <ErrorBox message={error} />}
            </div>
          )}

          {/* ---- AI MODE — STEP 1: Idea ---- */}
          {mode === "ai" && stage === "input" && (
            <div className="space-y-5">
              {/* Sample Prompt Chips + Language Toggle */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Quick prompts</p>
                  <LanguageToggle language={language} onChange={handleLanguageChange} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PROMPTS.map(sp => (
                    <button
                      key={sp.label}
                      onClick={() => {
                        setUserIdea(sp.prompt);
                        handleGenerateScript(sp.prompt);
                      }}
                      disabled={loading}
                      className="px-3 py-1.5 text-sm font-medium bg-slate-800/80 hover:bg-violet-600/20 border border-slate-700 hover:border-violet-500/50 text-slate-300 hover:text-violet-300 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                {/* Step indicator */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                  <span className={stepClass(true)}><span className={stepBubble(true, 1)}>1</span>Your Idea</span>
                  <span className="w-6 h-px bg-slate-800" />
                  <span className={stepClass(false)}><span className={stepBubble(false, 2)}>2</span>Review Script</span>
                  <span className="w-6 h-px bg-slate-800" />
                  <span className={stepClass(false)}><span className={stepBubble(false, 3)}>3</span>Generate</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Describe your idea
                    <span className="ml-2 font-normal text-slate-500">— or pick a quick prompt above</span>
                  </label>
                  <textarea
                    rows={5}
                    value={userIdea}
                    onChange={e => setUserIdea(e.target.value)}
                    placeholder="e.g., A father narrating his son's love story with emotion, dramatic pauses, and a monsoon background..."
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all text-sm resize-none leading-relaxed"
                  />
                </div>
                <div className="flex gap-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl text-violet-300 text-xs">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Gemini writes a full director-style script with audio tags like [pause], [whispers], [shouting]. Review & edit, then generate.
                </div>
              </div>

              {error && <ErrorBox message={error} />}

              <button
                onClick={() => handleGenerateScript()}
                disabled={loading || !userIdea.trim()}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
              >
                {loading ? <><Spinner /> Generating — auto-retrying if overloaded…</> : (
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
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                  <span className={stepClass(false)}><span className={stepBubble(false, 1)}>1</span>Your Idea</span>
                  <span className="w-6 h-px bg-slate-800" />
                  <span className={stepClass(true)}><span className={stepBubble(true, 2)}>2</span>Review Script</span>
                  <span className="w-6 h-px bg-slate-800" />
                  <span className={stepClass(false)}><span className={stepBubble(false, 3)}>3</span>Generate</span>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-300">AI-Generated Script</label>
                  <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-full">Edit freely before generating</span>
                </div>
                <textarea
                  rows={16}
                  value={editedScript}
                  onChange={e => setEditedScript(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all font-mono text-sm resize-none leading-relaxed"
                />
                <InlineVoiceGenRow
                  voice={voice}
                  onVoiceChange={setVoice}
                  onGenerate={handleGenerateAudio}
                  loading={loading}
                  disabled={!editedScript.trim()}
                  accentClass="from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500"
                />
              </div>

              {error && <ErrorBox message={error} />}
            </div>
          )}
        </main>
      </div>
      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
               >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="text-xl font-bold text-white mb-2">Pro Settings</h2>
              <p className="text-slate-400 text-sm mb-6">As a Pro user, you can bring your own Gemini API key to override server limits.</p>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Custom Gemini API Key <span className="text-slate-500 font-normal">(Optional)</span></label>
                    <input 
                      type="password"
                      value={customKey}
                      onChange={e => setCustomKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm transition-colors"
                    />
                 </div>
                 {customKeyError && <ErrorBox message={customKeyError} />}
                 {customKeySuccess && <div className="text-emerald-400 text-sm p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">{customKeySuccess}</div>}
                 
                 <button
                    onClick={handleSaveApiKey}
                    disabled={savingKey || !customKey}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                 >
                    {savingKey ? "Saving..." : "Save API Key"}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function InlineVoiceGenRow({
  voice,
  onVoiceChange,
  onGenerate,
  loading,
  disabled,
  accentClass,
}: {
  voice: string;
  onVoiceChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
  accentClass: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
      <div className="flex-1 min-w-0">
        <select
          value={voice}
          onChange={e => onVoiceChange(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-slate-200 outline-none text-sm transition-colors"
        >
          <optgroup label="♀ Female">
            {FEMALE_VOICES.map(v => (
              <option key={v.name} value={v.name}>{v.name} · Female</option>
            ))}
          </optgroup>
          <optgroup label="♂ Male">
            {MALE_VOICES.map(v => (
              <option key={v.name} value={v.name}>{v.name} · Male</option>
            ))}
          </optgroup>
        </select>
      </div>
      <button
        onClick={onGenerate}
        disabled={loading || disabled}
        className={`w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r ${accentClass} disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed`}
      >
        {loading ? (
          <><Spinner /></>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Generate
          </>
        )}
      </button>
    </div>
  );
}

function VoiceSelector({ voice, onChange }: { voice: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-2">Voice</label>
      <select
        value={voice}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm transition-colors"
      >
        <optgroup label="♀ Female">
          {FEMALE_VOICES.map(v => (
            <option key={v.name} value={v.name}>{v.name} · Female</option>
          ))}
        </optgroup>
        <optgroup label="♂ Male">
          {MALE_VOICES.map(v => (
            <option key={v.name} value={v.name}>{v.name} · Male</option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

function LanguageToggle({ language, onChange }: { language: "hindi" | "english"; onChange: (l: "hindi" | "english") => void }) {
  return (
    <div className="flex rounded-lg bg-slate-800 border border-slate-700 p-0.5 gap-0.5 shrink-0">
      <button
        onClick={() => onChange("hindi")}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
          language === "hindi"
            ? "bg-orange-500 text-white shadow"
            : "text-slate-400 hover:text-white"
        }`}
      >
        🇮🇳 हिन्दी
      </button>
      <button
        onClick={() => onChange("english")}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
          language === "english"
            ? "bg-indigo-500 text-white shadow"
            : "text-slate-400 hover:text-white"
        }`}
      >
        🇬🇧 English
      </button>
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
