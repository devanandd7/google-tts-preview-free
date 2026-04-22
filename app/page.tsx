"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
  XCircle,
  HardDrive,
  Cloud
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
  { id: "v1", name: "Priyanka", role: "Production Grade", file: "/samples/hindi/priyanka.wav", color: "from-indigo-500 to-indigo-600" },
  { id: "v2", name: "Dev", role: "Cinematic Narrator", file: "/samples/hindi/dev.wav", color: "from-violet-500 to-violet-600" },
  { id: "v3", name: "Sunidhi", role: "Energetic Anchor", file: "/samples/hindi/sunidhi.wav", color: "from-pink-500 to-pink-600" },
  { id: "v4", name: "Sameer", role: "Documentary Voice", file: "/samples/hindi/sameer.wav", color: "from-blue-500 to-blue-600" },
];

export default function LandingPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceSamples, setVoiceSamples] = useState(INITIAL_VOICE_SAMPLES);
  const [videoSamples, setVideoSamples] = useState<any[]>([]);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    setIsMounted(true);
    async function fetchSamples() {
      if (!supabase) return;
      try {
        // Fetch Hindi and English files
        const [{ data: hindiFiles }, { data: englishFiles }, { data: broadcastFiles }] = await Promise.all([
          supabase.storage.from("GenBox 1").list("hindi", { limit: 10 }),
          supabase.storage.from("GenBox 1").list("english", { limit: 10 }),
          supabase.storage.from("GenBox 1").list("broadcasts", { limit: 4 }).catch(() => ({ data: null }))
        ]);

        // Process Audio
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
              
              // If it's Ananya, we treat it as Priyanka for the home page
              if (name === "Ananya") name = "Priyanka";
              
              return {
                id: f.id,
                name: name,
                folder: f.folder,
                fileName: f.name
              };
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
              file: `${SUPABASE_BASE_URL}/${item.folder}/${item.fileName}`,
              color: idx % 2 === 0 ? "from-indigo-500 to-indigo-600" : "from-violet-500 to-violet-600"
            }));

          setVoiceSamples(dynamicSamples as any);
        }

        // Process Videos
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

  const discountPercent = Math.round(((PRO_PRICE_OLD_INR - PRO_PRICE_INR) / PRO_PRICE_OLD_INR) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-48 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/2 -right-48 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <Mic2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="font-black text-white text-xl md:text-2xl tracking-tighter uppercase italic">GenBox</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-10">
            {["Home", "Blog", "Studio"].map((item) => (
              <Link 
                key={item} 
                href={item === "Home" ? "/" : `/${item.toLowerCase()}`}
                className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link href="/blog" className="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Blog</Link>
            <Link
              href="/studio"
              className="px-4 md:px-6 py-2 md:py-2.5 rounded-full bg-white text-black text-[10px] md:text-sm font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
            >
              STUDIO
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 md:pt-44 pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-8"
          >
            <Sparkles className="w-3 h-3" />
            Next Gen AI Synthesis
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-8xl lg:text-[10rem] font-black tracking-tighter text-white leading-[0.95] md:leading-[0.85] mb-12"
          >
            DIRECT YOUR<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-500">
              AI ACTOR
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed mb-12"
          >
            Professional production-grade synthesis with granular emotional control and cinematic depth.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6"
          >
            <Link
              href="/studio"
              className="w-full sm:w-auto group relative px-8 md:px-10 py-4 md:py-5 bg-indigo-600 text-white font-black text-lg md:text-xl rounded-2xl transition-all hover:bg-indigo-500 overflow-hidden text-center shadow-xl shadow-indigo-500/20"
            >
              <span className="relative flex items-center justify-center gap-2">
                OPEN STUDIO FREE
                <ArrowRight className="w-6 h-6" />
              </span>
            </Link>
            <Link
              href="/blog"
              className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white font-black text-lg md:text-xl rounded-2xl transition-colors text-center"
            >
              EXPLORE SAMPLES
            </Link>
          </motion.div>
        </div>
      </section>

      {/* SAMPLES SHOWCASE */}
      <section className="relative py-20 md:py-32 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-16 md:mb-20 gap-8 text-center md:text-left">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-6 uppercase italic">
                The <span className="text-indigo-500">Vocal</span> Grid
              </h2>
              <p className="text-lg md:text-xl text-slate-400">
                Listen to the raw, unedited fidelity of our top production voices.
              </p>
            </div>
            <Link href="/blog" className="flex items-center gap-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors uppercase tracking-widest text-xs md:text-sm">
              View All 30+ Voices <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {voiceSamples.map((sample, idx) => (
              <motion.div
                key={sample.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="group relative"
              >
                <div className="relative bg-slate-950 border border-white/5 p-4 md:p-8 rounded-2xl md:rounded-3xl h-full flex flex-col items-center text-center">
                  <div className={`w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-gradient-to-br ${sample.color} flex items-center justify-center mb-4 md:mb-6 shadow-lg`}>
                    <Headphones className="w-6 h-6 md:w-10 md:h-10 text-white" />
                  </div>
                  
                  <h3 className="text-base md:text-2xl font-black text-white mb-0.5 md:mb-1">{sample.name}</h3>
                  <p className="text-slate-500 text-[8px] md:text-sm font-bold uppercase tracking-widest mb-4 md:mb-8">{sample.role}</p>
                  
                  <button 
                    disabled={!sample.file}
                    onClick={() => togglePlay(sample.id)}
                    className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all mb-4 disabled:opacity-30"
                  >
                    {playingId === sample.id ? <Pause className="w-5 h-5 md:w-8 md:h-8 fill-current" /> : <Play className="w-5 h-5 md:w-8 md:h-8 fill-current ml-0.5 md:ml-1" />}
                  </button>
                  
                  <div className="flex items-center gap-0.5 md:gap-1 h-6 md:h-8">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div 
                        key={i} 
                        className={`w-0.5 md:w-1 rounded-full bg-indigo-500/40 transition-all duration-300 ${playingId === sample.id ? 'animate-bounce' : ''}`}
                        style={{ height: `${isMounted ? 30 + Math.random() * 70 : 50}%`, animationDelay: `${i * 0.05}s` }}
                      />
                    ))}
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BROADCAST SHOWCASE */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16 md:mb-20">
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-4xl md:text-7xl font-black text-white tracking-tighter uppercase italic mb-6"
            >
              Broadcast <span className="text-indigo-500">Cinema</span>
            </motion.h2>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
              Cinematic multi-speaker experiences powered by our broadcast engine.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {(videoSamples.length > 0 ? videoSamples : [
              { id: "yt1", title: "Broadcast 1", description: "Multi-Speaker Debate", file: "t30nMCjSuDQ", type: "youtube" },
              { id: "yt2", title: "Broadcast 2", description: "Cinematic Narration", file: "Pwi8gsXqU2o", type: "youtube" }
            ]).slice(0, 2).map((vid, idx) => (
              <motion.div
                key={vid.id}
                initial={{ opacity: 0, x: idx === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className={`relative group ${idx === 1 ? 'lg:mt-24' : ''}`}
              >
                <div className="relative bg-slate-900 rounded-[2rem] overflow-hidden border border-white/10 aspect-video shadow-2xl mb-6 bg-black">
                  {vid.type === "youtube" ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${vid.file}?modestbranding=1&rel=0&iv_load_policy=3`}
                      title={vid.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  ) : vid.type === "video" ? (
                    <video 
                      src={vid.file} 
                      controls 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-900/20">
                      <Volume2 className="w-12 h-12 text-indigo-400 mb-4" />
                      <audio src={vid.file} controls className="w-4/5" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{vid.title}</h3>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">{vid.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FORGE ACCESS PLANS - PRICING */}
      <section className="py-16 md:py-24 px-6 relative bg-slate-900/20">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-none mb-3">
              FORGE ACCESS <span className="text-indigo-500">PLANS</span>
            </h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[8px] md:text-xs">Select your production level</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-10 max-w-5xl mx-auto">
            {/* FREE PLAN */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-slate-900/40 border border-white/5 overflow-hidden group"
            >
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8 md:mb-10">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Free</h3>
                    <p className="text-slate-500 font-bold text-[8px] uppercase tracking-widest mt-1">Hobbyist Level</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl md:text-4xl font-black text-white italic">₹0</span>
                    <p className="text-slate-600 text-[8px] font-bold uppercase tracking-widest">Free Forever</p>
                  </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/5 mt-0.5 shrink-0"><Mic2 className="w-4 h-4 text-slate-400" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Direct Voice Forge</p>
                      <p className="text-slate-400 text-[10px] md:text-xs leading-relaxed">0-3 Daily instant generations. 2 minute production window.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/5 mt-0.5 shrink-0"><FileText className="w-4 h-4 text-slate-400" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">AI Scripting</p>
                      <p className="text-slate-400 text-[10px] md:text-xs leading-relaxed">0-3 Daily script requests with 2 minute audio export.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/5 mt-0.5 shrink-0"><Radio className="w-4 h-4 text-slate-400" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Broadcast Engine</p>
                      <p className="text-slate-400 text-[10px] md:text-xs leading-relaxed">1 Daily dual-speaker session with standard personas.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/5 mt-0.5 shrink-0"><Key className="w-4 h-4 text-slate-400" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Zero Setup</p>
                      <p className="text-slate-400 text-[10px] md:text-xs leading-relaxed">No API Key Needed. Start producing instantly.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-10 md:mt-12 pt-8 border-t border-white/5">
                  <Link href="/studio" className="flex items-center justify-center w-full py-4 bg-white/5 text-white font-black uppercase italic tracking-widest rounded-2xl hover:bg-white/10 transition-all border border-white/10 text-sm">
                    Start Creating
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* PRO PLAN */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-indigo-600 overflow-hidden shadow-[0_0_80px_rgba(79,70,229,0.3)] group border-2 border-white/10"
            >
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Zap className="w-20 h-20 text-white fill-current" />
              </div>

              <div className="absolute top-4 left-6">
                <span className="px-3 py-1 bg-white text-indigo-600 text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg">Best Value</span>
              </div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8 md:mb-10">
                  <div className="mt-4 md:mt-2">
                    <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Pro Forge</h3>
                    <p className="text-indigo-200 font-bold text-[8px] uppercase tracking-widest mt-1">Production Powerhouse</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-indigo-300 line-through text-xs md:text-sm font-bold opacity-50">₹{PRO_PRICE_OLD_INR}</span>
                      <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black uppercase rounded-sm animate-pulse">{discountPercent}% OFF</span>
                    </div>
                    <span className="text-3xl md:text-4xl font-black text-white italic leading-none">₹{PRO_PRICE_INR}</span>
                    <p className="text-indigo-300 text-[8px] font-bold uppercase tracking-widest mt-1">Billed Monthly</p>
                  </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/20 mt-0.5 shrink-0"><ShieldCheck className="w-4 h-4 text-white" /></div>
                    <div className="flex-1 space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Unlimited Access</p>
                      <p className="text-indigo-100 text-[10px] md:text-xs leading-relaxed">0-9 Daily sessions with extended 10-minute duration.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/20 mt-0.5 shrink-0"><Radio className="w-4 h-4 text-white" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Master Broadcasts</p>
                      <p className="text-indigo-100 text-[10px] md:text-xs leading-relaxed">0-5 Daily multi-speaker sessions with AI editing.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/20 mt-0.5 shrink-0"><Image className="w-4 h-4 text-white" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Cinematic Visuals</p>
                      <p className="text-indigo-100 text-[10px] md:text-xs leading-relaxed">0-21 Daily high-res AI image generations.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/20 mt-0.5 shrink-0"><Key className="w-4 h-4 text-white" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Advanced API</p>
                      <p className="text-indigo-100 text-[10px] md:text-xs leading-relaxed">Easy setup for your own synthesis engine keys.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-white/20 mt-0.5 shrink-0"><Cloud className="w-4 h-4 text-white" /></div>
                    <div className="space-y-0.5">
                      <p className="text-white font-black text-sm md:text-base uppercase italic tracking-tight">Automated Cloud Drive</p>
                      <p className="text-indigo-100 text-[10px] md:text-xs leading-relaxed">Auto-sync all generations (Audio, Images, Broadcast) to your vault.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-10 md:mt-12 pt-8 border-t border-white/20">
                  <Link href="/studio" className="flex items-center justify-center w-full py-4 bg-white text-indigo-600 font-black uppercase italic tracking-widest rounded-2xl hover:bg-slate-100 transition-all shadow-xl text-sm">
                    Upgrade to Pro Now
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>

          {/* FORGE COMPARISON MATRIX */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 md:mt-24 max-w-4xl mx-auto"
          >
            <div className="text-center mb-8 md:mb-12">
              <h3 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Feature Forge <span className="text-indigo-500">Matrix</span></h3>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[8px] mt-2 text-center">Detailed Capability Breakdown</p>
            </div>

            <div className="relative bg-slate-900/60 border border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-x-auto shadow-2xl backdrop-blur-md">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="p-4 md:p-6 text-slate-500 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">Feature Set</th>
                    <th className="p-4 md:p-6 text-white font-black uppercase italic tracking-tighter text-lg md:text-xl">Free</th>
                    <th className="p-4 md:p-6 text-indigo-400 font-black uppercase italic tracking-tighter text-lg md:text-xl">Pro</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] md:text-sm">
                  {[
                    { f: "Daily Productions", free: "0-3 Sessions", pro: "0-9 Sessions" },
                    { f: "Max Audio Duration", free: "2 Minutes", pro: "10 Minutes" },
                    { f: "Broadcast Engine", free: "1 Daily", pro: "0-5 Daily" },
                    { f: "Cinematic Image Gen", free: false, pro: "0-21 Daily" },
                    { f: "Custom API Keys", free: false, pro: true },
                    { f: "AI Script Engine", free: "Basic", pro: "Pro Studio" },
                    { f: "GenBox Cloud Drive", free: "Local Only", pro: "Unlimited Cloud" },
                    { f: "Commercial License", free: false, pro: true },
                    { f: "No Watermark", free: true, pro: true },
                    { f: "Priority Support", free: false, pro: true }
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5 group hover:bg-white/5 transition-colors">
                      <td className="p-4 md:p-6 text-white font-bold tracking-tight">{row.f}</td>
                      <td className="p-4 md:p-6">
                        {row.free === true ? (
                          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                        ) : row.free === false ? (
                          <XCircle className="w-4 h-4 md:w-5 md:h-5 text-rose-500/30" />
                        ) : (
                          <span className="text-slate-400 font-black uppercase tracking-widest text-[8px] md:text-[10px] italic">{row.free}</span>
                        )}
                      </td>
                      <td className="p-4 md:p-6">
                        {row.pro === true ? (
                          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                        ) : (
                          <span className="text-indigo-400 font-black uppercase tracking-widest text-[8px] md:text-[10px] italic">{row.pro}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-20 md:py-32 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: Zap, title: "Direct TTS", desc: "Full director control with emotional tags and granular speech parameters." },
              { icon: Sparkles, title: "AI Architect", desc: "Gemini-powered scriptwriting optimized for high-fidelity audio production." },
              { icon: MessageSquare, title: "Broadcast Suite", desc: "Complex multi-speaker dialogues, interviews, and cinematic podcasts." }
            ].map((f, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="space-y-6"
              >
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                  <f.icon className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-3xl font-black text-white tracking-tight uppercase">{f.title}</h3>
                <p className="text-slate-400 text-lg leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BANNER */}
      <section className="py-20 md:py-32 border-t border-white/5 bg-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-12"
          >
            Engine Power
          </motion.h2>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-20">
            {["GEMINI 2.5", "GOOGLE CLOUD", "TTS PRO", "POLLINATIONS"].map((brand, idx) => (
              <motion.span 
                key={brand}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 0.3, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05, ease: "easeOut" }}
                whileHover={{ opacity: 1, scale: 1.05 }}
                className="text-2xl md:text-4xl font-black text-white italic transition-all cursor-default will-change-transform"
              >
                {brand}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* VOICES CLOUD */}
      <section className="py-20 md:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.h2 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-12 uppercase italic"
          >
            30+ <span className="text-indigo-500">Character</span> Profiles
          </motion.h2>
          <motion.div 
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{
              show: {
                transition: {
                  staggerChildren: 0.01
                }
              }
            }}
            className="flex flex-wrap gap-2 md:gap-3 justify-center max-w-4xl mx-auto"
          >
            {["Sunidhi","Dev","Ram","Raushan","Priyanka","Priya","Devanshi","Sneha","Devsheel","Aryan","Kabir","Rohan","Shreya","Kavya","Rahul","Vikram","Neha","Riya","Aditya","Taniya","Aditi","Pooja","Karan","Arjun","Shruti","Sameer","Aman","Meera"].map((v) => (
              <motion.span 
                key={v}
                variants={{
                  hidden: { opacity: 0, scale: 0.8, y: 5 },
                  show: { opacity: 1, scale: 1, y: 0 }
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                whileHover={{ 
                  scale: 1.1, 
                  backgroundColor: "rgba(99, 102, 241, 0.2)",
                  borderColor: "rgba(99, 102, 241, 0.5)",
                  color: "#818cf8"
                }}
                className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs text-slate-400 bg-white/5 border border-white/5 rounded-full transition-colors cursor-default will-change-transform"
              >
                {v}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div whileHover={{ scale: 1.01 }} className="relative p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] bg-indigo-600 overflow-hidden shadow-2xl">
            <div className="relative z-10 text-center">
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-8 leading-tight uppercase italic">
                READY TO START<br className="hidden md:block" /> PRODUCING?
              </h2>
              <Link href="/studio" className="inline-flex items-center gap-4 px-8 md:px-12 py-4 md:py-6 bg-white text-indigo-600 font-black text-xl md:text-2xl rounded-2xl md:rounded-3xl hover:bg-slate-100 transition-all">
                OPEN YOUR STUDIO
                <ArrowRight className="w-6 h-6 md:w-8 md:h-8" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 px-6 border-t border-white/5 relative z-10 bg-slate-950/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3">
            <Mic2 className="w-6 h-6 text-indigo-500" />
            <span className="font-black text-white text-xl tracking-tighter uppercase italic">GenBox</span>
          </div>
          
          <div className="flex items-center gap-8">
            <Link href="/privacy" className="text-[10px] font-black text-slate-500 hover:text-indigo-400 uppercase tracking-widest transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-[10px] font-black text-slate-500 hover:text-indigo-400 uppercase tracking-widest transition-colors">Terms of Service</Link>
          </div>

          <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">© 2026 VoiceGen AI Laboratory</p>
        </div>
      </footer>
    </div>
  );
}
