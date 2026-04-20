"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 selection:bg-indigo-500/30 font-sans">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]" />
            </div>

            <main className="relative max-w-4xl mx-auto px-6 py-20 lg:py-32">
                <Link 
                    href="/" 
                    className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-12 group"
                >
                    <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    <span className="text-xs font-black uppercase tracking-widest">Back to Studio</span>
                </Link>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="space-y-12"
                >
                    <section className="space-y-4">
                        <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter italic">Terms of <span className="text-indigo-500">Service</span></h1>
                        <p className="text-slate-500 text-sm font-medium">Last Updated: April 20, 2026</p>
                    </section>

                    <div className="prose prose-invert max-w-none space-y-10 text-sm md:text-base leading-relaxed">
                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                                1. Acceptance of Terms
                            </h2>
                            <p>
                                By accessing or using GenBox AI Studio, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using the service.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                                2. Service Description
                            </h2>
                            <p>
                                GenBox provides an AI-powered content generation platform that utilizes **Google Cloud Text-to-Speech** and **Gemini AI** to create audio and visual media. The service includes optional Google Drive integration for automated cloud backups.
                            </p>
                        </section>

                        <section className="space-y-4 bg-white/[0.02] border border-white/[0.05] p-8 rounded-3xl">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-violet-500 rounded-full" />
                                3. User Conduct & Content
                            </h2>
                            <p>
                                You are solely responsible for the scripts and prompts you provide to the platform.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-400 font-bold">
                                <li>You may not use the service to generate hate speech, illegal content, or deepfakes for malicious purposes.</li>
                                <li>You represent that you own or have the necessary rights to the text content you process via our Google TTS integration.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                                4. Google Drive Forge
                            </h2>
                            <p>
                                The "Drive Forge" feature allows you to link your personal Google account. 
                                <strong> Limitation of Liability:</strong> While we use industry-standard security (AES-256) to handle your tokens, we are not responsible for any data loss occurring on Google's servers. You maintain full control over your backup folder.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                                5. Termination
                            </h2>
                            <p>
                                We reserve the right to suspend or terminate your access to GenBox at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users of the service.
                            </p>
                        </section>

                        <section className="space-y-4 bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10">
                            <h2 className="text-lg font-black text-white italic">Disclaimer</h2>
                            <p className="text-xs text-slate-400 uppercase tracking-wide leading-relaxed">
                                THE SERVICE IS PROVIDED "AS IS" WITHOUT ANY WARRANTIES. GENBOX DOES NOT GUARANTEE THAT THE AI-GENERATED OUTPUTS (VIA GOOGLE TTS OR GEMINI) WILL BE 100% ACCURATE OR ERROR-FREE.
                            </p>
                        </section>
                    </div>

                    <footer className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">© 2026 GenBox AI Studio</p>
                        <div className="flex gap-8">
                            <Link href="/privacy" className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors">Privacy Policy</Link>
                            <Link href="mailto:support@genbox.online" className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors">Contact Support</Link>
                        </div>
                    </footer>
                </motion.div>
            </main>
        </div>
    );
}
