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
  isAdmin?: boolean;
  // All-time totals
  directTtsCount: number;
  aiScriptCount: number;
  broadcastCount: number;
  imageCount: number;
  musicCount: number;
  // Daily counts (reset UTC midnight)
  dailyDirectTtsCount: number;
  dailyAiScriptCount: number;
  dailyBroadcastCount: number;
  dailyImageCount: number;
  // Limits returned from server
  proLimits: {
    directTts: number;
    aiScript: number;
    broadcast: number;
    image: number;
  };
  hasOwnApiKey: boolean;
  ownApiKey: string | null;
  hasOwnDriveKey: boolean;
  ownDriveKey: string | null;
  planActivatedAt: string | null;
  planExpiresAt?: string | null;
  daysLeft?: number | null;
  paymentCount?: number;
}

const LANG_KEY = "voicegen_language";

interface VoiceEntry { name: string; gender: "female" | "male" }

const VOICE_LIST: VoiceEntry[] = [
  // Female
  { name: "Sunidhi", gender: "female" },
  { name: "Priyanka", gender: "female" },
  { name: "Priya", gender: "female" },
  { name: "Devanshi", gender: "female" },
  { name: "Ananya", gender: "female" },
  { name: "Shreya", gender: "female" },
  { name: "Kavya", gender: "female" },
  { name: "Neha", gender: "female" },
  { name: "Riya", gender: "female" },
  { name: "Sneha", gender: "female" },
  { name: "Aditi", gender: "female" },
  { name: "Pooja", gender: "female" },
  { name: "Shruti", gender: "female" },
  { name: "Meera", gender: "female" },
  // Male
  { name: "Dev", gender: "male" },
  { name: "Ram", gender: "male" },
  { name: "Raushan", gender: "male" },
  { name: "Devsheel", gender: "male" },
  { name: "Aryan", gender: "male" },
  { name: "Kabir", gender: "male" },
  { name: "Rohan", gender: "male" },
  { name: "Rahul", gender: "male" },
  { name: "Vikram", gender: "male" },
  { name: "Aditya", gender: "male" },
  { name: "Karan", gender: "male" },
  { name: "Arjun", gender: "male" },
  { name: "Sameer", gender: "male" },
  { name: "Aman", gender: "male" },
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
  imageBase64?: string;
  createdAt: Date;
}

const VOICES = [
  "Sunidhi", "Dev", "Ram", "Raushan", "Priyanka", "Priya", "Devanshi", "Ananya",
  "Devsheel", "Aryan", "Kabir", "Rohan", "Shreya", "Kavya", "Rahul",
  "Vikram", "Neha", "Riya", "Aditya", "Sneha", "Aditi",
  "Pooja", "Karan", "Arjun", "Shruti", "Sameer",
  "Aman", "Meera",
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

  const [voice, setVoice] = useState("Ananya");
  const [voice1, setVoice1] = useState("Devsheel");
  const [voice2, setVoice2] = useState("Sunidhi");

  // Music State
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicLyrics, setMusicLyrics] = useState("");
  const [musicDuration, setMusicDuration] = useState<"30s" | "full">("30s");
  const [musicInstrumental, setMusicInstrumental] = useState(false);

  // Image State
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageGenerating, setImageGenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; prompt: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  
  // Live Session Trackers
  const [sessionTokens, setSessionTokens] = useState(0);
  const [sessionAudioRequests, setSessionAudioRequests] = useState(0);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
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
  useEffect(() => { 
    setHasMounted(true);
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
        name: "GENBOX",
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

  const handleSaveApiKey = async (key: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/user/update-api-key", {
        method: "POST",
        body: JSON.stringify({ apiKey: key }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await fetchProfile();
        toast.success("API Key saved successfully!", "Key Updated");
        return true;
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to save key");
      }
    } catch (err: any) {
      toast.error(err.message, "Error");
      return false;
    }
  };


  const [audioHistory, setAudioHistory] = useState<AudioItem[]>([]);
  const [historyTab, setHistoryTab] = useState<"recent" | "drive">("recent");
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveStatus, setDriveStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");

  const fetchDriveFiles = async () => {
    setDriveLoading(true);
    try {
      const res = await fetch("/api/user/list-drive-files");
      const data = await res.json();
      if (res.ok) {
        setDriveFiles(data.files || []);
      } else {
        console.error("Drive Fetch Error:", data.error);
      }
    } catch (err) {
      console.error("Drive Network Error:", err);
    } finally {
      setDriveLoading(false);
    }
  };

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
          setProfile(prev => prev ? { ...prev, broadcastCount: data.usage.broadcastCount, dailyBroadcastCount: data.usage.dailyBroadcastCount ?? prev.dailyBroadcastCount } : null);
        } else {
          setProfile(prev => prev ? { ...prev, aiScriptCount: data.usage.aiScriptCount, dailyAiScriptCount: data.usage.dailyAiScriptCount ?? prev.dailyAiScriptCount } : null);
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
    setDriveStatus("idle");
    if (profile?.hasOwnDriveKey) setDriveStatus("processing");

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
           setProfile(prev => prev ? { ...prev, broadcastCount: data.usage.broadcastCount, dailyBroadcastCount: data.usage.dailyBroadcastCount ?? prev.dailyBroadcastCount } : null);
           // Auto-reset so user can create a new broadcast immediately
           setStage("input");
           setEditedScript("");
           setUserIdea("");
           setError("");
        } else {
           setProfile(prev => prev ? { ...prev, directTtsCount: data.usage.directTtsCount, dailyDirectTtsCount: data.usage.dailyDirectTtsCount ?? prev.dailyDirectTtsCount } : null);
        }
      }

      if (data.driveUploadStatus === "success") {
        setDriveStatus("success");
      } else if (data.driveUploadStatus === "failed") {
        setDriveStatus("failed");
      }
    } catch (err: any) {
      setDriveStatus("failed");
      toast.error(err.message || "Failed to generate audio. Please try again.", "Generation Failed");
      setError(err.message);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) return;
    setAudioLoading(true);
    setError("");
    setDriveStatus("idle");
    if (profile?.hasOwnDriveKey) setDriveStatus("processing");

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
      
      if (data.driveUploadStatus === "success") {
        setDriveStatus("success");
      } else if (data.driveUploadStatus === "failed") {
        setDriveStatus("failed");
      }
    } catch (err: any) {
      setDriveStatus("failed");
      toast.error(err.message || "Failed to generate Music.", "Generation Failed");
      setError(err.message);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setImageGenerating(true);
    setError("");
    setDriveStatus("idle");
    if (profile?.hasOwnDriveKey) setDriveStatus("processing");

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.limitReached) {
          setError(data.error);
          toast.warning(data.error, "Daily Limit Reached");
          return;
        }
        throw new Error(data.error || "Failed to generate image");
      }

      const newItem: AudioItem = {
        id: Date.now().toString(),
        type: "image",
        voice: "Pollinations AI",
        scriptPreview: data.enhancedPrompt,
        imageBase64: data.imageBase64,
        createdAt: new Date(),
      };
      
      setAudioHistory(prev => [newItem, ...prev]);
      toast.success("AI Image generated! Check your history.", "Image Ready");
      setImagePrompt("");

      // Update daily image counter in local state immediately
      if (data.usage) {
        setProfile(prev => prev ? {
          ...prev,
          imageCount: data.usage.imageCount,
          dailyImageCount: data.usage.dailyImageCount ?? prev.dailyImageCount,
        } : null);
      }

      if (data.driveUploadStatus === "success") {
        setDriveStatus("success");
      } else if (data.driveUploadStatus === "failed") {
        setDriveStatus("failed");
      }
    } catch (err: any) {
      setDriveStatus("failed");
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

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isUnlimited = profile?.isAdmin || false;
  const BROADCAST_LIMIT = profile?.proLimits?.broadcast ?? 5;
  const broadcastCount = profile?.dailyBroadcastCount ?? 0;
  const broadcastReached = !isUnlimited && (broadcastCount >= BROADCAST_LIMIT);


  const [activeMobileColumn, setActiveMobileColumn] = useState<"vault" | "stage" | "command">("stage");

  if (!hasMounted) return null;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#050505] selection:bg-indigo-500/30 overflow-hidden">
      {/* --- PREMIUM HEADER --- */}
      <header className="h-20 shrink-0 border-b border-indigo-500/20 bg-[#0a0f1f]/95 backdrop-blur-3xl sticky top-0 z-[100] px-4 md:px-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="h-full flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex flex-col">
                <span className="font-black text-white tracking-tighter text-3xl leading-tight uppercase group-hover:text-indigo-400 transition-colors">GenBox</span>
                <span className="text-xs text-indigo-300 font-bold tracking-[0.2em] uppercase leading-none">Generative Production Studio</span>
              </div>
            </Link>
          </div>

          <div className="hidden xl:flex items-center gap-4">
             <Link href="/blog" className="text-sm font-black uppercase tracking-widest text-indigo-100/70 hover:text-white transition-all">
               Blogs
             </Link>
             <button onClick={() => setShowSettings(true)} className="px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest text-indigo-100/70 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               Settings
             </button>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
             {profile && (
              <div className="hidden md:flex items-center gap-4">
                {profile.plan === "pro" ? (
                  <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.05] px-3 py-1.5 rounded-2xl">
                    {/* Direct TTS */}
                    <div className="flex flex-col items-center border-r border-white/10 pr-3 mr-1">
                      <span className="text-[9px] font-bold text-indigo-300/50 uppercase tracking-widest">Direct</span>
                      <span className={`text-xs font-mono font-black ${!isUnlimited && (profile.dailyDirectTtsCount ?? 0) >= (profile.proLimits?.directTts ?? 9) ? 'text-red-400' : 'text-cyan-400'}`}>
                        {isUnlimited ? '∞' : `${profile.dailyDirectTtsCount ?? 0}/${profile.proLimits?.directTts ?? 9}`}
                      </span>
                    </div>
                    {/* AI Scripts */}
                    <div className="flex flex-col items-center border-r border-white/10 pr-3 mr-1">
                      <span className="text-[9px] font-bold text-indigo-300/50 uppercase tracking-widest">Scripts</span>
                      <span className={`text-xs font-mono font-black ${!isUnlimited && (profile.dailyAiScriptCount ?? 0) >= (profile.proLimits?.aiScript ?? 9) ? 'text-red-400' : 'text-violet-400'}`}>
                        {isUnlimited ? '∞' : `${profile.dailyAiScriptCount ?? 0}/${profile.proLimits?.aiScript ?? 9}`}
                      </span>
                    </div>
                    {/* Broadcast */}
                    <div className="flex flex-col items-center border-r border-white/10 pr-3 mr-1">
                      <span className="text-[9px] font-bold text-indigo-300/50 uppercase tracking-widest">Broadcast</span>
                      <span className={`text-xs font-mono font-black ${!isUnlimited && broadcastCount >= BROADCAST_LIMIT ? 'text-red-400' : 'text-pink-400'}`}>
                        {isUnlimited ? '∞' : `${Math.min(broadcastCount, BROADCAST_LIMIT)}/${BROADCAST_LIMIT}`}
                      </span>
                    </div>
                    {/* Images */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-indigo-300/50 uppercase tracking-widest">Images</span>
                      <span className={`text-xs font-mono font-black ${!isUnlimited && (profile.dailyImageCount ?? 0) >= (profile.proLimits?.image ?? 21) ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isUnlimited ? '∞' : `${profile.dailyImageCount ?? 0}/${profile.proLimits?.image ?? 21}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end hidden lg:flex">
                       <span className="text-[12px] font-bold text-indigo-300/70 uppercase tracking-widest">Free Account</span>
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-mono text-white/70">{profile.directTtsCount}/3 TTS</span>
                         <span className="text-white/20">|</span>
                         <span className={`text-sm font-mono font-bold ${broadcastCount >= BROADCAST_LIMIT ? 'text-red-400/80' : 'text-pink-400/80'}`}>{Math.min(broadcastCount, BROADCAST_LIMIT)}/{BROADCAST_LIMIT} BC</span>
                       </div>
                    </div>
                    {/* Hide upgrade button if they are already pro, but if they are here they aren't pro */}
                    <button onClick={handleUpgrade} className="px-6 py-3 bg-white text-black text-sm font-black rounded-xl hover:bg-indigo-400 hover:text-white transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] active:scale-95 uppercase tracking-widest">
                      Upgrade Studio
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="h-8 w-[1px] bg-white/10 hidden sm:block" />
            <div className="relative">
              <UserButton />
              {profile?.plan === 'pro' && (
                <div className={`absolute -top-1.5 -right-3 px-1.5 py-0.5 ${profile.isAdmin ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'} text-[8px] font-black text-white rounded-md border border-black z-10 uppercase tracking-tighter leading-none flex items-center justify-center`}>
                  {profile.isAdmin ? 'ADMIN' : 'PRO'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* --- MAIN PRODUCTION LAYOUT --- */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* === LEFT COLUMN: MEDIA VAULT (History) === */}
        <aside className={`w-full xl:w-[380px] xl:shrink-0 xl:border-r border-white/[0.05] bg-black/20 flex flex-col transition-all duration-500 absolute inset-0 xl:relative z-40 ${activeMobileColumn === 'vault' ? 'translate-x-0 opacity-100' : '-translate-x-full xl:translate-x-0 opacity-0 xl:opacity-100 pointer-events-none xl:pointer-events-auto'}`}>
          <div className="p-6 border-b border-white/[0.05] flex flex-col gap-4 bg-black/20 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Media Vault</h2>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Session History</span>
              </div>
              {audioHistory.length > 0 && (
                <div className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[10px] font-mono font-bold text-indigo-400">{audioHistory.length}</span>
                </div>
              )}
            </div>

            {/* TABS: RECENT vs DRIVE */}
            <div className="flex p-1 bg-white/[0.03] border border-white/5 rounded-xl">
              <button 
                onClick={() => setHistoryTab("recent")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${historyTab === 'recent' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Recent
              </button>
              <button 
                onClick={() => {
                  setHistoryTab("drive");
                  if (profile?.hasOwnDriveKey) fetchDriveFiles();
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${historyTab === 'drive' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                Drive
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 pb-24 xl:pb-4">
            {historyTab === "recent" ? (
              <>
                {audioLoading && (
                  <div className="glass-card rounded-2xl p-5 space-y-4 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-24 bg-white/5 rounded-full" />
                      <div className="h-3 w-12 bg-white/5 rounded-full" />
                    </div>
                    <div className="h-3 w-full bg-white/5 rounded-full" />
                    <div className="h-3 w-4/5 bg-white/5 rounded-full" />
                    <div className="h-10 w-full bg-white/5 rounded-xl" />
                  </div>
                )}

                {audioHistory.length === 0 && !audioLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20 space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center opacity-50">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed">No production assets found in current session.</p>
                  </div>
                ) : (
                  audioHistory.map((item, idx) => (
                    <div key={item.id} className={`group glass-card rounded-2xl p-4 transition-all duration-500 ${playingId === item.id ? 'ring-1 ring-indigo-500/50 bg-indigo-500/[0.08]' : ''}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-mono font-bold text-slate-500">
                            {audioHistory.length - idx}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tracking-wider">{item.voice}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{formatTime(item.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                           {item.type !== "image" && audioDurations[item.id] && (
                            <span className="text-[10px] font-mono text-indigo-400/80 font-bold">{audioDurations[item.id].toFixed(1)}s</span>
                          )}
                        </div>
                      </div>

                      {item.type === "image" ? (
                         <div className="space-y-3">
                           <button 
                             onClick={() => setPreviewImage({ url: item.imageBase64 ? `data:image/jpeg;base64,${item.imageBase64}` : item.imageUrl!, prompt: item.scriptPreview })}
                             className="relative w-full aspect-square overflow-hidden rounded-xl border border-white/[0.05] hover:border-indigo-500/50 transition-all duration-700 shadow-2xl group/img"
                           >
                             <img 
                                src={item.imageBase64 ? `data:image/jpeg;base64,${item.imageBase64}` : item.imageUrl} 
                                alt="AI Asset" 
                                className="w-full h-full object-cover grayscale-[0.5] group-hover/img:grayscale-0 transition-all duration-700" 
                             />
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] font-black text-white border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-xl uppercase tracking-widest">Enlarge Asset</span>
                             </div>
                           </button>
                           <p className="text-[10px] text-slate-500 font-medium leading-relaxed line-clamp-2 italic px-1 italic">"{item.scriptPreview}"</p>
                         </div>
                      ) : (
                        <div className="space-y-4">
                           <audio
                            ref={el => { audioRefs.current[item.id] = el; }}
                            src={`data:audio/wav;base64,${item.audioBase64}`}
                            onEnded={() => handleAudioEnded(item.id)}
                            className="hidden"
                          />
                          <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-3 font-mono opacity-80">
                            {item.scriptPreview}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePlay(item.id)}
                              className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${playingId === item.id
                                ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                                : "bg-white/5 text-white hover:bg-white/10"
                                }`}
                            >
                              {playingId === item.id ? (
                                <>
                                  <div className="flex gap-0.5 items-end h-3">
                                    <div className="w-0.5 h-full bg-white animate-[bounce_0.6s_infinite]" />
                                    <div className="w-0.5 h-2/3 bg-white animate-[bounce_0.8s_infinite]" />
                                    <div className="w-0.5 h-full bg-white animate-[bounce_0.5s_infinite]" />
                                  </div>
                                  Pause
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" /></svg>
                                  Play Clip
                                </>
                              )}
                            </button>
                            <a
                              href={`data:audio/wav;base64,${item.audioBase64}`}
                              download={`genbox-prod-${item.voice}-${item.id}.wav`}
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : (
              <div className="space-y-3">
                {driveLoading && (
                  <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Scanning Drive Forge...</p>
                  </div>
                )}
                
                {!driveLoading && driveFiles.length === 0 && (
                  <div className="text-center py-20 px-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mx-auto opacity-40">
                      <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                    </div>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">No backup files detected in your Google Drive.</p>
                  </div>
                )}

                {!driveLoading && driveFiles.map((file: any) => (
                  <a 
                    key={file.id} 
                    href={file.webViewLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                       <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-white font-black truncate group-hover:text-indigo-400 transition-colors">{file.name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{new Date(file.createdTime).toLocaleDateString()}</p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* === CENTER COLUMN: PRODUCTION STAGE (Main Editor) === */}
        <main className={`flex-1 flex flex-col bg-[#080808] relative overflow-hidden transition-all duration-500 z-30 ${activeMobileColumn === 'stage' ? 'translate-x-0 opacity-100' : (activeMobileColumn === 'vault' ? 'translate-x-1/2 opacity-0 lg:opacity-100' : '-translate-x-1/2 opacity-0 lg:opacity-100')}`}>
          {/* Background Decorative Element */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none -mr-40 -mt-40" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/5 blur-[100px] rounded-full pointer-events-none -ml-40 -mb-40" />

          {/* MODE SELECTOR - CYBER BAR */}
          <div className="shrink-0 p-4 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-10">
            <div className="flex items-center p-1.5 gap-1 bg-white/[0.02] border border-white/[0.05] rounded-2xl w-full lg:w-fit flex-wrap md:flex-nowrap">
              {[
                { id: 'direct',    label: 'Direct',    proOnly: false, icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
                { id: 'ai',        label: 'Scripts',   proOnly: false, icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' },
                { id: 'broadcast', label: 'Broadcast', proOnly: true,  icon: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.829 1.58-1.936a4.5 4.5 0 001.31-.433m-1.5 2.56a12.12 12.12 0 01-3 0m4.5-2.56V15.75' },
                { id: 'music',     label: 'Music',     proOnly: true,  icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
                { id: 'image',     label: 'Image',     proOnly: true,  icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.proOnly && profile?.plan !== 'pro') {
                      toast.warning('Upgrade to Pro to unlock Broadcast, Music & Image generation.', 'Pro Feature 🔒');
                      return;
                    }
                    handleModeSwitch(tab.id as Mode);
                  }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2.5 md:px-5 md:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 relative ${
                    mode === tab.id
                      ? 'bg-indigo-600 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.5)] z-20'
                      : tab.proOnly && profile?.plan !== 'pro'
                        ? 'text-slate-600 hover:text-slate-500 cursor-pointer'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  <span className="truncate">{tab.label}</span>
                  {tab.proOnly && profile?.plan !== 'pro' && (
                    <svg className="w-2.5 h-2.5 shrink-0 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V12a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {mode !== 'image' && mode !== 'music' && (
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] p-1 rounded-2xl w-fit">
                <button
                  onClick={() => handleLengthSwitch("short")}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${lengthMode === "short" ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >Standard</button>
                <button
                  onClick={() => handleLengthSwitch("long")}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${lengthMode === "long" ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Long Form
                  {profile?.plan !== "pro" && <svg className="w-3 h-3 opacity-60 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V12a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z" /></svg>}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 pb-24 xl:pb-10">
            <div className="max-w-4xl mx-auto space-y-10">
              
              {/* STAGE HEADER */}
              <div className="mt-4">
                 <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
                   {mode === 'direct' ? 'GenBox Forge' : mode === 'ai' ? 'Script Architect' : mode === 'broadcast' ? 'Broadcast Suite' : mode === 'music' ? 'Sonic Composer' : 'Visual Engine'}
                 </h1>
                 <p className="text-slate-500 mt-2 text-xs md:text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   System Online • Ready for Production
                 </p>
              </div>

              {/* --- DYNAMIC WORKSPACE CONTENT --- */}
              {mode === "direct" && (
                <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 border-white/[0.05] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                    <svg className="w-40 h-40 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-1.5c-4.694 0-8.5-3.806-8.5-8.5S7.306 3.5 12 3.5s8.5 3.806 8.5 8.5-3.806 8.5-8.5 8.5zm3.5-8.5h-1.5v-3a.75.75 0 00-1.5 0v3h-1.5a.75.75 0 000 1.5h1.5v3a.75.75 0 001.5 0v-3h1.5a.75.75 0 000-1.5z" /></svg>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Input Script</label>
                       <span className={`text-[10px] font-mono font-bold ${directScript.length >= (lengthMode === "short" ? 2000 : 9000) ? 'text-red-500' : 'text-indigo-400'}`}>
                         {directScript.length.toLocaleString()} / {(lengthMode === "short" ? 2000 : 9000).toLocaleString()}
                       </span>
                    </div>
                    <div className="relative group">
                       <textarea
                        rows={10}
                        value={directScript}
                        onChange={e => setDirectScript(e.target.value)}
                        placeholder="Enter text to synthesize... Use [tags] for expression."
                        className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-indigo-500/50 rounded-2xl px-6 py-5 text-white placeholder:text-slate-600 outline-none transition-all font-mono text-sm leading-relaxed resize-none group-hover:bg-white/[0.04]"
                      />
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        <button onClick={() => setDirectScript("")} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-[9px] font-black text-slate-400 hover:text-red-400 uppercase tracking-widest border border-white/5 transition-all">Clear</button>
                      </div>
                    </div>
                  </div>

                  <InlineVoiceGenRow
                    voice={voice}
                    onVoiceChange={setVoice}
                    onGenerate={handleGenerateAudio}
                    loading={audioLoading}
                    disabled={!directScript.trim()}
                    accentClass="from-indigo-600 to-indigo-500 hover:scale-[1.02]"
                    isPro={profile?.plan === 'pro' || Boolean(profile?.isAdmin)}
                    language={language}
                    driveStatus={driveStatus}
                  />
                </div>
              )}

              {mode === "ai" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                   {/* Prompt Area */}
                   <div className="glass-panel rounded-3xl p-6 md:p-8 border-white/[0.05]">
                      <div className="flex items-center justify-between mb-6">
                         <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Creative Direction</span>
                            <span className="text-xs text-slate-500 font-bold mt-1">Pick a theme or describe your vision</span>
                         </div>
                         <LanguageToggle language={language} onChange={handleLanguageChange} />
                      </div>

                      <div className="flex flex-wrap gap-2 mb-8">
                        {SAMPLE_PROMPTS.map(sp => (
                          <button
                            key={sp.label}
                            onClick={() => { setUserIdea(sp.prompt); if(stage === 'review') setStage('input'); }}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${userIdea === sp.prompt ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                          >
                            {sp.label}
                          </button>
                        ))}
                      </div>

                      {stage === 'input' ? (
                        <div className="space-y-6">
                           <textarea
                            rows={6}
                            value={userIdea}
                            onChange={e => setUserIdea(e.target.value)}
                            placeholder="Describe the mood, tone, and story..."
                            className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-indigo-500/50 rounded-2xl px-6 py-5 text-white outline-none transition-all text-sm leading-relaxed resize-none"
                          />
                          
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                             <div className="flex-1">
                                <div className="flex items-center justify-between mb-4">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Production Length</span>
                                   <span className="text-xs font-mono font-bold text-indigo-400">{scriptDuration} MIN</span>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max={lengthMode === "short" ? "2" : "10"}
                                  value={scriptDuration}
                                  onChange={e => setScriptDuration(parseInt(e.target.value))}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                             </div>
                             <button
                                onClick={() => handleGenerateScript()}
                                disabled={loading || !userIdea.trim()}
                                className="h-14 px-10 bg-white text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-xl disabled:opacity-30 flex items-center gap-3 shrink-0"
                              >
                                {loading ? <Spinner /> : 'Build Master Script'}
                              </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6 animate-in zoom-in-95 duration-500">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Generated Script Output</span>
                              <button onClick={() => setStage('input')} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">← Back to Idea</button>
                           </div>
                           <textarea
                            rows={16}
                            value={editedScript}
                            onChange={e => setEditedScript(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/[0.1] focus:border-indigo-500/50 rounded-2xl px-6 py-5 text-white font-mono text-sm leading-relaxed resize-none"
                          />
                          <InlineVoiceGenRow
                            voice={voice}
                            onVoiceChange={setVoice}
                            onGenerate={handleGenerateAudio}
                            loading={audioLoading}
                            disabled={!editedScript.trim()}
                            accentClass="from-emerald-600 to-emerald-500 shadow-emerald-500/20"
                            isPro={profile?.plan === 'pro' || Boolean(profile?.isAdmin)}
                            language={language}
                            driveStatus={driveStatus}
                          />
                        </div>
                      )}
                   </div>
                </div>
              )}

              {mode === "broadcast" && (
                <div className="space-y-8 relative animate-in fade-in duration-700">
                   {profile?.plan !== "pro" && <ProGateOverlay onUpgrade={handleUpgrade} feature="Broadcast" />}
                   
                   <div className="glass-panel rounded-3xl p-6 md:p-8 border-white/[0.05]">
                      {stage === 'input' ? (
                        <div className="space-y-8">
                           <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Broadcast Concept</span>
                              <textarea
                                rows={4}
                                value={userIdea}
                                onChange={e => setUserIdea(e.target.value)}
                                placeholder="Describe the debate, interview, or talk show theme..."
                                className="mt-4 w-full bg-white/[0.02] border border-white/[0.08] focus:border-pink-500/50 rounded-2xl px-6 py-5 text-white outline-none transition-all text-sm leading-relaxed resize-none"
                              />
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead Moderator</label>
                                <VoiceSelector voice={voice1} onChange={setVoice1} />
                              </div>
                              <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Invited Guest</label>
                                <VoiceSelector voice={voice2} onChange={setVoice2} />
                              </div>
                           </div>

                           <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-6">
                              <div className="flex-1 w-full">
                                <div className="flex items-center justify-between mb-4">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Length</span>
                                   <span className="text-xs font-mono font-bold text-pink-400">{scriptDuration} MIN</span>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max={lengthMode === "short" ? "2" : "5"}
                                  value={scriptDuration}
                                  onChange={e => setScriptDuration(parseInt(e.target.value))}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                />
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleGenerateScript()}
                                 disabled={loading || !userIdea.trim() || voice1 === voice2 || (!isUnlimited && broadcastReached)}
                                  className={`w-full md:w-auto h-14 px-10 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-pink-600/20
                                    ${broadcastReached
                                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                      : 'bg-pink-600 text-white hover:bg-pink-500 active:scale-95 disabled:opacity-30'}`}
                                >
                                  {loading ? <Spinner /> : (isUnlimited ? 'Design Dialogue' : (broadcastReached ? 'Limit Reached' : 'Design Dialogue'))}
                                </button>
                                <span className={`text-[10px] font-mono font-bold ${!isUnlimited && broadcastCount >= BROADCAST_LIMIT ? 'text-red-400' : 'text-slate-600'}`}>
                                  {isUnlimited ? 'UNLIMITED PRODUCTION' : `${Math.min(broadcastCount, BROADCAST_LIMIT)}/${BROADCAST_LIMIT} broadcasts used`}
                                </span>
                              </div>
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-pink-400 uppercase tracking-[0.2em]">Dialogue Production Script</span>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-mono font-bold ${broadcastCount >= BROADCAST_LIMIT ? 'text-red-400' : 'text-pink-400/70'}`}>
                                  {Math.min(broadcastCount, BROADCAST_LIMIT)}/{BROADCAST_LIMIT} used
                                </span>
                                <button 
                                  onClick={() => { setStage('input'); setEditedScript(''); setUserIdea(''); setError(''); }}
                                  className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg"
                                >
                                  ✕ Clear &amp; Restart
                                </button>
                              </div>
                           </div>
                           <textarea
                            rows={16}
                            value={editedScript}
                            onChange={e => setEditedScript(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/[0.1] focus:border-pink-500/50 rounded-2xl px-6 py-5 text-white font-mono text-sm leading-relaxed resize-none"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleGenerateScript()}
                              disabled={loading || !userIdea.trim() || voice1 === voice2 || broadcastReached}
                              className="h-14 px-6 font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all border border-pink-500/40 text-pink-400 hover:bg-pink-500/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                            >
                              {loading ? <Spinner /> : '↻ New Script'}
                            </button>
                            <button
                              onClick={handleGenerateAudio}
                              disabled={audioLoading || !editedScript.trim() || (!isUnlimited && broadcastReached)}
                              className={`flex-1 h-14 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-2xl shadow-pink-600/20 flex items-center justify-center gap-3 relative
                                ${(!isUnlimited && broadcastReached) 
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' 
                                  : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white active:scale-95 disabled:opacity-30'}`}
                            >
                              {audioLoading ? <Spinner /> : (
                                <div className="flex flex-col items-center gap-0.5">
                                   {driveStatus && driveStatus !== 'idle' && (
                                     <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border backdrop-blur-md transition-all duration-500 flex items-center gap-1 ${
                                       driveStatus === 'processing' ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' :
                                       driveStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                       'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                     }`}>
                                       <div className={`w-1 h-1 rounded-full ${driveStatus === 'processing' ? 'bg-pink-400 animate-pulse' : driveStatus === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                       {driveStatus === 'processing' ? 'Syncing...' : driveStatus === 'success' ? 'Backed Up' : 'Sync Fail'}
                                     </div>
                                   )}
                                   <span>{isUnlimited ? 'Produce Broadcast Master' : (broadcastReached ? `Limit Reached (${BROADCAST_LIMIT}/${BROADCAST_LIMIT})` : 'Produce Broadcast Master')}</span>
                                </div>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                   </div>
                </div>
              )}

              {mode === "music" && (
                <div className="space-y-8 animate-in fade-in duration-700">
                   <div className="glass-panel rounded-3xl p-6 md:p-8 border-white/[0.05]">
                      <div className="flex flex-col mb-6">
                         <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Music Composition</span>
                         <span className="text-xs text-slate-500 font-bold mt-1">Compose high-fidelity AI music with Lyria 3</span>
                      </div>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Melody & Mood Prompt</label>
                          <textarea
                            rows={3}
                            value={musicPrompt}
                            onChange={e => setMusicPrompt(e.target.value)}
                            placeholder="e.g., A lo-fi hip hop track with a chill rainy vibe..."
                            className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-emerald-500/50 rounded-2xl px-6 py-4 text-white outline-none transition-all text-sm leading-relaxed resize-none"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lyrics (Optional)</label>
                          <textarea
                            rows={3}
                            value={musicLyrics}
                            onChange={e => setMusicLyrics(e.target.value)}
                            placeholder="Enter lyrics for the AI to sing..."
                            className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-emerald-500/50 rounded-2xl px-6 py-4 text-white outline-none transition-all text-sm leading-relaxed resize-none"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</span>
                            <div className="flex bg-black/40 p-1 rounded-xl gap-1">
                              <button onClick={() => setMusicDuration("30s")} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${musicDuration === '30s' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>30s</button>
                              <button onClick={() => setMusicDuration("full")} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${musicDuration === 'full' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Full</button>
                            </div>
                          </div>
                          <button 
                            onClick={() => setMusicInstrumental(!musicInstrumental)}
                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${musicInstrumental ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.02] border-white/[0.05] text-slate-400'}`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest">Instrumental Mode</span>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${musicInstrumental ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${musicInstrumental ? 'right-1' : 'left-1'}`} />
                            </div>
                          </button>
                        </div>

                        <div className="relative pt-4">
                           {driveStatus && driveStatus !== 'idle' && (
                             <div className={`absolute top-0 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border backdrop-blur-md transition-all duration-500 flex items-center gap-1 z-10 ${
                               driveStatus === 'processing' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                               driveStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                               'bg-rose-500/20 text-rose-400 border-rose-500/30'
                             }`}>
                               <div className={`w-1 h-1 rounded-full ${driveStatus === 'processing' ? 'bg-emerald-400 animate-pulse' : driveStatus === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                               {driveStatus === 'processing' ? 'Syncing...' : driveStatus === 'success' ? 'Backed Up' : 'Sync Fail'}
                             </div>
                           )}
                           <button
                             onClick={handleGenerateMusic}
                             disabled={audioLoading || !musicPrompt.trim()}
                             className="w-full h-16 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-2xl shadow-emerald-600/20 flex items-center justify-center gap-3"
                           >
                             {audioLoading ? <Spinner /> : 'Orchestrate AI Music'}
                           </button>
                        </div>
                      </div>
                   </div>
                </div>
              )}

              {mode === "image" && (
                <div className="space-y-8 animate-in fade-in duration-700">
                   <div className="glass-panel rounded-3xl p-6 md:p-8 border-white/[0.05]">
                      <div className="flex flex-col mb-6">
                         <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Visual Concept</span>
                         <span className="text-xs text-slate-500 font-bold mt-1">Gemini will enhance your prompt into a technical masterpiece</span>
                      </div>
                      <textarea
                        rows={6}
                        value={imagePrompt}
                        onChange={e => setImagePrompt(e.target.value)}
                        placeholder="Describe the image... e.g., A cinematic shot of a futuristic data center..."
                        className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-cyan-500/50 rounded-2xl px-6 py-5 text-white outline-none transition-all text-sm leading-relaxed resize-none"
                      />
                      <div className="relative">
                         {driveStatus && driveStatus !== 'idle' && (
                           <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border backdrop-blur-md transition-all duration-500 flex items-center gap-1 z-10 ${
                             driveStatus === 'processing' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                             driveStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                             'bg-rose-500/20 text-rose-400 border-rose-500/30'
                           }`}>
                             <div className={`w-1 h-1 rounded-full ${driveStatus === 'processing' ? 'bg-cyan-400 animate-pulse' : driveStatus === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                             {driveStatus === 'processing' ? 'Syncing...' : driveStatus === 'success' ? 'Backed Up' : 'Sync Fail'}
                           </div>
                         )}
                        <button
                          onClick={handleGenerateImage}
                          disabled={imageGenerating || !imagePrompt.trim()}
                          className="mt-6 w-full h-14 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-2xl shadow-cyan-600/20 flex items-center justify-center gap-3"
                        >
                          {imageGenerating ? <><Spinner /> Refining prompt & generating...</> : 'Render Visual Asset'}
                        </button>
                      </div>
                   </div>
                </div>
              )}

              {error && <ErrorBox message={error} />}
            </div>
          </div>
        </main>

        {/* === RIGHT COLUMN: COMMAND CENTER (Pro Settings) === */}
        {/* Overlay backdrop for desktop when drawer is open */}
        {showSettings && (
          <div className="hidden xl:block fixed inset-0 z-[140] bg-black/50 backdrop-blur-sm transition-all" onClick={() => setShowSettings(false)} />
        )}
        <aside className={`w-full xl:w-[400px] xl:shrink-0 xl:border-l border-white/[0.05] bg-black/80 xl:backdrop-blur-3xl flex flex-col transition-all duration-500 absolute xl:fixed right-0 top-0 bottom-0 z-[150] ${activeMobileColumn === 'command' || showSettings ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 xl:opacity-100 xl:translate-x-full pointer-events-none'}`}>
          <div className="p-4 md:p-6 border-b border-white/[0.05] bg-black/40 backdrop-blur-xl flex items-center justify-between">
             <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Command Center</h2>
             <button onClick={() => { setActiveMobileColumn('stage'); setShowSettings(false); }} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
          <ProSidebar
            isPro={profile?.plan === 'pro'}
            onUpgradeClick={handleUpgrade}
            savedKeyStatus={profile?.hasOwnApiKey ? "active" : "none"}
            initialKey={profile?.ownApiKey}
            onSaveKey={handleSaveApiKey}
            mobileOpen={activeMobileColumn === 'command' || showSettings}
            onCloseMobile={() => { setActiveMobileColumn('stage'); setShowSettings(false); }}
            profile={profile}
          />
        </aside>

      </div>

      {/* --- MOBILE NAVIGATION BAR --- */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/60 backdrop-blur-2xl border-t border-white/[0.05] z-50 flex items-center justify-around px-4 pb-safe">
        {[
          { id: 'vault', label: 'Vault', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
          { id: 'stage', label: 'Stage', icon: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z' },
          { id: 'command', label: 'Pro', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z' },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setActiveMobileColumn(btn.id as any)}
            className={`flex flex-col items-center gap-1 transition-all ${activeMobileColumn === btn.id ? 'text-indigo-400' : 'text-slate-500'}`}
          >
            <div className={`p-1.5 rounded-lg transition-all ${activeMobileColumn === btn.id ? 'bg-indigo-500/10' : ''}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={btn.icon} />
              </svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* --- PREMIUM FULLSCREEN IMAGE PREVIEW --- */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-10 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="absolute inset-0 cursor-zoom-out" onClick={() => setPreviewImage(null)} />
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 md:top-8 md:right-8 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-[250] shadow-2xl border border-white/10 cursor-pointer">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center z-10 pointer-events-none">
            <div className="relative group w-full flex justify-center pointer-events-auto">
               <img src={previewImage.url} alt="AI Preview" className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 transition-transform duration-700" />
               <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_100px_rgba(0,0,0,0.4)] pointer-events-none" />
            </div>
            <div className="mt-8 bg-white/[0.03] border border-white/[0.08] p-6 rounded-2xl w-full max-w-2xl backdrop-blur-xl">
               <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">AI Synthesis Concept</span>
               <p className="text-white/80 text-sm font-medium leading-relaxed italic">"{previewImage.prompt}"</p>
               <div className="mt-6 flex justify-center">
                 <a href={previewImage.url} download="genbox-asset.jpg" className="px-8 py-3 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-indigo-500 hover:text-white transition-all shadow-xl">Download Master Asset</a>
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
  driveStatus,
}: {
  voice: string;
  onVoiceChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  disabled: boolean;
  accentClass: string;
  isPro: boolean;
  language: "hindi" | "english";
  driveStatus?: "idle" | "processing" | "success" | "failed";
}) {
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const toggleSample = () => {
    if (isPlayingSample && sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      setIsPlayingSample(false);
      return;
    }

    const audio = new Audio(`/samples/${language}/${voice.toLowerCase()}.wav`);
    audio.onended = () => setIsPlayingSample(false);
    audio.onerror = () => {
      setIsPlayingSample(false);
      toast.error(`Sample audio not found locally yet for ${voice} (${language}).`, "Missing File");
    };
    audio.play().then(() => setIsPlayingSample(true)).catch(() => setIsPlayingSample(false));
    sampleAudioRef.current = audio;
  }

  useEffect(() => {
    return () => {
      if (sampleAudioRef.current) sampleAudioRef.current.pause();
    }
  }, [voice, language]);

  return (
    <div className="flex flex-col w-full sm:flex-row sm:items-center gap-3 pt-4 border-t border-white/5">
      <div className="w-full sm:w-[220px] shrink-0 h-12 relative">
        <select
          value={voice}
          onChange={e => onVoiceChange(e.target.value)}
          className="w-full h-full bg-white/[0.03] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-4 text-white outline-none text-[11px] font-black uppercase tracking-wider transition-colors appearance-none pr-10 cursor-pointer"
        >
          <optgroup label="♀ Female" className="bg-[#050505]">
            {FEMALE_VOICES.map(v => (
              <option key={v.name} value={v.name}>{v.name} · Female</option>
            ))}
          </optgroup>
          <optgroup label="♂ Male" className="bg-[#050505]">
            {MALE_VOICES.map(v => (
              <option key={v.name} value={v.name}>{v.name} · Male</option>
            ))}
          </optgroup>
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      <button
        onClick={toggleSample}
        disabled={!isPro}
        className={`flex items-center justify-center h-12 gap-1.5 px-6 bg-white/[0.03] hover:bg-white/10 border border-white/[0.08] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${isPlayingSample ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : ""}`}
      >
        {isPlayingSample ? (
          <div className="flex gap-0.5 items-end h-3">
            <div className="w-0.5 h-full bg-current animate-bounce" />
            <div className="w-0.5 h-1/2 bg-current animate-bounce [animation-delay:-0.1s]" />
            <div className="w-0.5 h-full bg-current animate-bounce [animation-delay:-0.2s]" />
          </div>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" /></svg>
        )}
        {isPlayingSample ? "Active" : "Sample"}
      </button>

      <div className="flex-1 hidden sm:block"></div>

      <button
        onClick={onGenerate}
        disabled={loading || disabled}
        className={`w-full sm:w-[180px] h-12 shrink-0 flex items-center justify-center gap-3 px-8 bg-white text-black disabled:bg-white/5 disabled:text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all shadow-xl active:scale-95 disabled:cursor-not-allowed hover:bg-indigo-500 hover:text-white group relative`}
      >
        {loading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col items-center gap-1">
             {driveStatus && driveStatus !== 'idle' && (
               <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border backdrop-blur-md transition-all duration-500 flex items-center gap-1 ${
                 driveStatus === 'processing' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' :
                 driveStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                 'bg-rose-500/20 text-rose-400 border-rose-500/30'
               }`}>
                 <div className={`w-1 h-1 rounded-full ${driveStatus === 'processing' ? 'bg-indigo-400 animate-pulse' : driveStatus === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                 {driveStatus === 'processing' ? 'Syncing...' : driveStatus === 'success' ? 'Backed Up' : 'Sync Fail'}
               </div>
             )}
             <div className="flex items-center gap-2">
                <svg className="w-4 h-4 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                Generate
             </div>
          </div>
        )}
      </button>
    </div>
  );
}

function VoiceSelector({ voice, onChange }: { voice: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={voice}
        onChange={e => onChange(e.target.value)}
        className="w-full h-12 bg-white/[0.03] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-4 text-white outline-none text-[11px] font-black uppercase tracking-wider transition-colors appearance-none pr-10 cursor-pointer"
      >
        <optgroup label="♀ Female" className="bg-[#050505]">
          {FEMALE_VOICES.map(v => (
            <option key={v.name} value={v.name}>{v.name} · Female</option>
          ))}
        </optgroup>
        <optgroup label="♂ Male" className="bg-[#050505]">
          {MALE_VOICES.map(v => (
            <option key={v.name} value={v.name}>{v.name} · Male</option>
          ))}
        </optgroup>
      </select>
      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  );
}

function LanguageToggle({ language, onChange }: { language: "hindi" | "english"; onChange: (l: "hindi" | "english") => void }) {
  return (
    <div className="flex rounded-xl bg-white/[0.02] border border-white/[0.05] p-1 gap-1 shrink-0">
      <button
        onClick={() => onChange("hindi")}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === "hindi"
          ? "bg-indigo-600 text-white shadow-lg"
          : "text-slate-500 hover:text-white"
          }`}
      >
        हिन्दी
      </button>
      <button
        onClick={() => onChange("english")}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === "english"
          ? "bg-indigo-600 text-white shadow-lg"
          : "text-slate-500 hover:text-white"
          }`}
      >
        English
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex gap-1">
      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex gap-3 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[11px] font-bold uppercase tracking-widest items-center">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
      {message}
    </div>
  );
}

function ProGateOverlay({ onUpgrade, feature }: { onUpgrade: () => void; feature: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-8 text-center bg-black/40 backdrop-blur-md rounded-3xl border border-white/10">
      <div className="max-w-md space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-2xl">
           <svg className="w-8 h-8 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V12a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z" /></svg>
        </div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{feature} Mode</h3>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-relaxed">
          Unlock high-end audio engineering tools and multi-speaker broadcasts with a Pro License.
        </p>
        <button
          onClick={onUpgrade}
          className="px-10 py-4 bg-white text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-95"
        >
          Upgrade Studio
        </button>
      </div>
    </div>
  );
}
