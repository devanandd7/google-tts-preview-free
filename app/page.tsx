"use client";

import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { 
  Mic2, 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  ShieldCheck, 
  Zap, 
  MessageSquare,
  ArrowRight,
  ChevronRight,
  Headphones,
  FileText,
  Radio,
  Image,
  Key,
  CheckCircle2,
  CheckCircle,
  XCircle,
  HardDrive,
  Cloud,
  Layers,
  Activity,
  User,
  Users,
  Music,
  Video,
  Globe,
  Settings,
  Star,
  Check,
  Sliders
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { PRO_PRICE_INR, PRO_PRICE_OLD_INR } from "@/lib/constants";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const SUPABASE_BASE_URL = "https://jvdbazjbqmrkytnacjsa.supabase.co/storage/v1/object/public/GenBox%201";

// Initial placeholder while fetching
const INITIAL_VOICE_SAMPLES = [
  { id: "v1", name: "Priyanka", role: "Production Grade", emotion: "Calm", accent: "Hindi-Neutral", file: "/samples/hindi/priyanka.wav", color: "from-indigo-500 to-indigo-600" },
  { id: "v2", name: "Dev", role: "Cinematic Narrator", emotion: "Deep", accent: "Hindi-Formal", file: "/samples/hindi/dev.wav", color: "from-violet-500 to-violet-600" },
  { id: "v3", name: "Sunidhi", role: "Energetic Anchor", emotion: "Happy", accent: "Hindi-Lively", file: "/samples/hindi/sunidhi.wav", color: "from-pink-500 to-pink-600" },
  { id: "v4", name: "Sameer", role: "Documentary Voice", emotion: "Serious", accent: "Hindi-Mature", file: "/samples/hindi/sameer.wav", color: "from-blue-500 to-blue-600" },
];

// Demo Videos from YouTube
const DEMO_VIDEOS = [
  { id: "t30nMCjSuDQ", title: "GenBox AI Feature Overview" },
  { id: "Pwi8gsXqU2o", title: "Emotional Voice Synthesis Demo" }
];

export default function LandingPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceSamples, setVoiceSamples] = useState(INITIAL_VOICE_SAMPLES);
  const [videoSamples, setVideoSamples] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("monthly");
  const [promptText, setPromptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [activeDemoIdx, setActiveDemoIdx] = useState(0);
  
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  useEffect(() => {
    setIsMounted(true);
    async function fetchSamples() {
      if (!supabase) return;
      try {
        const [{ data: hindiFiles }, { data: englishFiles }, { data: broadcastFiles }] = await Promise.all([
          supabase.storage.from("GenBox 1").list("hindi", { limit: 10 }),
          supabase.storage.from("GenBox 1").list("english", { limit: 10 }),
          supabase.storage.from("GenBox 1").list("broadcasts", { limit: 4 }).catch(() => ({ data: null }))
        ]);

        const allFiles = [
          ...(hindiFiles || []).map(f => ({ ...f, folder: 'hindi' })),
          ...(englishFiles || []).map(f => ({ ...f, folder: 'english' }))
        ].filter(f => f.name.toLowerCase().endsWith('.wav'));

        if (allFiles.length > 0) {
          const processedNames = new Set();
          const dynamicSamples = allFiles
            .map((f, idx) => {
              const parts = f.name.replace('.wav', '').split('-');
              let name = parts[2] || f.name.replace('.wav', '');
              if (name === "Ananya") name = "Priyanka";
              return { id: f.id, name: name, folder: f.folder, fileName: f.name };
            })
            .filter(item => {
              if (processedNames.has(item.name)) return false;
              processedNames.add(item.name);
              return true;
            })
            .slice(0, 8)
            .map((item, idx) => ({
              id: item.id,
              name: item.name,
              role: idx % 2 === 0 ? "Production Grade" : "Cinematic Narrator",
              emotion: ["Calm", "Deep", "Energetic", "Serious", "Warm", "Narrative"][idx % 6],
              accent: item.folder === "hindi" ? "Hindi-Neutral" : "English-US",
              file: `${SUPABASE_BASE_URL}/${item.folder}/${item.fileName}`,
              color: idx % 2 === 0 ? "from-indigo-500 to-indigo-600" : "from-violet-500 to-violet-600"
            }));
          setVoiceSamples(dynamicSamples as any);
        }

        if (broadcastFiles && (broadcastFiles as any).length > 0) {
          const vids = (broadcastFiles as any)
            .filter((f: any) => f.name.toLowerCase().endsWith('.mp4') || f.name.toLowerCase().endsWith('.wav'))
            .map((f: any, idx: number) => ({
              id: f.id,
              title: f.name.split('-')[2] || `Broadcast ${idx + 1}`,
              description: "Production Master Output",
              file: `${SUPABASE_BASE_URL}/broadcasts/${f.name}`,
              type: f.name.endsWith('.mp4') ? "video" : "audio"
            }));
          setVideoSamples(vids);
        }
      } catch (err) {
        console.error("Home fetch error:", err);
      }
    }
    fetchSamples();
  }, []);

  const togglePlay = (id: string) => {
    const audio = audioRefs.current[id];
    if (!audio) return;
    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId]?.pause();
      }
      audio.play();
      setPlayingId(id);
    }
  };

  const handleFakeGenerate = () => {
    if (!promptText) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      // Maybe trigger a toast or something
    }, 3000);
  };

  const discountPercent = Math.round(((PRO_PRICE_OLD_INR - PRO_PRICE_INR) / PRO_PRICE_OLD_INR) * 100);

  return (
    <div className="min-h-screen selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Background Layer */}
      <div className="fixed inset-0 z-[-1] bg-[#02040a]">
        <div className="absolute inset-0 bg-noise opacity-[0.03]" />
        <div className="absolute inset-0 bg-mesh opacity-40" />
      </div>

      {/* Global Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 z-[1000] origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-white text-2xl tracking-tighter uppercase italic">GenBox</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-10">
            {["Studio", "Pricing", "Features", "Blog"].map((item) => (
              <Link 
                key={item} 
                href={item === "Studio" ? "/studio" : item === "Blog" ? "/blog" : `#${item.toLowerCase()}`}
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-[0.2em]"
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/studio"
              className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-black uppercase tracking-wider hover:bg-indigo-500 hover:text-white transition-all shadow-lg hover:shadow-indigo-500/20"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 md:pt-48 pb-32 px-6 overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto text-center relative">
          {/* Floating Badges */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1 }}
            className="absolute top-0 left-0 animate-float hidden xl:block"
          >
            <div className="glass-panel px-5 py-3 rounded-2xl flex items-center gap-3 border-white/10">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">100+ Emotional Voices</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.2 }}
            className="absolute top-0 right-0 animate-float delay-1000 hidden xl:block"
          >
            <div className="glass-panel px-5 py-3 rounded-2xl flex items-center gap-3 border-white/10">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">Prompt-to-Broadcast</span>
            </div>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-10"
          >
            <Radio className="w-3 h-3 animate-pulse" />
            The Future of AI Broadcasting
          </motion.div>

          <motion.h1
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white leading-[0.85] mb-10 uppercase italic"
          >
            DIRECT <span className="text-gradient">CINEMATIC</span><br />
            AI VOICES
          </motion.h1>

          <motion.p
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="max-w-3xl mx-auto text-xl md:text-2xl text-slate-400 leading-relaxed mb-14 font-medium"
          >
            The world's first emotional broadcast engine. 100+ voices, dual-host workflows, and prompt-to-script generation for creators, storytellers, and newsrooms.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24"
          >
            <Link
              href="/studio"
              className="w-full sm:w-auto group relative px-12 py-6 bg-indigo-600 text-white font-black text-xl rounded-2xl transition-all hover:bg-indigo-500 overflow-hidden text-center shadow-2xl shadow-indigo-500/40"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative z-10 flex items-center justify-center gap-3">
                START FREE
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </span>
            </Link>
            <button
              onClick={() => setIsDemoOpen(true)}
              className="w-full sm:w-auto px-12 py-6 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white font-black text-xl rounded-2xl transition-all text-center backdrop-blur-xl group shadow-xl"
            >
              <span className="flex items-center justify-center gap-3">
                WATCH DEMO
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
              </span>
            </button>
          </motion.div>

          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-20 animate-pulse">
            Trusted by 10,000+ creators, storytellers and learners.
          </div>

          {/* Interactive Prompt Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="max-w-5xl mx-auto relative group"
          >
            <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 rounded-[3rem] blur-2xl opacity-10 group-hover:opacity-25 transition-opacity duration-1000" />
            <div className="relative glass-panel-strong rounded-[2.5rem] overflow-hidden p-1.5 border-white/10">
              <div className="bg-[#02040a] rounded-[2.2rem] p-8 md:p-14">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500/30 border border-rose-500/50" />
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500/30 border border-amber-500/50" />
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/30 border border-emerald-500/50" />
                  </div>
                  <div className="px-6 py-2 bg-white/5 rounded-full border border-white/10">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Broadcast Studio Pro v2.4</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Settings className="w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div className="text-left space-y-10">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em]">AI Forge Prompt</label>
                      <span className="text-[9px] font-bold text-slate-600 uppercase">Tokens: 42/2000</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Generate a dramatic two-host news broadcast about Mars mission..."
                        className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-8 py-6 text-xl text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                      />
                      <button 
                        onClick={handleFakeGenerate}
                        className="absolute right-3 top-3 bottom-3 px-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm transition-all flex items-center gap-3 shadow-lg shadow-indigo-600/20 active:scale-95"
                      >
                        {isGenerating ? (
                          <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-5 h-5" />
                        )}
                        {isGenerating ? "FORGING..." : "GENERATE"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 rounded-2xl flex items-center gap-5 border-white/10 group/item">
                      <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover/item:bg-indigo-500/20 transition-colors">
                        <Activity className="w-7 h-7 text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Audio Output</p>
                        <div className="flex items-center gap-1 h-6 mt-2">
                          {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(i => (
                            <motion.div 
                              key={i} 
                              className="w-1 bg-indigo-500/40 rounded-full h-full"
                              animate={{ height: ["30%", "100%", "30%"] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.08 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl flex items-center justify-between border-white/10 group/item">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover/item:bg-violet-500/20 transition-colors">
                          <Users className="w-7 h-7 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Hosts</p>
                          <p className="text-sm font-black text-white mt-1">Dev + Priyanka</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl flex items-center justify-between border-white/10 group/item">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-xl bg-pink-500/10 flex items-center justify-center group-hover/item:bg-pink-500/20 transition-colors">
                          <Layers className="w-7 h-7 text-pink-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Emotion Map</p>
                          <p className="text-sm font-black text-white mt-1 italic">Dramatic / News</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <section className="py-20 border-y border-white/5 bg-white/[0.01] backdrop-blur-md relative">
        <div className="absolute inset-0 bg-noise opacity-10" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <div className="flex items-center gap-6">
              <div className="flex -space-x-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-12 h-12 rounded-full border-3 border-[#02040a] bg-slate-800 flex items-center justify-center overflow-hidden ring-1 ring-white/10">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 20}`} alt="User" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-lg font-black text-white tracking-tighter italic uppercase">10,000+ CREATORS</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-indigo-500 text-indigo-500" />)}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Global Trust</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-14 gap-y-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
              {["FORBES", "TECHCRUNCH", "WIRED", "THE VERGE", "NPR"].map(logo => (
                <span key={logo} className="text-2xl font-black italic text-white tracking-tighter">{logo}</span>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-6 px-8 py-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-center border-r border-white/10 pr-6">
                <p className="text-xl font-black text-white tracking-tighter">45M+</p>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Words Forged</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-indigo-400 tracking-tighter">1.2M+</p>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Broadcasts Gen</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* VOCAL GRID */}
      <section id="features" className="py-32 md:py-48 px-6 relative">
        <div className="absolute top-1/2 left-0 w-full h-1/2 bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-24 gap-10">
            <div className="max-w-3xl">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-6"
              >
                The Actor Library
              </motion.div>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic mb-8 leading-none">
                THE <span className="text-gradient">VOCAL</span> GRID
              </h2>
              <p className="text-xl text-slate-400 leading-relaxed">
                Each voice is a unique actor with specific emotional ranges and character archetypes. Addictive to hear, powerful to use in any production.
              </p>
            </div>
            <Link href="/studio" className="group flex items-center gap-4 px-8 py-4 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all bg-white/5">
              <span className="text-xs font-black uppercase tracking-[0.2em]">Explore 100+ Voices</span>
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {voiceSamples.map((sample, idx) => (
              <motion.div
                key={sample.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative"
              >
                <div className="relative glass-panel-strong rounded-[2.5rem] p-10 h-full flex flex-col overflow-hidden border-white/5 hover:border-indigo-500/30 transition-all duration-500">
                  {/* Hover Glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${sample.color} opacity-0 group-hover:opacity-[0.07] transition-opacity duration-700`} />
                  
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="relative mb-8">
                      <div className={`absolute -inset-4 bg-gradient-to-br ${sample.color} rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-700`} />
                      <div className={`w-32 h-32 rounded-full border-4 border-white/10 overflow-hidden bg-slate-900 flex items-center justify-center relative z-10 ring-4 ring-slate-950/50 shadow-2xl`}>
                        <img src={`https://api.dicebear.com/7.x/micah/svg?seed=${sample.name}&backgroundColor=0f172a`} alt={sample.name} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-700" />
                      </div>
                      <motion.div 
                        animate={{ scale: playingId === sample.id ? [1, 1.2, 1] : 1 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-indigo-600 border-4 border-[#02040a] flex items-center justify-center shadow-xl shadow-indigo-600/40 z-20"
                      >
                        <Volume2 className="w-5 h-5 text-white" />
                      </motion.div>
                    </div>

                    <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tight italic">{sample.name}</h3>
                    <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-6">{sample.role}</p>
                    
                    <div className="flex flex-wrap justify-center gap-2 mb-10">
                      <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-slate-300 uppercase tracking-widest">{sample.emotion}</span>
                      <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-slate-300 uppercase tracking-widest">{sample.accent}</span>
                    </div>

                    <div className="w-full flex flex-col items-center gap-6">
                      <button 
                        onClick={() => togglePlay(sample.id)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${playingId === sample.id ? 'bg-rose-600 text-white shadow-rose-600/20' : 'bg-white text-black hover:scale-110 shadow-white/10'}`}
                      >
                        {playingId === sample.id ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                      </button>
                      
                      {/* Mini Waveform */}
                      <div className="w-full h-12 flex items-center justify-center gap-1.5 px-4 bg-white/[0.02] rounded-2xl border border-white/5">
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(i => (
                          <motion.div 
                            key={i} 
                            className={`w-1 rounded-full ${playingId === sample.id ? 'bg-indigo-500' : 'bg-slate-800'}`}
                            animate={{ 
                              height: playingId === sample.id ? [10, 32, 10] : 10,
                              opacity: playingId === sample.id ? 1 : 0.3
                            }}
                            transition={{ duration: 0.4 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.04 }}
                          />
                        ))}
                      </div>
                    </div>

                    {sample.file && (
                      <audio 
                        ref={(el) => { audioRefs.current[sample.id] = el; }}
                        onEnded={() => setPlayingId(null)}
                        src={sample.file}
                        className="hidden"
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BENTO FEATURE SHOWCASE */}
      <section className="py-32 md:py-48 px-6 bg-white/[0.01] border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-mesh opacity-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-28">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-6"
            >
              The Forge Ecosystem
            </motion.div>
            <h2 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase italic mb-8 leading-none">
              THE <span className="text-gradient-blue">PRODUCTION</span> SUITE
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              A comprehensive ecosystem of AI-powered tools designed to help you script, voice, and broadcast cinematic audio experiences at scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 auto-rows-[300px]">
            {/* Feature 1: Large */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-8 glass-panel-strong rounded-[3rem] p-12 flex flex-col justify-between group relative overflow-hidden border-white/10"
            >
              <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-600/20 via-indigo-600/5 to-transparent pointer-events-none" />
              <div className="relative z-10 max-w-lg">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center mb-8 border border-indigo-500/30 group-hover:bg-indigo-600 transition-colors">
                  <Mic2 className="w-8 h-8 text-indigo-400 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-4xl font-black text-white mb-6 uppercase italic tracking-tight">Direct TTS Studio</h3>
                <p className="text-slate-400 text-xl leading-relaxed">
                  Full granular control over pitch, speed, and emotional inflection. Direct your AI actors like a true Hollywood producer with our state-of-the-art interface.
                </p>
              </div>
              <div className="relative z-10 flex gap-4 mt-10">
                <span className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Emotional Tagging</span>
                <span className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">SSML Engine v3</span>
              </div>
            </motion.div>

            {/* Feature 2: Small */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-4 glass-panel-strong rounded-[3rem] p-12 flex flex-col justify-between bg-gradient-to-br from-violet-600/20 to-slate-950/40 border-white/10 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center border border-violet-500/30 group-hover:bg-violet-600 transition-colors">
                <Sparkles className="w-8 h-8 text-violet-400 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-3 uppercase italic">AI Script Builder</h3>
                <p className="text-slate-400 leading-relaxed font-medium">Prompt-to-script engine optimized for high-retention conversational audio and podcasts.</p>
              </div>
            </motion.div>

            {/* Feature 3: Small */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-4 glass-panel-strong rounded-[3rem] p-12 flex flex-col justify-between border-white/10 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-pink-600/20 flex items-center justify-center border border-pink-500/30 group-hover:bg-pink-600 transition-colors">
                <Radio className="w-8 h-8 text-pink-400 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-3 uppercase italic">Broadcast Forge</h3>
                <p className="text-slate-400 leading-relaxed font-medium">Create multi-speaker broadcasts with natural back-and-forth and automatic audio leveling.</p>
              </div>
            </motion.div>

            {/* Feature 4: Medium */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-4 glass-panel-strong rounded-[3rem] p-12 flex flex-col justify-between border-indigo-500/20 bg-indigo-600/5 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 group-hover:bg-indigo-600 transition-colors">
                <Cloud className="w-8 h-8 text-indigo-400 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-3 uppercase italic">Voice Drive</h3>
                <p className="text-slate-400 leading-relaxed font-medium">Sync all your generations instantly to your secure cloud vault. Accessible from any device, anywhere.</p>
              </div>
            </motion.div>

            {/* Feature 5: Small */}
            <motion.div 
              whileHover={{ y: -8 }}
              className="md:col-span-4 glass-panel-strong rounded-[3rem] p-12 flex flex-col justify-between bg-gradient-to-tr from-emerald-600/10 to-transparent border-white/10 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30 group-hover:bg-emerald-600 transition-colors">
                <Image className="w-8 h-8 text-emerald-400 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-3 uppercase italic">Visual Forge</h3>
                <p className="text-slate-400 leading-relaxed font-medium">Generate high-res cover art and social media thumbnails for your audio broadcasts instantly.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* USE CASES SECTION */}
      <section className="py-32 md:py-48 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-1/3 h-full bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-28">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-6"
            >
              Tailored Solutions
            </motion.div>
            <h2 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase italic mb-8 leading-none">
              WHO IS <span className="text-indigo-500">GENBOX</span> FOR?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {[
              { persona: "Students", icon: User, text: "Generate cinematic lesson narrations and study guides that keep you engaged and focused.", color: "indigo" },
              { persona: "Creators", icon: Sparkles, text: "Natural voiceovers for reels, shorts, and long-form video that sound human, not robotic.", color: "pink" },
              { persona: "Storytellers", icon: FileText, text: "Turn scripts into immersive cinematic audio experiences with character-driven emotional depth.", color: "violet" },
              { persona: "Newsrooms", icon: Globe, text: "Generate broadcast-quality news audio and daily briefings with an authoritative news anchor tone.", color: "blue" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className="glass-panel-strong p-12 rounded-[3rem] text-center group border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col h-full"
              >
                <div className={`w-20 h-20 rounded-[2rem] mx-auto mb-10 flex items-center justify-center bg-${item.color}-500/10 text-${item.color}-400 group-hover:bg-${item.color}-500 group-hover:text-white transition-all duration-500 shadow-xl group-hover:shadow-${item.color}-500/20`}>
                  <item.icon className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-black text-white mb-6 uppercase italic tracking-tight">For {item.persona}</h3>
                <p className="text-slate-400 leading-relaxed text-lg font-medium mb-8 flex-1">{item.text}</p>
                <Link href="/studio" className={`text-[10px] font-black uppercase tracking-[0.3em] text-${item.color}-400 group-hover:text-white transition-colors`}>Learn More →</Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* EMOTIONAL VOICE ENGINE */}
      <section className="py-32 md:py-60 px-6 relative overflow-hidden bg-white/[0.01]">
        <div className="absolute inset-0 bg-indigo-600/5 blur-[150px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-24">
          <div className="lg:w-1/2">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-8"
            >
              The Core Technology
            </motion.div>
            <h2 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.85] mb-10 uppercase italic">
              100+ <span className="text-indigo-500">EMOTIONAL</span><br />VOICE ENGINE
            </h2>
            <p className="text-2xl text-slate-400 mb-14 leading-relaxed font-medium">
              Don't just synthesize text. Direct raw emotions. Our engine understands nuance, sarcasm, excitement, and narrative gravity with surgical precision.
            </p>
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              {["Dramatic Intensity", "Warm Narrator", "News Anchor", "Suspenseful Whisper", "Documentary Tone", "Cinematic Edge"].map(emotion => (
                <div key={emotion} className="flex items-center gap-4 group">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:scale-125 transition-transform" />
                  <span className="text-sm font-black text-white uppercase tracking-widest">{emotion}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-1/2 relative">
            <div className="absolute inset-0 bg-indigo-500 blur-[120px] opacity-20 animate-pulse pointer-events-none" />
            <div className="grid grid-cols-3 gap-6 relative">
              {[1,2,3,4,5,6,7,8,9].map(i => (
                <motion.div 
                  key={i}
                  animate={{ 
                    scale: [1, 1.05, 1],
                    opacity: [0.3, 0.7, 0.3],
                    borderColor: ["rgba(255,255,255,0.05)", "rgba(99,102,241,0.3)", "rgba(255,255,255,0.05)"]
                  }}
                  transition={{ duration: 3 + i * 0.5, repeat: Infinity }}
                  className="aspect-square glass-panel-strong rounded-3xl flex flex-col items-center justify-center p-8 border-white/5 shadow-2xl"
                >
                  <Activity className="w-10 h-10 text-indigo-400 mb-6" />
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500" 
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-32 md:py-48 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-32">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-6"
            >
              The Studio Workflow
            </motion.div>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">THREE STEPS TO <span className="text-gradient">BROADCAST</span></h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-20 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent z-0" />
            
            {[
              { step: "01", title: "PROMPT", desc: "Describe your broadcast or paste your script into our AI Forge.", icon: MessageSquare, color: "from-indigo-500 to-indigo-600" },
              { step: "02", title: "FORGE", desc: "Choose your voices and generate with narrative emotional depth.", icon: Zap, color: "from-violet-500 to-violet-600" },
              { step: "03", title: "AIR", desc: "Export high-fidelity audio or sync directly to your Cloud Drive.", icon: Radio, color: "from-pink-500 to-pink-600" }
            ].map((s, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                className="relative z-10 flex flex-col items-center text-center group"
              >
                <div className={`w-24 h-24 rounded-full bg-slate-950 border-4 border-white/5 flex items-center justify-center mb-10 relative group-hover:border-indigo-500/50 transition-all duration-500`}>
                  <div className={`absolute -inset-2 bg-gradient-to-br ${s.color} rounded-full blur-xl opacity-0 group-hover:opacity-40 transition-opacity`} />
                  <s.icon className="w-10 h-10 text-white relative z-10" />
                  <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white shadow-xl">
                    {s.step}
                  </div>
                </div>
                <h3 className="text-3xl font-black text-white mb-6 uppercase italic tracking-tight">{s.title}</h3>
                <p className="text-slate-500 text-lg leading-relaxed font-medium px-4">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-32 md:py-48 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-full bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-28">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-6"
            >
              The Forge Membership
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-6xl md:text-9xl font-black text-white tracking-tighter uppercase italic leading-[0.8] mb-12"
            >
              FORGE <span className="text-gradient">ACCESS</span> PLANS
            </motion.h2>
            
            {/* Toggle */}
            <div className="inline-flex p-2 rounded-2xl bg-white/5 border border-white/10 mb-10 backdrop-blur-xl">
              <button 
                onClick={() => setActiveTab("monthly")}
                className={`px-10 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "monthly" ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setActiveTab("yearly")}
                className={`px-10 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "yearly" ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
              >
                Yearly <span className="ml-2 text-[9px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Save 20%</span>
              </button>
            </div>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em]">ROI Focused Pricing for Serious Creators.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* FREE PLAN */}
            <motion.div 
              whileHover={{ y: -12 }}
              className="relative p-14 rounded-[4rem] bg-slate-950/40 border border-white/5 group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[80px] rounded-full" />
              <div className="flex justify-between items-start mb-14 relative z-10">
                <div>
                  <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Hobbyist</h3>
                  <p className="text-slate-500 font-bold text-[11px] uppercase tracking-[0.3em] mt-2">Free Starter</p>
                </div>
                <div className="text-right">
                  <span className="text-5xl font-black text-white italic">₹0</span>
                  <p className="text-slate-600 text-[11px] font-bold uppercase tracking-widest mt-2">Forever</p>
                </div>
              </div>

              <div className="space-y-8 mb-16 relative z-10">
                {[
                  "3 Daily Productions",
                  "2 Minute Production Window",
                  "Standard Voice Library",
                  "Basic AI Scripting",
                  "Personal Use Only"
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-6">
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <Check className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span className="text-lg text-slate-300 font-black uppercase tracking-tight italic">{f}</span>
                  </div>
                ))}
              </div>

              <Link href="/studio" className="flex items-center justify-center w-full py-6 bg-white/5 text-white font-black uppercase italic tracking-[0.2em] rounded-[1.5rem] border border-white/10 hover:bg-white/10 transition-all text-lg shadow-xl relative z-10">
                Start Creating Free
              </Link>
            </motion.div>

            {/* PRO PLAN */}
            <motion.div 
              whileHover={{ y: -12 }}
              className="relative p-14 rounded-[4rem] bg-indigo-600 overflow-hidden shadow-2xl shadow-indigo-600/40 border-2 border-white/20 group"
            >
              {/* Dynamic Glow Background */}
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-white/10 blur-[100px] rounded-full animate-pulse" />
              <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-400/20 blur-[80px] rounded-full" />
              
              <div className="absolute top-10 right-14">
                <div className="relative">
                  <div className="absolute inset-0 bg-white blur-md opacity-30" />
                  <span className="relative px-6 py-2 bg-white text-indigo-600 text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-2xl">Recommended</span>
                </div>
              </div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-14">
                  <div>
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Pro Studio</h3>
                    <p className="text-indigo-100 font-bold text-[11px] uppercase tracking-[0.3em] mt-2">Production Tier</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-3 justify-end mb-2">
                      <span className="text-indigo-300 line-through text-lg font-black opacity-60 italic">₹{PRO_PRICE_OLD_INR}</span>
                      <span className="px-3 py-1 bg-rose-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg">{discountPercent}% OFF</span>
                    </div>
                    <span className="text-6xl font-black text-white italic">₹{PRO_PRICE_INR}</span>
                    <p className="text-indigo-200 text-[11px] font-bold uppercase tracking-widest mt-2">Billed {activeTab}</p>
                  </div>
                </div>

                <div className="space-y-8 mb-16">
                  {[
                    "Unlimited Express Forge",
                    "10 Minute Production Limit",
                    "Pro Emotional Engine v2",
                    "Cloud Drive Automation",
                    "Full Commercial Rights",
                    "Priority Forge Rendering"
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-6">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-lg text-white font-black uppercase tracking-tight italic">{f}</span>
                    </div>
                  ))}
                </div>

                <Link href="/studio" className="flex items-center justify-center w-full py-7 bg-white text-indigo-600 font-black uppercase italic tracking-[0.2em] rounded-[1.5rem] hover:bg-slate-100 transition-all shadow-2xl text-xl">
                  Unlock Studio Access
                </Link>
                <div className="mt-8 flex items-center justify-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-indigo-200" />
                  <p className="text-[10px] text-indigo-200 font-black uppercase tracking-[0.2em]">7-Day Money Back Guarantee</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      {/* WHY DIFFERENT */}
      <section className="py-32 md:py-60 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent" />
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
            <div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.6em] mb-8"
              >
                The Competitive Edge
              </motion.div>
              <h2 className="text-6xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-[0.85] mb-12">
                NOT JUST <span className="text-indigo-500">VOICES</span>.<br />IDENTITY.
              </h2>
              <div className="space-y-16">
                {[
                  { title: "Breath & Nuance", text: "Generic TTS feels flat. GenBox captures the subtle breath, the calculated pause, and the emotional weight of real human speech.", icon: Activity },
                  { title: "Broadcast Native", text: "Built specifically for podcasters and broadcasters, our engine optimizes for speaker resonance and narrative gravity.", icon: Radio },
                  { title: "Surgical Control", text: "Fine-tune pitch, speed, and emotional intensity at the word level for truly professional directing.", icon: Sliders }
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-10 group"
                  >
                    <div className="shrink-0 w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500 shadow-xl">
                      <item.icon className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tight">{item.title}</h3>
                      <p className="text-slate-400 leading-relaxed text-lg font-medium">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="glass-panel-strong p-16 rounded-[4rem] relative border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)]"
            >
              <div className="absolute -top-6 -right-6 px-10 py-5 bg-indigo-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-2xl z-20">
                PRO PERFORMANCE
              </div>
              
              <div className="relative z-10">
                <h3 className="text-2xl font-black text-white uppercase mb-12 italic tracking-tighter">GenBox vs. Generic TTS</h3>
                <div className="space-y-10">
                  {[
                    { label: "Emotional Fidelity", genbox: 100, other: 15 },
                    { label: "Speaker Resonance", genbox: 98, other: 22 },
                    { label: "Narrative Gravity", genbox: 95, other: 10 },
                    { label: "Direction Precision", genbox: 100, other: 5 }
                  ].map((row, i) => (
                    <div key={i} className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{row.label}</span>
                        <div className="flex gap-4 items-baseline">
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Other: {row.other}%</span>
                          <span className="text-sm font-black text-indigo-400 uppercase italic">GenBox: {row.genbox}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.genbox}%` }}
                          transition={{ duration: 1.5, delay: i * 0.1 }}
                          className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full relative z-10" 
                        />
                        <div className="absolute top-0 left-0 h-full bg-slate-800 rounded-full" style={{ width: `${row.other}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-16 pt-10 border-t border-white/5 flex items-center justify-between">
                  <div className="flex -space-x-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800" />
                    ))}
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Trusted by 10k+ Producers</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-48 md:py-80 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-600/10 blur-[150px] animate-pulse pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="relative p-20 md:p-40 rounded-[5rem] md:rounded-[8rem] bg-indigo-600 overflow-hidden shadow-[0_0_150px_rgba(79,70,229,0.5)] border-4 border-white/20"
          >
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            
            <div className="relative z-10 text-center max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-4 px-8 py-3 rounded-full bg-white text-indigo-600 text-[11px] font-black uppercase tracking-[0.5em] mb-12 shadow-2xl"
              >
                <Zap className="w-4 h-4 fill-current" />
                Forge Your Future
              </motion.div>
              <h2 className="text-5xl md:text-[10rem] font-black text-white tracking-tighter mb-16 leading-[0.8] uppercase italic">
                READY TO PRODUCE <span className="text-indigo-200">LIKE A STUDIO?</span>
              </h2>
              <div className="flex flex-col items-center gap-12">
                <Link href="/studio" className="group w-full md:w-auto inline-flex items-center justify-center gap-6 px-16 py-8 bg-white text-indigo-600 font-black text-3xl rounded-[2.5rem] hover:bg-slate-100 transition-all shadow-[0_20px_80px_rgba(255,255,255,0.4)] hover:-translate-y-2 active:scale-95">
                  LAUNCH YOUR STUDIO
                  <ArrowRight className="w-10 h-10 group-hover:translate-x-2 transition-transform" />
                </Link>
                <div className="flex flex-col md:flex-row items-center gap-10">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-200" />
                    <span className="text-sm font-black text-white uppercase tracking-widest opacity-80">Free Forever Tier</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-200" />
                    <span className="text-sm font-black text-white uppercase tracking-widest opacity-80">No CC Required</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-200" />
                    <span className="text-sm font-black text-white uppercase tracking-widest opacity-80">Instant Access</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-32 px-6 border-t border-white/5 relative z-10 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-20 mb-32">
            <div className="md:col-span-5">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20">
                  <Mic2 className="w-7 h-7 text-white" />
                </div>
                <span className="font-black text-white text-4xl tracking-tighter uppercase italic">GenBox</span>
              </div>
              <p className="text-slate-400 text-xl leading-relaxed mb-12 font-medium max-w-md">
                Redefining the standard for AI audio broadcasting with raw emotional depth and cinematic fidelity.
              </p>
              <div className="flex gap-6">
                {[1,2,3,4].map(i => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -5 }}
                    className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:border-white/20 transition-all cursor-pointer" 
                  />
                ))}
              </div>
            </div>
            
            <div className="md:col-span-2">
              <h4 className="text-white font-black text-xs uppercase tracking-[0.3em] mb-10">Forge</h4>
              <ul className="space-y-6">
                {["Studio", "Voices", "Emotion Engine", "Pricing"].map(item => (
                  <li key={item}><Link href="#" className="text-slate-500 hover:text-white text-sm font-black uppercase tracking-widest transition-colors">{item}</Link></li>
                ))}
              </ul>
            </div>
            
            <div className="md:col-span-2">
              <h4 className="text-white font-black text-xs uppercase tracking-[0.3em] mb-10">Collective</h4>
              <ul className="space-y-6">
                {["About", "Research", "Creators", "Contact"].map(item => (
                  <li key={item}><Link href="#" className="text-slate-500 hover:text-white text-sm font-black uppercase tracking-widest transition-colors">{item}</Link></li>
                ))}
              </ul>
            </div>
            
            <div className="md:col-span-3">
              <h4 className="text-white font-black text-xs uppercase tracking-[0.3em] mb-10">Legal & Privacy</h4>
              <ul className="space-y-6">
                {["Privacy Policy", "Terms of Service", "License Agreement"].map(item => (
                  <li key={item}><Link href={item === "Privacy Policy" ? "/privacy" : item === "Terms of Service" ? "/terms" : "#"} className="text-slate-500 hover:text-white text-sm font-black uppercase tracking-widest transition-colors">{item}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-10 pt-16 border-t border-white/5">
            <p className="text-slate-600 text-[11px] font-black uppercase tracking-[0.3em]">© 2026 GENBOX AI LABORATORY. DESIGNED FOR THE FUTURE.</p>
            <div className="flex items-center gap-10">
               <span className="flex items-center gap-3 text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em]">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                 Core Forge Operational
               </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Sticky CTA */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 2 }}
        className="fixed bottom-10 right-10 z-[100] hidden md:block"
      >
        <Link href="/studio" className="flex items-center gap-4 pl-8 pr-4 py-4 bg-white text-indigo-600 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:-translate-y-2 transition-all group">
          <span className="font-black text-xs uppercase tracking-[0.2em]">Start Forging</span>
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center group-hover:rotate-45 transition-transform">
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>
      </motion.div>
      {/* DEMO VIDEO MODAL */}
      <AnimatePresence>
        {isDemoOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl"
            onClick={() => setIsDemoOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-6xl aspect-video rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.3)] border border-white/10 bg-black flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between px-10 pointer-events-none">
                <div className="pointer-events-auto">
                  <h3 className="text-white font-black uppercase tracking-widest italic text-lg">{DEMO_VIDEOS[activeDemoIdx].title}</h3>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Video {activeDemoIdx + 1} of {DEMO_VIDEOS.length}</p>
                </div>
                <button 
                  onClick={() => setIsDemoOpen(false)}
                  className="pointer-events-auto w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all backdrop-blur-md"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Video Container */}
              <div className="flex-1 w-full h-full">
                <iframe
                  src={`https://www.youtube.com/embed/${DEMO_VIDEOS[activeDemoIdx].id}?autoplay=1&rel=0&modestbranding=1`}
                  title={DEMO_VIDEOS[activeDemoIdx].title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* Navigation Controls */}
              {DEMO_VIDEOS.length > 1 && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10">
                  <button 
                    onClick={() => setActiveDemoIdx((prev) => (prev === 0 ? DEMO_VIDEOS.length - 1 : prev - 1))}
                    className="w-14 h-14 rounded-2xl bg-black/50 border border-white/10 text-white flex items-center justify-center hover:bg-indigo-600 hover:border-indigo-500 transition-all backdrop-blur-md group"
                  >
                    <ArrowRight className="w-6 h-6 rotate-180 group-hover:-translate-x-1 transition-transform" />
                  </button>
                  <div className="flex gap-2">
                    {DEMO_VIDEOS.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === activeDemoIdx ? 'w-8 bg-indigo-500' : 'w-2 bg-white/20'}`}
                      />
                    ))}
                  </div>
                  <button 
                    onClick={() => setActiveDemoIdx((prev) => (prev === DEMO_VIDEOS.length - 1 ? 0 : prev + 1))}
                    className="w-14 h-14 rounded-2xl bg-black/50 border border-white/10 text-white flex items-center justify-center hover:bg-indigo-600 hover:border-indigo-500 transition-all backdrop-blur-md group"
                  >
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


