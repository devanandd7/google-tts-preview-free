"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { toast } from "../components/Toaster";
import { ProSidebar } from "../components/ProSidebar";
import { useRazorpay, openRazorpayCheckout } from "@/lib/razorpay";

const ENABLE_PRO_SIDEBAR = process.env.NEXT_PUBLIC_ENABLE_PRO_SIDEBAR === "true";

// Extend window for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

type Language = "hindi" | "english";

type Mode = "direct" | "ai" | "broadcast" | "music" | "image";
type Stage = "input" | "review";

interface UserProfile {
  plan: "free" | "pro";
  planStatus: "active" | "expired" | "none";
  directTtsCount: number;
  aiScriptCount: number;
  broadcastCount: number;
  hasOwnApiKey?: boolean;
  planActivatedAt?: string | null;
  planExpiresAt?: string | null;
  daysLeft?: number | null;
  paymentCount?: number;
}

const LANG_KEY = "voicegen_language";

interface VoiceEntry { name: string; gender: "female" | "male" }

const VOICE_LIST: VoiceEntry[] = [
  // Female
  { name: "Kore", gender: "female" },
  { name: "Leda", gender: "female" },
  { name: "Aoede", gender: "female" },
  { name: "Callirrhoe", gender: "female" },
  { name: "Autonoe", gender: "female" },
  { name: "Despina", gender: "female" },
  { name: "Erinome", gender: "female" },
  { name: "Laomedeia", gender: "female" },
  { name: "Achernar", gender: "female" },
  { name: "Schedar", gender: "female" },
  { name: "Gacrux", gender: "female" },
  { name: "Pulcherrima", gender: "female" },
  { name: "Vindemiatrix", gender: "female" },
  { name: "Sulafat", gender: "female" },
  // Male
  { name: "Puck", gender: "male" },
  { name: "Charon", gender: "male" },
  { name: "Fenrir", gender: "male" },
  { name: "Enceladus", gender: "male" },
  { name: "Iapetus", gender: "male" },
  { name: "Umbriel", gender: "male" },
  { name: "Algieba", gender: "male" },
  { name: "Algenib", gender: "male" },
  { name: "Rasalgethi", gender: "male" },
  { name: "Alnilam", gender: "male" },
  { name: "Achird", gender: "male" },
  { name: "Zubenelgenubi", gender: "male" },
  { name: "Sadachbia", gender: "male" },
  { name: "Sadaltager", gender: "male" },
];

const FEMALE_VOICES = VOICE_LIST.filter(v => v.gender === "female");
const MALE_VOICES = VOICE_LIST.filter(v => v.gender === "male");

interface AudioItem {
  id: string;
  type?: "audio" | "image";
  voice: string;
  scriptPreview: string;
  audioBase64?: string;
  imageUrl?: string;
  createdAt: Date;
}

const VOICES = [
  "Kore", "Puck", "Charon", "Fenrir", "Leda", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib",
  "Rasalgethi", "Laomedeia", "Achernar", "Alnilam", "Schedar", "Gacrux",
  "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia",
  "Sadaltager", "Sulafat",
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

  const [lengthMode, setLengthMode] = useState<"short" | "long">("short");
  const [scriptDuration, setScriptDuration] = useState(1);

  const [directScript, setDirectScript] = useState("");
  const [userIdea, setUserIdea] = useState("");
  const [editedScript, setEditedScript] = useState("");

  const [voice, setVoice] = useState("Kore");
  const [voice1, setVoice1] = useState("Puck");
  const [voice2, setVoice2] = useState("Kore");

  // Music State
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicLyrics, setMusicLyrics] = useState("");
  const [musicDuration, setMusicDuration] = useState<"30s" | "full">("30s");
  const [musicInstrumental, setMusicInstrumental] = useState(false);

  // Image State
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageGenerating, setImageGenerating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  
  // Live Session Trackers
  const [sessionTokens, setSessionTokens] = useState(0);
  const [sessionAudioRequests, setSessionAudioRequests] = useState(0);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProSidebarMobile, setShowProSidebarMobile] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [customKeyError, setCustomKeyError] = useState("");
  const [customKeySuccess, setCustomKeySuccess] = useState("");
  const razorpayReady = useRazorpay();
  const { user } = useUser();

  // Load profile on mount and whenever user changes
  useEffect(() => { fetchProfile(); }, [user]);

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

  /**
   * Open Razorpay checkout — works for both first-time upgrades and renewals.
   * Razorpay SDK is loaded globally via <Script> in layout.tsx.
   */
  const handleUpgrade = async () => {
    const isRenewal = profile?.plan === "pro" && profile?.planStatus === "expired";
    const isActivePro = profile?.plan === "pro" && profile?.planStatus === "active";
    if (isActivePro) {
      toast.warning(
        `Your Pro plan is active for ${profile?.daysLeft} more day(s). Renewal will be available when it expires.`,
        "Already Pro"
      );
      return;
    }

    if (!razorpayReady) {
      toast.error("Payment SDK is loading, please wait a moment and try again.", "SDK Loading");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/payment/create-order", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      openRazorpayCheckout({
        orderId: data.orderId,
        amount: data.amount,
        currency: data.currency,
        keyId: data.keyId,
        name: "VoiceGen AI",
        description: isRenewal ? "Pro Plan Renewal (30 days)" : "Pro Plan Subscription (30 days)",
        email: user?.primaryEmailAddress?.emailAddress ?? "",
        isRenewal,
        onSuccess: async ({ planExpiresAt }) => {
          await fetchProfile();
          toast.success(
            isRenewal
              ? `Plan renewed! Active until ${new Date(planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`
              : `Welcome to Pro! Active until ${new Date(planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`,
            isRenewal ? "Plan Renewed 🎉" : "Upgraded to Pro! 🎉"
          );
          setLoading(false);
        },
        onFailure: (reason) => {
          toast.error(reason, "Payment Failed");
          setLoading(false);
        },
        onDismiss: () => setLoading(false),
      });
    } catch (err: any) {
      toast.error(err.message || "Could not initiate payment.", "Payment Error");
      setError(err.message);
      setLoading(false);
    }
  };


  const handleSaveApiKey = async (keyToSave?: string): Promise<boolean> => {
    // If the old UI calls this without arguments, it uses customKey from state.
    // ProSidebar will pass the key directly.
    const key = keyToSave ?? customKey;

    setSavingKey(true);
    setCustomKeyError("");
    setCustomKeySuccess("");
    try {
      const res = await fetch("/api/user/update-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustomKeySuccess("API key saved successfully!");
      if (!keyToSave) {
        setCustomKey("");
      }
      await fetchProfile();
      return true;
    } catch (err: any) {
      setCustomKeyError(err.message);
      return false;
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

  const handleLengthSwitch = (newLength: "short" | "long") => {
    if (newLength === "long" && profile?.plan !== "pro") {
      toast.warning("Long format audio is a Pro feature! Upgrade to switch modes.", "Pro Feature");
      return;
    }
    setLengthMode(newLength);
    if (newLength === "short" && scriptDuration > 2) {
      setScriptDuration(2);
    }
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

    const endpoint = mode === "broadcast" ? "/api/generate-broadcast-script" : "/api/generate-script";
    const payload = mode === "broadcast"
      ? { prompt: text, language, voice1, voice2, durationMinutes: scriptDuration }
      : { prompt: text, language, voice, durationMinutes: scriptDuration };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) {
          setError(data.error);
          return;
        }
        if (data.code === "QUOTA_EXCEEDED") {
          toast.error(
            "The Gemini API key being used has hit its daily free-tier limit. Please add a valid Gemini API key from aistudio.google.com in your Pro Settings.",
            "API Quota Exhausted"
          );
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
      if (data.tokenUsage) {
         setSessionTokens(prev => prev + data.tokenUsage);
         toast.success(`Generated using ${data.tokenUsage.toLocaleString()} tokens`, "Live Token Usage");
      }
      
      if (data.usage) {
        if (mode === "broadcast") {
          setProfile(prev => prev ? { ...prev, broadcastCount: data.usage.broadcastCount } : null);
        } else {
          setProfile(prev => prev ? { ...prev, aiScriptCount: data.usage.aiScriptCount } : null);
        }
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
    setAudioLoading(true);
    setError("");

    const endpoint = mode === "broadcast" ? "/api/generate-broadcast-audio" : "/api/generate";
    const payload = mode === "broadcast"
      ? { script, voice1, voice2 }
      : { script, voice };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) {
          setError(data.error);
          return;
        }
        if (data.code === "QUOTA_EXCEEDED") {
          toast.error(
            "The Gemini API key being used has hit its daily free-tier limit (10 requests/day). The server key is also exhausted. Please update GEMINI_API_KEY in .env.local with a fresh Gemini API key from aistudio.google.com.",
            "API Quota Exhausted"
          );
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

      const voiceLabel = mode === "broadcast" ? `${voice1} & ${voice2}` : voice;
      const newItem: AudioItem = {
        id: Date.now().toString(),
        voice: voiceLabel,
        scriptPreview: script.slice(0, 100) + (script.length > 100 ? "…" : ""),
        audioBase64: data.audioBase64,
        createdAt: new Date(),
      };
      setAudioHistory(prev => [newItem, ...prev]);
      
      // Update our live requests metric (Broadcast audio consumes multiple requests behind the scenes)
      const requestsMade = mode === "broadcast" ? 2 : 1; 
      setSessionAudioRequests(prev => prev + requestsMade);

      toast.success(mode === "broadcast" ? "Broadcast audio generated successfully!" : `Voice "${voiceLabel}" generated successfully!`, "Audio Ready");
      if (data.usage) {
        if (mode === "broadcast") {
           setProfile(prev => prev ? { ...prev, broadcastCount: data.usage.broadcastCount } : null);
        } else {
           setProfile(prev => prev ? { ...prev, directTtsCount: data.usage.directTtsCount } : null);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate audio. Please try again.", "Generation Failed");
      setError(err.message);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: musicPrompt,
          lyrics: musicLyrics,
          duration: musicDuration,
          instrumental: musicInstrumental
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.code === "UPGRADE_REQUIRED") {
           toast.error(data.error, "Upgrade Required");
           return;
        }
        if (data.code === "QUOTA_EXCEEDED") {
          toast.error(
            "Gemini API quota exceeded. Lyria Music generation consumes high request quotas. Please use your Custom API Key from Google AI Studio.",
            "API Quota Exhausted"
          );
          setError(data.error || "Quota exceeded");
          return;
        }
        throw new Error(data.error || "Generation error");
      }

      if (data.tokenUsage) {
         setSessionTokens(prev => prev + data.tokenUsage);
         toast.success(`Generated using ${data.tokenUsage.toLocaleString()} tokens`, "Live Token Usage");
      }

      const songDesc = musicInstrumental ? "[Instrumental Track]" : "[Vocal Track]";
      const newItem: AudioItem = {
        id: Date.now().toString(),
        voice: `Lyria 3 (${musicDuration === "full" ? "Full Length" : "30s Clip"})`,
        scriptPreview: `${songDesc} ${musicPrompt.slice(0, 80)}...`,
        audioBase64: data.audioBase64,
        createdAt: new Date(),
      };
      
      setAudioHistory(prev => [newItem, ...prev]);
      setSessionAudioRequests(prev => prev + 1);

      toast.success("AI Music generated successfully! Play it from History.", "Track Ready");
      setMusicPrompt("");
      setMusicLyrics("");
      
    } catch (err: any) {
      toast.error(err.message || "Failed to generate Music.", "Generation Failed");
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setImageGenerating(true);
    setError("");

    try {
      // 1. Enhance the prompt using Gemini
      const res = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      const data = await res.json();

      if (!res.ok) {
         throw new Error(data.error || "Failed to enhance prompt");
      }

      const enhancedPrompt = data.enhancedPrompt || imagePrompt;
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

      const newItem: AudioItem = {
        id: Date.now().toString(),
        type: "image",
        voice: "Pollinations AI",
        scriptPreview: enhancedPrompt,
        imageUrl: url,
        createdAt: new Date(),
      };
      
      setAudioHistory(prev => [newItem, ...prev]);
      toast.success("AI Image generated! Check your history.", "Image Ready");
      setImagePrompt("");

    } catch (err: any) {
      toast.error(err.message || "Failed to generate Image.", "Generation Failed");
      setError(err.message);
    } finally {
      setImageGenerating(false);
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
                  <div className="flex items-center gap-3">
                    {/* Live Dynamic Token Usage Widget */}
                    <div className="flex items-center gap-2 mr-1 bg-slate-900/60 pl-3 pr-4 py-1.5 rounded-xl border border-slate-800 shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]" title="API usage in this session">
                      <div className="flex flex-col border-r border-slate-800 pr-3">
                        <span className="text-[9px] font-black tracking-widest text-emerald-500 uppercase overflow-hidden whitespace-nowrap">Session Tokens</span>
                        <span className="text-sm font-mono font-bold text-white leading-none mt-1 animate-pulse">{sessionTokens > 0 ? sessionTokens.toLocaleString() : "0"}</span>
                      </div>
                      <div className="flex flex-col pl-1">
                        <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase overflow-hidden whitespace-nowrap">Audio Req</span>
                        <span className="text-sm font-mono font-bold text-white leading-none mt-1">{sessionAudioRequests}</span>
                      </div>
                    </div>

                    <div className="group relative">
                       <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-help">
                         PRO PLAN
                       </span>
                       <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute top-full mt-2 right-0 w-[260px] bg-slate-800 border border-slate-700 p-3 rounded-xl shadow-2xl z-50 text-xs text-slate-300 pointer-events-none transition-all font-medium">
                         <p className="text-emerald-400 font-bold mb-1 border-b border-slate-700/50 pb-1">Google Free Tier Limits:</p>
                         <ul className="list-disc pl-4 space-y-1 mt-1 font-mono text-[11px]">
                           <li>Text & Scripts: <span className="text-white">1,500 req / day</span></li>
                           <li>TTS Audio: <span className="text-white">10 req / day</span></li>
                         </ul>
                         <p className="mt-2 text-slate-400 text-[10px] leading-tight italic">
                           Note: The Gemini API does not allow us to fetch your remaining limits. 
                           Broadcast audio uses multiple audio requests at once!
                         </p>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium rounded-full">
                      Free: {profile.directTtsCount}/3 TTS · {profile.aiScriptCount}/2 Scripts · {profile.broadcastCount ?? 0}/3 Broadcasts
                    </span>
                    <button onClick={handleUpgrade} className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-full transition-all shadow-lg active:scale-95">
                      Upgrade (₹49)
                    </button>
                  </div>
                )}
              </div>
            )}
            {profile?.plan === "pro" && (
              <button
                onClick={() => ENABLE_PRO_SIDEBAR ? setShowProSidebarMobile(true) : setShowSettings(true)}
                className="p-2 mr-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Pro Settings"
              >
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

      {/* BODY: LEFT SIDEBAR + RIGHT CREATOR + PRO SIDEBAR (optional) */}
      <div className={`flex-1 flex flex-col-reverse lg:flex-row overflow-hidden w-full mx-auto ${ENABLE_PRO_SIDEBAR ? 'max-w-none' : 'max-w-[1400px]'}`}>

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
            {audioLoading && (
              <div className="group border rounded-2xl p-4 space-y-4 bg-slate-900/60 border-slate-800 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-8 bg-slate-800 rounded-md"></div>
                    <div className="h-5 w-20 bg-slate-800 rounded-full"></div>
                  </div>
                  <div className="h-4 w-12 bg-slate-800 rounded-md"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-800 rounded-full"></div>
                  <div className="h-3 w-5/6 bg-slate-800 rounded-full"></div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-8 flex-1 bg-slate-800 rounded-lg"></div>
                  <div className="h-8 w-10 bg-slate-800 rounded-lg"></div>
                </div>
              </div>
            )}

            {audioHistory.length === 0 && !audioLoading ? (
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
                  className={`group border rounded-2xl p-4 space-y-3 transition-all ${playingId === item.id || item.type === "image"
                    ? "bg-indigo-950/40 border-indigo-500/40"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-mono">#{audioHistory.length - idx}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${item.type === "image"
                          ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
                          : playingId === item.id 
                            ? "text-indigo-300 bg-indigo-500/20 border-indigo-500/30"
                            : "text-slate-300 bg-slate-800 border-slate-700"
                        }`}>
                        {item.voice}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       {item.type !== "image" && audioDurations[item.id] && (
                        <div className="flex items-center gap-1 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50">
                          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-[10px] font-mono text-slate-400">
                            {audioDurations[item.id] < 10 ? audioDurations[item.id].toFixed(1) : Math.round(audioDurations[item.id])}s
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-slate-600">{formatTime(item.createdAt)}</span>
                    </div>
                  </div>

                  {item.type === "image" && item.imageUrl ? (
                     <div className="space-y-3">
                       <a href={item.imageUrl} target="_blank" rel="noreferrer" className="block w-full overflow-hidden rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
                         <img src={item.imageUrl} alt="AI Generated" className="w-full h-auto object-cover" />
                       </a>
                       <p className="text-slate-500 text-[10.5px] leading-relaxed line-clamp-3 font-mono">
                         {item.scriptPreview}
                       </p>
                     </div>
                  ) : (
                    <>
                      <audio
                        ref={el => { audioRefs.current[item.id] = el; }}
                        src={`data:audio/wav;base64,${item.audioBase64}`}
                        onEnded={() => handleAudioEnded(item.id)}
                        onLoadedMetadata={(e) => {
                          const dur = e.currentTarget.duration;
                          setAudioDurations(prev => ({ ...prev, [item.id]: dur }));
                        }}
                        className="hidden"
                      />
                      <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 font-mono">
                        {item.scriptPreview}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePlay(item.id)}
                          className={`flex items-center gap-2 flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${playingId === item.id
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                            : "bg-slate-800 hover:bg-slate-700 text-white"
                            }`}
                        >
                          {playingId === item.id ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" /></svg>
                              Pause
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
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
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </a>
                      </div>
                    </>
                  )}
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

          {/* MODE TABS & SETUP */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 gap-1 w-fit shrink-0 overflow-x-auto">
              <button
                onClick={() => handleModeSwitch("direct")}
                className={`flex items-center justify-center gap-2 px-6 h-11 min-w-[140px] rounded-lg text-sm font-semibold transition-all ${mode === "direct" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white"
                  }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                Direct TTS
              </button>
              <button
                onClick={() => handleModeSwitch("ai")}
                className={`flex items-center justify-center gap-2 px-6 h-11 min-w-[140px] rounded-lg text-sm font-semibold transition-all ${mode === "ai" ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20" : "text-slate-400 hover:text-white"
                  }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                AI Script Builder
              </button>
              <button
                onClick={() => handleModeSwitch("broadcast")}
                className={`flex items-center justify-center gap-2 px-6 h-11 min-w-[140px] rounded-lg text-sm font-semibold transition-all ${mode === "broadcast" ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20" : "text-slate-400 hover:text-white"
                  }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.829 1.58-1.936a4.5 4.5 0 001.31-.433m-1.5 2.56a12.12 12.12 0 01-3 0m4.5-2.56V15.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.875 18v-.192c0-.983-.658-1.829-1.58-1.936a4.5 4.5 0 01-1.31-.433" /></svg>
                AI Broadcast
              </button>
              <button
                onClick={() => handleModeSwitch("music")}
                className={`flex items-center justify-center gap-2 px-6 h-11 min-w-[140px] rounded-lg text-sm font-semibold transition-all group relative overflow-hidden ${mode === "music" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-white"
                  }`}
              >
                {/* PRO Tag */}
                <div className="absolute top-0 right-0 px-1 py-[1px] bg-amber-400 text-amber-950 text-[8px] font-black tracking-widest rounded-bl-sm">PRO</div>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                AI Music
              </button>
              <button
                onClick={() => handleModeSwitch("image")}
                className={`flex items-center justify-center gap-2 px-6 h-11 min-w-[140px] rounded-lg text-sm font-semibold transition-all group relative overflow-hidden ${mode === "image" ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20" : "text-slate-400 hover:text-white"
                  }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                AI Image
              </button>
            </div>

            {/* LENGTH MODE */}
            <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:inline-block">Format</span>
              <div className="flex rounded-md bg-slate-950/80 border border-slate-800 p-1 w-fit">
                <button
                  onClick={() => handleLengthSwitch("short")}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all ${lengthMode === "short" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >Short (≤2m)</button>
                <button
                  onClick={() => handleLengthSwitch("long")}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all flex items-center gap-1.5 ${lengthMode === "long" ? "bg-violet-600/90 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                >
                  Long (≤10m)
                  {profile?.plan !== "pro" && <svg className="w-3 h-3 opacity-60 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V12a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z" /></svg>}
                </button>
              </div>
            </div>
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
                    maxLength={lengthMode === "short" ? 2000 : 9000}
                    placeholder={`# AUDIO PROFILE: Alex — The Tech Visionary\n\n## THE SCENE: A buzzing conference stage.\n\n### DIRECTOR'S NOTES\nStyle: Bold, confident, slightly theatrical\nPace: Medium with emphasis on key words\n\n#### TRANSCRIPT\n[excitedly] Welcome to the future! [pause] What we're about to show you... has never been done before.`}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all font-mono text-sm resize-none leading-relaxed"
                  />
                  <div className="flex justify-end pt-1">
                    <span className={`text-xs font-mono font-medium ${directScript.length >= (lengthMode === "short" ? 2000 : 9000) ? 'text-red-400' : 'text-slate-500'}`}>
                      {directScript.length.toLocaleString()} / {(lengthMode === "short" ? 2000 : 9000).toLocaleString()} chars max
                    </span>
                  </div>
                </div>
                <InlineVoiceGenRow
                  voice={voice}
                  onVoiceChange={setVoice}
                  onGenerate={handleGenerateAudio}
                  loading={audioLoading}
                  disabled={!directScript.trim()}
                  accentClass="from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400"
                  isPro={profile?.plan === 'pro'}
                  language={language}
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

                {/* Duration Slider */}
                <div className="pt-2">
                  <label className="flex items-center justify-between text-sm font-semibold text-slate-300 mb-3">
                    Target Duration
                    <div className="px-2.5 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-violet-400 font-mono font-bold text-xs tracking-wider">
                      {scriptDuration} MINUTE{scriptDuration > 1 ? 'S' : ''}
                    </div>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max={lengthMode === "short" ? "2" : "10"}
                    value={scriptDuration}
                    onChange={e => setScriptDuration(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-2 tracking-wider">
                    <span>1 MIN</span>
                    <span>{lengthMode === "short" ? "2" : "10"} MINS</span>
                  </div>
                </div>

                <div className="flex gap-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl text-violet-300 text-xs">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Gemini writes a full director-style script mapping to {scriptDuration} minute{scriptDuration > 1 ? "s" : ""} length. Review & edit, then generate.
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
                  loading={audioLoading}
                  disabled={!editedScript.trim()}
                  accentClass="from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500"
                  isPro={profile?.plan === 'pro'}
                  language={language}
                />
              </div>

              {error && <ErrorBox message={error} />}
            </div>
          )}

          {/* ---- BROADCAST MODE — STEP 1: Idea ---- */}
          {mode === "broadcast" && stage === "input" && (
            <div className="space-y-5 relative">
              {/* PRO GATE OVERLAY */}
              {profile?.plan !== "pro" && (
                <div className="absolute inset-x-0 -inset-y-4 z-20 flex flex-col items-center justify-center backdrop-blur-md bg-slate-950/60 rounded-3xl border border-white/5">
                   <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-sm text-center shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 blur-3xl rounded-full"></div>
                      
                      <div className="w-16 h-16 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Unlock AI Broadcasts</h3>
                      <p className="text-sm text-slate-400 mb-6 leading-relaxed">Create engaging 2-speaker podcast-style broadcasts with unique AI personalities and dialogue generation.</p>
                      
                      <button onClick={handleUpgrade} className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-pink-500/25 active:scale-95 flex items-center justify-center gap-2">
                         <span>Go PRO (₹49/mo)</span>
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </button>
                   </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Broadcast Ideas</p>
                  <LanguageToggle language={language} onChange={handleLanguageChange} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "🎤 AI Interview", prompt: "A heated podcast interview where the host questions a guest about the dangers of artificial general intelligence." },
                    { label: "🚀 Space Race Debate", prompt: "A lively debate on a radio show about whether humans should colonize Mars or focus on saving Earth." },
                    { label: "😂 Comedy Duo", prompt: "Two friends doing a comedy podcast, talking about the weirdest food combinations they've tried." },
                    { label: "👻 Spooky Stories", prompt: "A late-night show where two hosts discuss a local ghost legend and freak each other out." }
                  ].map(sp => (
                    <button
                      key={sp.label}
                      onClick={() => {
                        setUserIdea(sp.prompt);
                        handleGenerateScript(sp.prompt);
                      }}
                      disabled={loading}
                      className="px-3 py-1.5 text-sm font-medium bg-slate-800/80 hover:bg-pink-600/20 border border-slate-700 hover:border-pink-500/50 text-slate-300 hover:text-pink-300 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                {/* Step indicator */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                  <span className={`flex items-center gap-1.5 font-semibold text-xs text-pink-400`}><span className={`w-5 h-5 rounded-full flex items-center justify-center bg-pink-600 text-white`}>1</span>Setup</span>
                  <span className="w-6 h-px bg-slate-800" />
                  <span className={`flex items-center gap-1.5 font-semibold text-xs text-slate-600`}><span className={`w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 text-slate-500`}>2</span>Review</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Topic of the Broadcast
                  </label>
                  <textarea
                     rows={4}
                     value={userIdea}
                     onChange={e => setUserIdea(e.target.value)}
                     placeholder="e.g., A discussion between a cynical host and an overly optimistic guest..."
                     className="w-full bg-slate-800/80 border border-slate-700 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all text-sm resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Speaker 1 (Host)</label>
                    <VoiceSelector voice={voice1} onChange={setVoice1} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Speaker 2 (Guest)</label>
                    <VoiceSelector voice={voice2} onChange={setVoice2} />
                  </div>
                </div>

                {/* Duration Slider */}
                <div className="pt-2">
                  <label className="flex items-center justify-between text-sm font-semibold text-slate-300 mb-3">
                    Target Duration
                    <div className="px-2.5 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-pink-400 font-mono font-bold text-xs tracking-wider">
                      {scriptDuration} MINUTE{scriptDuration > 1 ? 'S' : ''}
                    </div>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max={lengthMode === "short" ? "2" : "9"}
                    value={scriptDuration}
                    onChange={e => setScriptDuration(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-pink-500/50"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-2 tracking-wider">
                    <span>1 MIN</span>
                    <span>{lengthMode === "short" ? "2" : "9"} MINS</span>
                  </div>
                </div>
              </div>

              {error && <ErrorBox message={error} />}

              <button
                onClick={() => handleGenerateScript()}
                disabled={loading || !userIdea.trim() || voice1 === voice2}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-pink-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
              >
                {loading ? <><Spinner /> Formatting Dialogue…</> : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.829 1.58-1.936a4.5 4.5 0 001.31-.433m-1.5 2.56a12.12 12.12 0 01-3 0m4.5-2.56V15.75" /></svg>
                    {voice1 === voice2 ? "Select different voices" : "Generate Dialogue Script"}
                  </>
                )}
              </button>
            </div>
          )}

          {/* ---- BROADCAST MODE — STEP 2: Review ---- */}
          {mode === "broadcast" && stage === "review" && (
            <div className="space-y-5 relative">
              {/* PRO GATE OVERLAY (Safety Net) */}
              {profile?.plan !== "pro" && (
                <div className="absolute inset-x-0 -inset-y-4 z-20 flex flex-col items-center justify-center backdrop-blur-md bg-slate-950/60 rounded-3xl border border-white/5">
                   <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-sm text-center shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 blur-3xl rounded-full"></div>
                      
                      <button onClick={handleUpgrade} className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-xl transition-all shadow-lg">
                         Go PRO (₹49/mo)
                      </button>
                   </div>
                </div>
              )}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                  <span className={`flex items-center gap-1.5 font-semibold text-xs text-slate-600`}><span className={`w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 text-slate-500`}>1</span>Setup</span>
                  <span className="w-6 h-px bg-slate-800" />
                  <span className={`flex items-center gap-1.5 font-semibold text-xs text-pink-400`}><span className={`w-5 h-5 rounded-full flex items-center justify-center bg-pink-600 text-white`}>2</span>Review Script</span>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-300">Dialogue Script</label>
                  <span className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-1 rounded-full">Keep [Name: text] format</span>
                </div>
                <textarea
                  rows={16}
                  value={editedScript}
                  onChange={e => setEditedScript(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all font-mono text-sm resize-none leading-relaxed"
                />
               
                <div className="flex items-center gap-4 pt-1">
                  <button
                    onClick={handleGenerateAudio}
                    disabled={audioLoading || !editedScript.trim()}
                    className={`w-full h-12 flex items-center justify-center gap-2 px-6 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-pink-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed`}
                  >
                    {audioLoading ? <Spinner /> : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Generate Broadcast Audio
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && <ErrorBox message={error} />}
            </div>
          )}

          {/* ---- MUSIC MODE ---- */}
          {mode === "music" && (
            <div className="space-y-5">
               <div className="bg-slate-900/60 border border-slate-700 p-12 rounded-2xl text-center shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[500px]">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                  
                  <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(16,185,129,0.25)] relative z-10">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-4 relative z-10 tracking-tight">
                    AI Music Studio <span className="text-emerald-400 block sm:inline mt-1 sm:mt-0">Coming Soon</span>
                  </h3>
                  <p className="text-slate-400 mb-3 leading-relaxed max-w-md relative z-10 text-sm sm:text-base">
                    Google's Lyria 3 production models are currently in a restricted preview phase with specialized billing limits.
                  </p>
                  <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-md relative z-10">
                    Once fully rolled out, Pro users will be able to generate beautiful high-fidelity instrumental and lyrical music tracks natively in your studio natively. Stay tuned!
                  </p>
               </div>
            </div>
          )}

          {/* ---- IMAGE MODE ---- */}
          {mode === "image" && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl relative overflow-hidden shadow-xl">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none"></div>
                 <h2 className="text-2xl font-black text-white flex items-center gap-3 relative z-10">
                   <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   AI Image Studio
                 </h2>
                 <p className="text-slate-400 mt-2 font-medium max-w-xl text-sm relative z-10">
                   Type a simple idea and our Gemini prompt engineer will heavily detail and stylize it before passing it into our top-tier image generator. No GPU required.
                 </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
                 <div>
                   <label className="flex items-center justify-between text-sm font-semibold text-slate-300 mb-2">
                     Describe your image
                     <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">Enhanced Automatically</span>
                   </label>
                   <textarea
                     rows={4}
                     value={imagePrompt}
                     onChange={e => setImagePrompt(e.target.value)}
                     placeholder="e.g., A red cyberpunk car drifting in a neon Tokyo street..."
                     className="w-full bg-slate-800/80 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 outline-none transition-all text-sm resize-none"
                   />
                 </div>

                 {error && <ErrorBox message={error} />}

                 <button
                    onClick={handleGenerateImage}
                    disabled={imageGenerating || !imagePrompt.trim()}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed"
                  >
                    {imageGenerating ? <><Spinner /> Enhancing & Generating Image…</> : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        Generate Masterpiece
                      </>
                    )}
                  </button>
              </div>
            </div>
          )}
        </main>

        {/* ===== RIGHT: PRO/SETTINGS SIDEBAR (Feature Flagged) ===== */}
        {ENABLE_PRO_SIDEBAR && (
          <ProSidebar
            isPro={profile?.plan === 'pro'}
            onUpgradeClick={handleUpgrade}
            savedKeyStatus={profile?.hasOwnApiKey ? "active" : "none"}
            onSaveKey={handleSaveApiKey}
            mobileOpen={showProSidebarMobile}
            onCloseMobile={() => setShowProSidebarMobile(false)}
          />
        )}
      </div>

      {/* OLD SIDE PANEL FOR PRO SETTINGS (Fallback if ENABLE_PRO_SIDEBAR is false) */}
      {!ENABLE_PRO_SIDEBAR && (
        <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${showSettings ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>

          {/* Sliding Panel */}
          <div className={`absolute top-0 right-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl transition-transform duration-300 transform flex flex-col ${showSettings ? "translate-x-0" : "translate-x-full"}`}>

            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
                Pro Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Custom API Key Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3">Gemini API Configuration</h3>
                <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                  Unlock your studio's full potential by bringing your own Gemini API key. This bypasses our server limits entirely and allows uncapped generation.
                </p>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-indigo-500/20 p-1">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-indigo-200 font-semibold mb-1">Need an API Key?</p>
                      <p className="text-xs text-indigo-300/80 mb-3 leading-relaxed">
                        You can generate your own free Gemini API key in less than a minute from the Google AI Studio.
                      </p>
                      <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors">
                        Get your API key
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Your API Key
                      {profile?.hasOwnApiKey && <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">Active</span>}
                    </label>
                    <input
                      type="password"
                      value={customKey}
                      onChange={e => setCustomKey(e.target.value)}
                      placeholder={profile?.hasOwnApiKey ? "•••••••••••••••••••••••• (Set)" : "AQ.Ab8... or AIzaSy..."}
                      className="w-full bg-slate-950/50 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm transition-all shadow-inner"
                    />
                  </div>
                  {customKeyError && <ErrorBox message={customKeyError} />}
                  {customKeySuccess && <div className="text-emerald-400 text-xs font-medium p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>{customKeySuccess}</div>}

                  <button
                    onClick={() => handleSaveApiKey()}
                    disabled={savingKey || !customKey}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {savingKey ? <span className="flex items-center justify-center gap-2"><Spinner /> Saving...</span> : "Save API Key"}
                  </button>
                </div>
              </div>
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
  isPro,
  language,
}: {
  voice: string;
  onVoiceChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
  accentClass: string;
  isPro: boolean;
  language: "hindi" | "english";
}) {
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const toggleSample = () => {
    if (isPlayingSample && sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      setIsPlayingSample(false);
      return;
    }

    // Play sample
    const audio = new Audio(`/samples/${language}/${voice.toLowerCase()}.wav`);
    audio.onended = () => setIsPlayingSample(false);
    audio.onerror = () => {
      setIsPlayingSample(false);
      toast.error(`Sample audio not found locally yet for ${voice} (${language}).`, "Missing File");
    };
    audio.play().then(() => setIsPlayingSample(true)).catch(() => setIsPlayingSample(false));
    sampleAudioRef.current = audio;
  }

  // Effect to clean up audio on unmount or voice change
  useEffect(() => {
    return () => {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
      }
    }
  }, [voice, language]);

  return (
    <div className="flex flex-col w-full sm:flex-row sm:items-center gap-3 pt-1">
      <div className="w-full sm:w-[220px] shrink-0 h-11 relative">
        <select
          value={voice}
          onChange={e => onVoiceChange(e.target.value)}
          className="w-full h-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 text-slate-200 outline-none text-sm transition-colors appearance-none pr-10 cursor-pointer"
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
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {isPro ? (
        <button
          onClick={toggleSample}
          className={`flex items-center justify-center h-11 gap-1.5 px-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-all shrink-0 ${isPlayingSample ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 shadow-inner drop-shadow-md" : ""}`}
          title="Play voice sample"
        >
          {isPlayingSample ? (
            <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" /></svg>
          ) : (
            <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
          )}
          {isPlayingSample ? "Stop" : "Sample"}
        </button>
      ) : (
        <button
          disabled
          className="flex items-center justify-center h-11 gap-1.5 px-4 bg-slate-950 border border-slate-800 text-slate-600 rounded-xl text-sm font-bold shrink-0 cursor-not-allowed"
          title="Voice samples are a Pro feature"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
          Sample <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-wider ml-0.5">Pro</span>
        </button>
      )}

      {/* Spacer to push Generate to the right like flex-1 would do */}
      <div className="flex-1 hidden sm:block"></div>

      <button
        onClick={onGenerate}
        disabled={loading || disabled}
        className={`w-full sm:w-[170px] h-11 shrink-0 flex items-center justify-center gap-2 px-6 bg-gradient-to-r ${accentClass} disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 disabled:shadow-none active:scale-[0.98] disabled:cursor-not-allowed`}
      >
        {loading ? (
          <><Spinner /></>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Generate Audio
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
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${language === "hindi"
          ? "bg-orange-500 text-white shadow"
          : "text-slate-400 hover:text-white"
          }`}
      >
        🇮🇳 हिन्दी
      </button>
      <button
        onClick={() => onChange("english")}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${language === "english"
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
