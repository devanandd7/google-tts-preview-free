"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  Download,
  Info,
  Clock,
  Database
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const SUPABASE_BASE_URL = "https://jvdbazjbqmrkytnacjsa.supabase.co/storage/v1/object/public/GenBox%201";

interface SampleItem {
  title: string;
  description: string;
  file: string;
  type: string;
  duration: string;
  size: string;
}

interface SampleCategory {
  category: string;
  items: SampleItem[];
}

const SAMPLES = [
  {
    category: "Broadcast & Podcasts",
    items: [
      {
        title: "Broadcast 1",
        description: "Multi-Speaker Debate",
        file: "t30nMCjSuDQ",
        type: "video",
        duration: "00:45",
        size: "YouTube"
      },
      {
        title: "Broadcast 2",
        description: "Cinematic Narration",
        file: "Pwi8gsXqU2o",
        type: "video",
        duration: "00:52",
        size: "YouTube"
      }
    ]
  },
  {
    category: "Scripts & Narrations",
    items: [
      {
        title: "Sunidhi Monologue (Long)",
        description: "An extensive 9-minute generated script narration showing advanced emotional range.",
        file: `${SUPABASE_BASE_URL}/script/voicegen-Kore-1776448441034.wav`,
        type: "audio",
        duration: "09:23",
        size: "27.0 MB"
      },
      {
        title: "Sunidhi Story (Medium)",
        description: "A 6-minute storytelling script.",
        file: `${SUPABASE_BASE_URL}/script/voicegen-Kore-1776446767594.wav`,
        type: "audio",
        duration: "06:29",
        size: "18.7 MB"
      },
      {
        title: "Sunidhi Story (Short)",
        description: "A 1-minute focused narrative.",
        file: `${SUPABASE_BASE_URL}/script/sonic-prod-Kore-1776517546930.wav`,
        type: "audio",
        duration: "01:26",
        size: "4.1 MB"
      },
      {
        title: "Rahul Narration",
        description: "A brief professional script delivery.",
        file: `${SUPABASE_BASE_URL}/script/voicegen-Algenib-1776422996980.wav`,
        type: "audio",
        duration: "00:37",
        size: "1.8 MB"
      }
    ]
  },
  {
    category: "English Voices",
    items: [
      {
        title: "Priya (English)",
        description: "Standard voice profile demonstration.",
        file: `${SUPABASE_BASE_URL}/english/aoede.wav`,
        type: "audio",
        duration: "00:08",
        size: "0.4 MB"
      },
      {
        title: "Sunidhi (English)",
        description: "Standard voice profile demonstration.",
        file: `${SUPABASE_BASE_URL}/english/kore.wav`,
        type: "audio",
        duration: "00:08",
        size: "0.4 MB"
      },
      {
        title: "Priyanka (English)",
        description: "Standard voice profile demonstration.",
        file: `${SUPABASE_BASE_URL}/english/leda.wav`,
        type: "audio",
        duration: "00:08",
        size: "0.4 MB"
      }
    ]
  },
  {
    category: "Hindi Voices (Production Grade)",
    items: [
      {
        title: "Dev",
        description: "Deep, masculine voice with authoritative and energetic tone.",
        file: `${SUPABASE_BASE_URL}/hindi/genbox-prod-Dev-1776602011354.wav`,
        type: "audio",
        duration: "00:08",
        size: "244 KB"
      },
      {
        title: "Priyanka",
        description: "Warm, professional female voice perfect for narrations.",
        file: `${SUPABASE_BASE_URL}/hindi/genbox-prod-Priyanka-1776602122809.wav`,
        type: "audio",
        duration: "00:08",
        size: "246 KB"
      },
      {
        title: "Devsheel",
        description: "Versatile male voice with a calm and measured delivery.",
        file: `${SUPABASE_BASE_URL}/hindi/genbox-prod-Devsheel-1776602023490.wav`,
        type: "audio",
        duration: "00:08",
        size: "248 KB"
      },
      {
        title: "Devanshi",
        description: "Youthful and bright female voice for engaging content.",
        file: `${SUPABASE_BASE_URL}/hindi/genbox-prod-Devanshi-1776602033101.wav`,
        type: "audio",
        duration: "00:08",
        size: "236 KB"
      },
      {
        title: "Sunidhi",
        description: "Elegant and sophisticated feminine tone.",
        file: `${SUPABASE_BASE_URL}/hindi/genbox-prod-Sunidhi-1776602107634.wav`,
        type: "audio",
        duration: "00:08",
        size: "242 KB"
      },
      {
        title: "Sameer",
        description: "Strong, resonant masculine voice for professional use.",
        file: `${SUPABASE_BASE_URL}/hindi/genbox-prod-Sameer-1776602181942.wav`,
        type: "audio",
        duration: "00:08",
        size: "250 KB"
      }
    ]
  }
];

export default function BlogPage() {
  const { userId } = useAuth();
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true);
        if (!supabase) {
          console.warn("Supabase client not initialized. Check .env variables.");
          setSamples([]);
          return;
        }

        // Fetch Hindi files from GenBox 1 bucket
        const { data: hindiFiles, error: hindiError } = await supabase.storage
          .from("GenBox 1")
          .list("hindi");

        // Fetch English files from GenBox 1 bucket
        const { data: englishFiles, error: englishError } = await supabase.storage
          .from("GenBox 1")
          .list("english");

        if (hindiError || englishError) {
          console.error("Supabase error:", hindiError || englishError);
        }

        const dynamicSamples = [
          {
            category: "Production Broadcasts (YouTube)",
            items: [
              { title: "Broadcast 1", description: "Multi-Speaker Debate", file: "t30nMCjSuDQ", type: "video", duration: "00:45", size: "YouTube" },
              { title: "Broadcast 2", description: "Cinematic Narration", file: "Pwi8gsXqU2o", type: "video", duration: "00:52", size: "YouTube" }
            ]
          },
          {
            category: "Hindi Voices (Cloud Vault)",
            items: (hindiFiles || []).filter(f => f.name !== ".emptyKeep" && f.name.includes('.wav')).map(f => {
              let title = f.name.split('-')[2] || f.name.replace('.wav', '');
              return {
                title,
                description: "High-fidelity production voice generated by GenBox.",
                file: `${SUPABASE_BASE_URL}/hindi/${f.name}`,
                type: "audio",
                duration: "00:08",
                size: f.metadata ? `${(f.metadata.size / 1024).toFixed(0)} KB` : "250 KB"
              };
            })
          },
          {
            category: "English Voices (Cloud Vault)",
            items: (englishFiles || []).filter(f => f.name !== ".emptyKeep" && f.name.includes('.wav')).map(f => {
              let title = f.name.split('-')[2] || f.name.replace('.wav', '');
              if (title === "Ananya") title = "Priyanka";
              return {
                title,
                description: "International standard AI voice profile.",
                file: `${SUPABASE_BASE_URL}/english/${f.name}`,
                type: "audio",
                duration: "00:08",
                size: f.metadata ? `${(f.metadata.size / 1024).toFixed(0)} KB` : "250 KB"
              };
            })
          }
        ];

        setSamples(dynamicSamples);
      } catch (err) {
        console.error("Error fetching samples:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchFiles();
  }, []);

  const togglePlay = (file: string) => {
    const audio = audioRefs.current[file];
    if (!audio) return;

    if (playingFile === file) {
      audio.pause();
      setPlayingFile(null);
    } else {
      if (playingFile && audioRefs.current[playingFile]) {
        audioRefs.current[playingFile]?.pause();
      }
      audio.play();
      setPlayingFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-48 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-48 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[120px]" />
      </div>

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Mic2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="font-black text-white text-xl md:text-2xl tracking-tighter uppercase italic">GenBox</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link href="/studio" className="hidden md:block text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Studio</Link>
            {userId ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/studio"
                  className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-indigo-600 text-white text-[10px] md:text-sm font-black uppercase tracking-wider hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                >
                  STUDIO
                </Link>
                <UserButton />
              </div>
            ) : (
              <Link
                href="/studio"
                className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-white text-black text-[10px] md:text-sm font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
              >
                SIGN IN
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="relative pt-32 md:pt-44 pb-12 md:pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-6 md:mb-8"
          >
            <Database className="w-3 h-3" />
            Archive
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl md:text-8xl font-black tracking-tighter text-white leading-none mb-6 md:mb-8 italic uppercase"
          >
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">GenBox</span> Archive
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl mx-auto text-sm md:text-xl text-slate-400 leading-relaxed mb-8 md:mb-12"
          >
            Production-grade synthesis capabilities. Explore técnico monologues and broadcast suites.
          </motion.p>
        </div>
      </header>

      {/* FEATURE CARDS - HIDDEN ON SMALL MOBILE TO SAVE SPACE OR SCALED */}
      <section className="py-12 md:py-20 px-6 border-y border-white/5 bg-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {[
            { icon: Zap, title: "Forge", desc: "Director tags control.", color: "indigo" },
            { icon: Sparkles, title: "Architect", desc: "LLM synthesis.", color: "violet" },
            { icon: MessageSquare, title: "Broadcast", desc: "Multi-speaker.", color: "pink" }
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-4 md:p-8 rounded-2xl md:rounded-[2rem] bg-slate-950 border border-white/5 flex items-center md:flex-col gap-4 md:gap-0 md:text-center"
            >
              <div className={`w-10 h-10 md:w-14 md:h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center md:mb-6`}>
                <f.icon className="w-5 h-5 md:w-8 md:h-8 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm md:text-2xl font-black text-white md:mb-4 tracking-tight uppercase italic">{f.title}</h3>
                <p className="hidden md:block text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SAMPLE ARCHIVE */}
      <main className="py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-7xl mx-auto space-y-20 md:space-y-32">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Accessing Cloud Vault...</p>
            </div>
          ) : (
            <>
              {samples.map((category) => (
                <div key={category.category} className="space-y-8 md:space-y-12">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl md:text-5xl font-black text-white tracking-tighter italic uppercase whitespace-nowrap">
                      {category.category}
                    </h2>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className={`grid gap-6 md:gap-8 ${category.category === "Production Broadcasts (YouTube)" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
                    {category.items.map((item: SampleItem, itemIdx: number) => (
                      <motion.div
                        key={item.file}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className={`group relative transition-all duration-300 ${item.type === "video" ? "p-0 bg-transparent" : "bg-slate-900/40 border border-white/5 p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] flex flex-col " + (playingFile === item.file ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.2)] bg-indigo-500/5' : 'border-white/5')}`}
                      >
                        {item.type === "video" ? (
                          <div className="flex flex-col items-center">
                            <div className="relative w-full rounded-[2.5rem] overflow-hidden border border-white/10 aspect-video shadow-2xl mb-8 bg-black">
                              <iframe 
                                className="w-full h-full border-0"
                                src={`https://www.youtube.com/embed/${item.file}?modestbranding=1&rel=0&iv_load_policy=3`}
                                title={item.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              ></iframe>
                              <div className="absolute top-6 left-6 z-20">
                                <span className="text-yellow-400 font-black text-xl italic drop-shadow-lg">GenBox</span>
                              </div>
                            </div>
                            <div className="text-center space-y-2 pb-10">
                              <h3 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter">{item.title}</h3>
                              <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs md:text-sm">{item.description}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3 md:mb-6">
                              <div className="min-w-0">
                                <h3 className="text-xs md:text-2xl font-black text-white tracking-tight leading-tight truncate">{item.title}</h3>
                                <div className="flex items-center gap-2 text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                  <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {item.duration}</span>
                                  <span className="flex items-center gap-0.5 ml-2"><Database className="w-2.5 h-2.5" /> {item.size}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => togglePlay(item.file)}
                                className={`w-8 h-8 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${playingFile === item.file ? 'bg-white text-black' : 'bg-white/5 text-white'}`}
                              >
                                {playingFile === item.file ? <Pause className="w-4 h-4 md:w-6 md:h-6 fill-current" /> : <Play className="w-4 h-4 md:w-6 md:h-6 fill-current ml-0.5 md:ml-1" />}
                              </button>
                            </div>

                            <p className="hidden md:block text-slate-400 text-sm italic mb-8 line-clamp-2">
                              "{item.description}"
                            </p>

                            <div className="mt-auto flex items-end gap-1 h-4 md:h-8 mb-2 md:mb-0">
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <motion.div 
                                  key={i}
                                  animate={{
                                    height: playingFile === item.file ? ["20%", "100%", "20%"] : "20%"
                                  }}
                                  transition={{
                                    duration: 0.5,
                                    repeat: Infinity,
                                    delay: i * 0.05
                                  }}
                                  className={`w-1 md:w-1.5 rounded-full ${playingFile === item.file ? 'bg-indigo-400' : 'bg-white/10'}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {item.type === "audio" && (
                          <audio 
                            ref={(el) => { audioRefs.current[item.file] = el; }}
                            onEnded={() => setPlayingFile(null)}
                            className="hidden"
                          >
                            <source src={item.file} type="audio/wav" />
                          </audio>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </main>

      {/* CTA SECTION */}
      <section className="py-12 md:py-32 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div whileHover={{ scale: 1.02 }} className="relative p-6 md:p-16 rounded-[2rem] md:rounded-[4rem] bg-indigo-600 overflow-hidden shadow-2xl">
            <div className="relative z-10 text-center">
              <h2 className="text-3xl md:text-6xl font-black text-white tracking-tighter mb-6 md:mb-8 leading-tight uppercase italic">
                READY TO START<br className="hidden md:block" /> PRODUCING?
              </h2>
              <Link href="/studio" className="inline-flex items-center gap-3 px-6 py-4 md:px-12 md:py-6 bg-white text-indigo-600 font-black text-lg md:text-2xl rounded-xl md:rounded-3xl hover:bg-slate-100 transition-all">
                OPEN STUDIO
                <ArrowRight className="w-5 h-5 md:w-8 md:h-8" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 md:py-20 px-6 border-t border-white/5 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10">
          <div className="flex items-center gap-3">
            <Mic2 className="w-5 h-5 md:w-6 md:h-6 text-indigo-500" />
            <span className="font-black text-white text-lg md:text-xl tracking-tighter uppercase italic">GenBox</span>
          </div>
          <p className="text-slate-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest">© 2026 VoiceGen AI Laboratory</p>
        </div>
      </footer>
    </div>
  );
}
