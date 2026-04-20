"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function PrivacyPolicy() {
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
                        <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter italic">Privacy <span className="text-indigo-500">Policy</span></h1>
                        <p className="text-slate-500 text-sm font-medium">Last Updated: April 20, 2026</p>
                    </section>

                    <div className="prose prose-invert max-w-none space-y-10">
                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                                Overview
                            </h2>
                            <p className="leading-relaxed">
                                At GenBox, we prioritize your privacy. This policy outlines how we handle your data when you use our AI Audio and Visual generation services, specifically regarding our integration with Google Services.
                            </p>
                        </section>

                        <section className="space-y-4 bg-white/[0.02] border border-white/[0.05] p-8 rounded-3xl">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-emerald-500 rounded-full" />
                                Google Data Usage
                            </h2>
                            <p className="leading-relaxed">
                                Our application requests specific permissions to enhance your workflow by automating file backups.
                            </p>
                            <ul className="space-y-4 text-sm font-bold text-slate-400">
                                <li className="flex gap-3">
                                    <span className="text-emerald-400">✓</span>
                                    <span><strong>Google Drive Access:</strong> We use the <code>drive.file</code> scope. This means GenBox can <strong>ONLY</strong> access files that it creates or that you specifically open with it. We cannot read your personal photos, documents, or other private folders.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-emerald-400">✓</span>
                                    <span><strong>Storage Logic:</strong> We create and interact only with a folder named <strong>"GenBox Backups"</strong> to store your generated media.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-emerald-400">✓</span>
                                    <span><strong>No Data Sale:</strong> We do not sell, trade, or share your Google user data with any third-party advertisers or data brokers.</span>
                                </li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                                AI & TTS Processing
                            </h2>
                            <p className="leading-relaxed">
                                GenBox utilizes **Google Cloud Text-to-Speech (TTS)** and **Gemini AI** technologies to convert your scripts into high-quality audio. 
                            </p>
                            <p className="text-sm leading-relaxed text-slate-400 italic bg-white/[0.03] p-4 rounded-xl border-l-4 border-indigo-500">
                                Note: Your input text is sent to Google's AI Engine solely for processing and audio synthesis. This data is handled according to Google's Enterprise Privacy standards and is not used to train global AI models without explicit consent.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2 h-6 bg-indigo-600 rounded-full" />
                                Data Retention
                            </h2>
                            <p className="leading-relaxed">
                                We retain your account information (Email and usage stats) as long as your account is active. You may disconnect your Google Drive at any time from the Settings panel, which will immediately revoke our access to your tokens.
                            </p>
                        </section>
                    </div>

                    <footer className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">© 2026 GenBox AI Studio</p>
                        <div className="flex gap-8">
                            <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors">Terms of Service</Link>
                            <Link href="mailto:support@genbox.online" className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors">Contact Support</Link>
                        </div>
                    </footer>
                </motion.div>
            </main>
        </div>
    );
}
