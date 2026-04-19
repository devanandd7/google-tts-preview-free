import React, { useState } from "react";
import { toast } from "./Toaster";

interface ProSidebarProps {
    isPro: boolean;
    onUpgradeClick?: () => void;
    savedKeyStatus?: "active" | "invalid" | "none";
    initialKey?: string | null;
    onSaveKey: (key: string) => Promise<boolean>;
    onCloseMobile?: () => void;
    mobileOpen?: boolean;
    profile?: any;
}

export function ProSidebar({ 
    isPro, 
    onUpgradeClick, 
    savedKeyStatus = "none", 
    initialKey, 
    onSaveKey, 
    onCloseMobile, 
    mobileOpen,
    profile
}: ProSidebarProps) {
    const [customKey, setCustomKey] = useState(initialKey || "");
    const [savingKey, setSavingKey] = useState(false);
    const [validationError, setValidationError] = useState("");
    const [showKey, setShowKey] = useState(false);

    // Sync with initial keys when they load or change
    React.useEffect(() => {
        if (initialKey && !customKey) setCustomKey(initialKey);
    }, [initialKey]);

    const handleSave = async () => {
        if (!customKey.trim()) return;
        setSavingKey(true);
        setValidationError("");

        try {
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

            const success = await onSaveKey(customKey);
            if (success) {
                setValidationError("");
                toast.success("Gemini key saved successfully!", "Success");
            }
        } catch (err: any) {
            setValidationError(err.message || "Something went wrong.");
        } finally {
            setSavingKey(false);
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === "active") {
            return <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md uppercase tracking-wider">Active</span>;
        }
        return <span className="px-2 py-0.5 text-[9px] font-black bg-slate-800 text-slate-500 border border-slate-700 rounded-md uppercase tracking-wider">Empty</span>;
    };

    const sidebarContent = (
        <div className="flex flex-col h-full w-full">
            <div className="flex-1 overflow-y-auto p-5 space-y-8">
                {/* PLAN STATUS CARD */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">Forge Status</h3>
                        <div className="flex gap-2">
                            {profile?.isAdmin && <span className="px-2 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md uppercase tracking-wider">Admin</span>}
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider border ${ (isPro || profile?.isAdmin) ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                {profile?.isAdmin ? 'Admin Forge' : (isPro ? 'Pro Active' : 'Free Tier')}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center border border-white/10 shrink-0">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-white font-black text-xs truncate">{profile?.email || "AI Architect"}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                    {profile?.isAdmin ? 'Unlimited Master Access' : (isPro ? (profile?.daysLeft !== null ? `${profile.daysLeft} days remaining` : 'Lifetime Access') : 'Limited Production')}
                                </p>
                            </div>
                        </div>

                        {!isPro && !profile?.isAdmin && (
                            <button onClick={onUpgradeClick} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                                Upgrade to Pro (₹49)
                            </button>
                        )}
                    </div>
                </div>

                {/* DAILY USAGE FORGE */}
                <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">Daily Forge Limits</h3>
                    <div className="space-y-5">
                        {[
                            { label: "Direct TTS", count: profile?.dailyDirectTtsCount, limit: profile?.proLimits?.directTts, icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
                            { label: "AI Scripting", count: profile?.dailyAiScriptCount, limit: profile?.proLimits?.aiScript, icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                            { label: "Broadcasts", count: profile?.dailyBroadcastCount, limit: profile?.proLimits?.broadcast, icon: "M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41" },
                        ].map((stat, i) => {
                            const percent = Math.min(100, ((stat.count || 0) / (stat.limit || 1)) * 100);
                            return (
                                <div key={i} className="space-y-2">
                                     <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={stat.icon} /></svg>
                                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">{stat.label}</span>
                                        </div>
                                        <span className="text-[10px] text-indigo-400 font-black tracking-widest">
                                            {profile?.isAdmin ? '∞' : `${stat.count || 0}/${stat.limit || '∞'}`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden border border-white/[0.03]">
                                        <div 
                                            className={`h-full transition-all duration-1000 ease-out ${profile?.isAdmin ? 'bg-indigo-500' : (percent > 90 ? 'bg-rose-500' : 'bg-indigo-500')}`}
                                            style={{ width: `${profile?.isAdmin ? 100 : percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* GEMINI SECTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">Gemini AI Engine</h3>
                        {getStatusBadge(savedKeyStatus)}
                    </div>
                    {isPro || profile?.isAdmin ? (
                        <div className="space-y-4">
                            <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-tight">Personal Key Access <span className="text-white">Active</span>. Limits removed.</p>
                            <div className="relative">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={customKey}
                                    onChange={(e) => setCustomKey(e.target.value)}
                                    placeholder="Gemini API Key..."
                                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-indigo-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all pr-12 font-mono"
                                />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                    {showKey ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                </button>
                            </div>
                            <button onClick={handleSave} disabled={savingKey} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                                {savingKey ? "Validating..." : "Update Engine Key"}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5">
                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest text-center">Upgrade to Pro to connect your own <span className="text-white">Gemini API Key</span> and remove all daily limits.</p>
                        </div>
                    )}
                </div>
            </div>

            
            <div className="p-5 border-t border-white/5 bg-black/20">
                <div className="flex gap-2 text-emerald-400/70 text-[9px] font-black uppercase tracking-widest">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    AES-256 SECURED FORGE
                </div>
            </div>
        </div>
    );

    return sidebarContent;
}
