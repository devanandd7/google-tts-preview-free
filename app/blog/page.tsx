import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

const SAMPLES = [
  {
    category: "Broadcast & Podcasts",
    items: [
      {
        title: "Debate: Puck & Kore",
        description: "A dynamic broadcast dialogue generated between two AI personas.",
        file: "/samples/broadcast/voicegen-Puck & Kore-1776495800518.wav",
        duration: "01:02",
        size: "2.9 MB"
      }
    ]
  },
  {
    category: "Scripts & Narrations",
    items: [
      {
        title: "Kore Monologue (Long)",
        description: "An extensive 9-minute generated script narration showing advanced emotional range.",
        file: "/samples/script/voicegen-Kore-1776448441034.wav",
        duration: "09:23",
        size: "27.0 MB"
      },
      {
        title: "Kore Story (Medium)",
        description: "A 6-minute storytelling script.",
        file: "/samples/script/voicegen-Kore-1776446767594.wav",
        duration: "06:29",
        size: "18.7 MB"
      },
      {
        title: "Kore Story (Short)",
        description: "A 1-minute focused narrative.",
        file: "/samples/script/sonic-prod-Kore-1776517546930.wav",
        duration: "01:26",
        size: "4.1 MB"
      },
      {
        title: "Algenib Narration",
        description: "A brief professional script delivery.",
        file: "/samples/script/voicegen-Algenib-1776422996980.wav",
        duration: "00:37",
        size: "1.8 MB"
      }
    ]
  },
  {
    category: "English Voices",
    items: [
      {
        title: "Aoede (English)",
        description: "Standard voice profile demonstration.",
        file: "/samples/english/aoede.wav",
        duration: "00:08",
        size: "0.4 MB"
      },
      {
        title: "Kore (English)",
        description: "Standard voice profile demonstration.",
        file: "/samples/english/kore.wav",
        duration: "00:08",
        size: "0.4 MB"
      },
      {
        title: "Leda (English)",
        description: "Standard voice profile demonstration.",
        file: "/samples/english/leda.wav",
        duration: "00:08",
        size: "0.4 MB"
      }
    ]
  },
  {
    category: "Hindi Voices",
    items: [
      {
        title: "Kore (Hindi)",
        description: "Multilingual capability demonstration.",
        file: "/samples/hindi/kore.wav",
        duration: "00:08",
        size: "0.4 MB"
      },
      {
        title: "Leda (Hindi)",
        description: "Multilingual capability demonstration.",
        file: "/samples/hindi/leda.wav",
        duration: "00:08",
        size: "0.4 MB"
      }
    ]
  }
];

export default async function BlogPage() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      <div className="absolute top-0 -left-48 w-[700px] h-[700px] bg-indigo-500/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[110px] pointer-events-none" />

      <nav className="relative z-10 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">GenBox</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/blog" className="text-sm font-semibold text-white/80 hover:text-white transition-colors">
              Blogs
            </Link>
            {userId ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/studio"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  Open Studio
                </Link>
                <UserButton />
              </div>
            ) : (
              <Link
                href="/studio"
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-black text-sm font-bold transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-6">
            Inside <span className="text-indigo-400">GenBox</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Discover the full suite of creative tools designed for production-grade AI synthesis.
          </p>
        </div>

        {/* --- FEATURES DOCUMENTATION --- */}
        <section className="mb-32 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-900/10 border border-indigo-500/20 p-8 rounded-3xl hover:bg-indigo-500/20 transition-all group">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-wide uppercase">GenBox Forge</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Take full creative control. Paste your raw script and inject director-style tags (like <code className="text-indigo-300 bg-indigo-500/20 px-1 rounded">[whispers]</code> or emotional cues). Select from over 30 distinct AI actors to synthesize audio instantly. Supports Standard (2k chars) and Long Form (9k chars) outputs.
              </p>
            </div>

            <div className="bg-gradient-to-br from-violet-500/10 to-violet-900/10 border border-violet-500/20 p-8 rounded-3xl hover:bg-violet-500/20 transition-all group">
              <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-wide uppercase">Script Architect</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Provide a simple concept and let Gemini draft a highly detailed, emotionally tagged script ready for audio synthesis. Review the script, adjust the length duration, pick your language (English or Hindi), and synthesize effortlessly.
              </p>
            </div>

            <div className="bg-gradient-to-br from-pink-500/10 to-pink-900/10 border border-pink-500/20 p-8 rounded-3xl hover:bg-pink-500/20 transition-all group">
              <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.829 1.58-1.936a4.5 4.5 0 001.31-.433m-1.5 2.56a12.12 12.12 0 01-3 0m4.5-2.56V15.75" /></svg>
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-wide uppercase">Broadcast Suite <span className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded ml-2">PRO</span></h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Designed for podcast and interview creation. Define a topic, select a Lead Moderator and an Invited Guest voice. The AI automatically designs a multi-speaker dialogue script and processes the conversational audio output.
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-900/10 border border-cyan-500/20 p-8 rounded-3xl hover:bg-cyan-500/20 transition-all group">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-wide uppercase">Visual Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Not just audio—generate stunning visual concepts to accompany your voiceovers. Your basic prompt is enhanced by Gemini into a detailed technical prompt, which is then rendered into a master image asset by Pollinations AI.
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 border border-emerald-500/20 p-8 rounded-3xl hover:bg-emerald-500/20 transition-all group lg:col-span-2">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-wide uppercase">Media Vault & Command Center</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your workspace features a professional 3-column architecture. The **Media Vault** on the left securely stores all your session's generated assets (both audio and images) with instant playback and one-click download capabilities. On the right, the **Command Center** allows Pro users to actively manage their session quotas or bind custom encrypted API keys for high-volume workflows without limits.
              </p>
            </div>
          </div>
        </section>

        {/* --- AUDIO CAPABILITIES SHOWCASE --- */}
        <div className="text-center mb-16 pt-16 border-t border-white/5">
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
            Production <span className="text-indigo-400">Samples</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Listen to unedited, raw outputs generated directly from the GenBox Engine.
          </p>
        </div>

        <div className="space-y-16">
          {SAMPLES.map((category) => (
            <div key={category.category}>
              <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-4">{category.category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {category.items.map((item) => (
                  <div key={item.file} className="bg-white/[0.02] border border-white/[0.05] p-6 rounded-2xl hover:bg-white/[0.04] transition-colors">
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-400 mb-6">{item.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-4 font-mono">
                      <span>Duration: {item.duration}</span>
                      <span>Size: {item.size}</span>
                    </div>

                    <audio controls className="w-full h-10 rounded-lg outline-none">
                      <source src={item.file} type="audio/wav" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
