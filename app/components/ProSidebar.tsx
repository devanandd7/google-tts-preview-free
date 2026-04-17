import React, { useState } from "react";
import { toast } from "./Toaster";

interface ProSidebarProps {
    isPro: boolean;
    onUpgradeClick?: () => void;
    savedKeyStatus?: "active" | "invalid" | "none";
    onSaveKey: (key: string) => Promise<boolean>;
    onCloseMobile?: () => void;
    mobileOpen?: boolean;
}

export function ProSidebar({ isPro, onUpgradeClick, savedKeyStatus = "none", onSaveKey, onCloseMobile, mobileOpen }: ProSidebarProps) {
    const [customKey, setCustomKey] = useState("");
    const [savingKey, setSavingKey] = useState(false);
    const [validationError, setValidationError] = useState("");

    const handleSave = async () => {
        if (!customKey.trim()) return;
        setSavingKey(true);
        setValidationError("");

        try {
            // Validate first
            const valRes = await fetch("/api/validate-key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey: customKey }),
            });
            const valData = await valRes.json();

            if (!valRes.ok || !valData.valid) {
                setValidationError(valData.error || "Invalid API key");
                toast.error(valData.error || "Invalid API key", "Key Validation Failed");
                setSavingKey(false);
                return;
            }

            // Then save
            const success = await onSaveKey(customKey);
            if (success) {
                setCustomKey("");
                setValidationError("");
                toast.success("API key saved and validated successfully!", "Success");
            }
        } catch (err: any) {
            setValidationError(err.message || "Something went wrong.");
            toast.error(err.message || "Failed to validate/save key.", "Error");
        } finally {
            setSavingKey(false);
        }
    };

    const getStatusBadge = () => {
        if (savedKeyStatus === "active") {
            return <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md">Valid & Active</span>;
        }
        if (savedKeyStatus === "invalid") {
            return <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 rounded-md">Invalid Key</span>;
        }
        return <span className="px-2 py-0.5 text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 rounded-md">None saved</span>;
    };

    const sidebarContent = (
        <div className="flex flex-col h-full w-full bg-slate-900 border-l border-slate-800">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                    Settings
                </h2>

                {/* Mobile close button */}
                {onCloseMobile && (
                    <button onClick={onCloseMobile} className="lg:hidden p-1 rounded hover:bg-slate-800 text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 relative">
                {!isPro ? (
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">Pro Perks</h3>
                        <div className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border border-indigo-500/30 rounded-xl p-4 space-y-4 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500"></div>

                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                                    <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                </div>
                                <h4 className="text-white font-bold text-base">Premium Studio Access</h4>
                            </div>

                            <ul className="space-y-2.5">
                                <li className="flex items-start gap-2 text-sm text-indigo-100">
                                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    <span><strong>Premium Voices:</strong> Access highly expressive Google TTS studio voices with real emotional range.</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-indigo-100">
                                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    <span><strong>Unlimited Generations:</strong> Easily connect your free Gemini API key to completely remove all daily limits.</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-indigo-100">
                                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    <span><strong>Secure Storage:</strong> Keys are AES-256 encrypted directly in your account.</span>
                                </li>
                            </ul>

                            <button onClick={onUpgradeClick} className="w-full mt-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] active:scale-95">
                                Upgrade directly (₹49/mo)
                            </button>
                        </div>

                        <div className="opacity-40 pointer-events-none filter grayscale mt-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Gemini API Config</h3>
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                                <label className="block text-xs font-semibold text-slate-500 mb-2">Your API Key</label>
                                <input type="password" disabled className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500" placeholder="AIzaSy..." />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">Gemini API Config</h3>
                            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                                Connect your free Google Gemini API key to unlock <strong className="text-indigo-300 font-bold">Unlimited Premium Voices</strong>. Your key stays securely AES-256 encrypted on our servers.
                            </p>

                            <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-xl p-5 mb-6 space-y-3 shadow-inner">
                                <h4 className="text-sm font-bold text-indigo-200 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.829 1.508-2.336 1.145-.683 1.992-1.918 1.992-3.472A5.625 5.625 0 102.25 12c0 1.554.847 2.789 1.992 3.472.85.507 1.508 1.353 1.508 2.336V18" />
                                    </svg>
                                    How to get a Free Key
                                </h4>
                                <ol className="text-sm text-indigo-300/90 space-y-2.5 list-decimal list-outside ml-4 mt-2">
                                    <li className="pl-1">Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-white hover:text-indigo-300 font-semibold underline underline-offset-2 transition-colors">Google AI Studio</a>.</li>
                                    <li className="pl-1">Sign in with your Google account.</li>
                                    <li className="pl-1">Click the <strong className="text-white">"Create API key"</strong> button.</li>
                                    <li className="pl-1">Copy the key and paste it below.</li>
                                </ol>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-bold text-slate-300">Your API Key</label>
                                    {getStatusBadge()}
                                </div>

                                <div className="relative">
                                    <input
                                        type="password"
                                        value={customKey}
                                        onChange={(e) => setCustomKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all pr-10 font-mono shadow-inner"
                                    />
                                </div>

                                {validationError && (
                                    <p className="text-sm font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg flex items-center gap-2">
                                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        {validationError}
                                    </p>
                                )}

                                <button
                                    onClick={handleSave}
                                    disabled={savingKey || !customKey.trim()}
                                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:shadow-none disabled:cursor-not-allowed border-none mt-2"
                                >
                                    {savingKey ? "Checking and Saving..." : (
                                        <span className="flex justify-center items-center gap-2">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                            Save Key securely
                                        </span>
                                    )}
                                </button>
                                <div className="flex gap-2 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-400 text-xs mt-3">
                                    <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    Keys are encrypted with AES-256 before storage and never exposed to the client.
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop/Laptop layout: 280px fixed or toggleable sidebar handled by parent struct, this is just content */}
            <div className="hidden lg:block w-[280px] shrink-0 h-[calc(100vh-4rem)] sticky top-16">
                {sidebarContent}
            </div>

            {/* Mobile/Tablet bottom sheet layout */}
            <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onCloseMobile}></div>
                <div className={`absolute bottom-0 left-0 right-0 h-[80vh] bg-slate-900 rounded-t-2xl shadow-2xl transition-transform duration-300 transform flex flex-col border-t border-slate-800 ${mobileOpen ? "translate-y-0" : "translate-y-full"}`}>
                    {sidebarContent}
                </div>
            </div>
        </>
    );
}
