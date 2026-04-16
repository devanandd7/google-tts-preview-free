import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 -left-48 w-[700px] h-[700px] bg-indigo-500/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-pink-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* NAV */}
      <nav className="relative z-10 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">VoiceGen AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">Free</span>
            <Link
              href="/studio"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Open Studio
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Powered by Gemini 3.1 Flash TTS · 100% Free
          </div>

          <h1 className="text-6xl lg:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-violet-300 leading-none">
            Direct Your<br />
            <span className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">AI Voice Actor</span>
          </h1>

          <p className="max-w-2xl mx-auto text-xl text-slate-400 leading-relaxed">
            Turn any text into a studio-quality AI voice performance. Choose a character, set the mood, add director's notes — then hit record.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/studio"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98]"
            >
              Start Generating Free
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="https://ai.google.dev/gemini-api/docs/speech-generation"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-semibold text-lg rounded-2xl transition-colors"
            >
              Read the Docs
            </a>
          </div>
        </div>

        {/* FEATURE CARDS */}
        <div className="mt-32 grid md:grid-cols-3 gap-6">
          <div className="group bg-slate-900/40 border border-slate-800 hover:border-indigo-500/40 p-8 rounded-3xl transition-colors">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500/30 transition-colors">
              <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Direct TTS</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Paste your own tagged script with director's notes, emotion cues, and [whispers] — and generate instantly. Full creative control.
            </p>
          </div>

          <div className="group bg-slate-900/40 border border-slate-800 hover:border-violet-500/40 p-8 rounded-3xl transition-colors">
            <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-500/30 transition-colors">
              <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">AI Script Builder</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Give a simple topic idea. Gemini writes a full director-style tagged script with audio profile, scene, and notes — you review, then generate.
            </p>
          </div>

          <div className="group bg-slate-900/40 border border-slate-800 hover:border-pink-500/40 p-8 rounded-3xl transition-colors">
            <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-pink-500/30 transition-colors">
              <svg className="w-6 h-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">30+ Voice Profiles</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Choose from Kore, Puck, Charon, Fenrir, Leda, and 25+ more prebuilt Gemini voices. Each with unique character and tone.
            </p>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="mt-32 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-16">Two Ways to Create</h2>
          <div className="space-y-6">
            {/* Mode 1 */}
            <div className="flex gap-6 items-start p-6 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <span className="text-indigo-300 font-black text-lg">1</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Direct TTS — Full Control</h3>
                <p className="text-slate-400 text-sm leading-relaxed">You write the complete script with audio tags like <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">[whispers]</code>, <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">[shouting]</code>, or director-style notes. Paste it in, pick a voice, and generate.</p>
              </div>
            </div>
            {/* Mode 2 */}
            <div className="flex gap-6 items-start p-6 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                <span className="text-violet-300 font-black text-lg">2</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">AI-Assisted — 2-Step Magic</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Give a plain text idea like <em className="text-slate-300">"a grumpy chef talking about pasta"</em>. Gemini crafts a full director-style prompt with scene, profile, and notes. You review and edit, then trigger the final audio generation.</p>
              </div>
            </div>
          </div>
        </div>

        {/* VOICES SHOWCASE */}
        <div className="mt-32 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">30+ Prebuilt Voices</h2>
          <p className="text-slate-400 mb-10">Every voice has a distinct character. Explore them in your studio.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {["Kore","Puck","Charon","Fenrir","Leda","Aoede","Callirrhoe","Autonoe","Enceladus","Iapetus","Umbriel","Algieba","Despina","Erinome","Algenib","Rasalgethi","Laomedeia","Achernar","Alnilam","Schedar","Gacrux","Pulcherrima","Achird","Zubenelgenubi","Vindemiatrix","Sadachbia","Sadaltager","Sulafat"].map((v) => (
              <span key={v} className="px-3 py-1.5 text-sm text-slate-300 bg-slate-800/60 border border-slate-700/50 rounded-full hover:border-indigo-500/50 hover:text-indigo-300 transition-colors cursor-default">
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* CTA BOTTOM */}
        <div className="mt-32 text-center">
          <div className="inline-block p-px bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 rounded-3xl">
            <div className="bg-slate-950 rounded-3xl px-12 py-12">
              <h2 className="text-4xl font-black text-white mb-4">Ready to Direct?</h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">Sign in and open the studio. No cost, no credit card. Just your creativity and Gemini's voice.</p>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-lg rounded-xl transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98]"
              >
                Open Studio Free
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-sm">
          <span>© 2026 VoiceGen AI · Powered by Gemini</span>
          <a href="https://ai.google.dev/gemini-api/docs/speech-generation" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
            Gemini TTS Docs ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
