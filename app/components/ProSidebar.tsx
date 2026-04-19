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

    const [driveEnabled, setDriveEnabled] = useState(profile?.driveEnabled ?? true);
    const [driveToggles, setDriveToggles] = useState(profile?.driveToggles ?? { audio: true, broadcast: true, image: true, music: true });
    const [driveFolderId, setDriveFolderId] = useState(profile?.driveFolderId ?? "");
    const [updatingDrive, setUpdatingDrive] = useState(false);

    // Sync with profile when it loads
    React.useEffect(() => {
        if (profile) {
            setDriveEnabled(profile.driveEnabled ?? true);
            setDriveToggles(profile.driveToggles ?? { audio: true, broadcast: true, image: true, music: true });
            setDriveFolderId(profile.driveFolderId ?? "");
        }
    }, [profile]);

    const handleUpdateDriveSettings = async (newEnabled: boolean, newToggles: any, newFolderId?: string) => {
        setUpdatingDrive(true);
        try {
            const res = await fetch("/api/user/save-drive-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    driveEnabled: newEnabled, 
                    driveToggles: newToggles,
                    driveFolderId: newFolderId ?? driveFolderId
                }),
            });
            if (!res.ok) throw new Error("Failed to update settings");
            toast.success("Drive preferences updated!", "Success");
        } catch (err: any) {
            toast.error(err.message, "Update Failed");
        } finally {
            setUpdatingDrive(false);
        }
    };

    const toggleGlobal = (val: boolean) => {
        setDriveEnabled(val);
        handleUpdateDriveSettings(val, driveToggles);
    };

    const toggleType = (type: string, val: boolean) => {
        const next = { ...driveToggles, [type]: val };
        setDriveToggles(next);
        handleUpdateDriveSettings(driveEnabled, next);
    };

    const handleFolderSave = () => {
        handleUpdateDriveSettings(driveEnabled, driveToggles, driveFolderId);
    };

    const sidebarContent = (
        <div className="flex flex-col h-full w-full bg-slate-950 border-r border-white/5">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-8 min-h-0">
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
                        <div className="space-y-5">
                            <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/[0.08] space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Engine Activation Guide
                                    </p>
                                    <p className="text-[9px] text-slate-400 leading-relaxed font-bold uppercase tracking-tight">
                                        Remove all daily generation limits in 3 simple steps:
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">1</div>
                                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">
                                            Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-white hover:text-indigo-400 underline underline-offset-2 transition-colors">Google AI Studio</a>.
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">2</div>
                                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">
                                            Click <span className="text-white bg-white/5 px-1.5 py-0.5 rounded">Create API Key</span> button.
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">3</div>
                                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">
                                            Copy the key and <span className="text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">Paste it below</span>.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="relative">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={customKey}
                                    onChange={(e) => setCustomKey(e.target.value)}
                                    placeholder="Paste Gemini API Key here..."
                                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-indigo-500/50 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all pr-12 font-mono"
                                />
                                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                    {showKey ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                </button>
                            </div>
                            <button onClick={handleSave} disabled={savingKey} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                                {savingKey ? "Validating..." : "Activate Engine Key"}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5">
                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest text-center">Upgrade to Pro to connect your own <span className="text-white">Gemini API Key</span> and remove all daily limits.</p>
                        </div>
                    )}
                </div>

                {/* GOOGLE DRIVE SECTION */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">Google Drive Forge</h3>
                        {getStatusBadge(profile?.hasOwnDriveKey ? "active" : "none")}
                    </div>
                    {isPro || profile?.isAdmin ? (
                        <div className="space-y-6">
                            {/* NEW OAUTH2 BUTTON */}
                            <div className="space-y-3">
                                {profile?.driveEmail ? (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4 group">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0">
                                            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L8.5 14.5c.55.55 1.45.55 2 0l2-2v1.5c0 1.1.9 2 2 2h2v3.93c-.67.33-1.41.57-2.21.67zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-2.31 2.31c-.13.13-.3.19-.48.19h-1.5c-.83 0-1.5-.67-1.5-1.5V6.5c0-.18.06-.35.19-.48l2.31-2.31C13.73 2.8 12.39 2.25 11 2.07V5c0 .55-.45 1-1 1H8c-1.1 0-2 .9-2 2v1l3.5 3.5c.13.13.19.3.19.48V15c0 .55.45 1 1 1h3c1.1 0 2-.9 2-2v-3h1.5c.55 0 1-.45 1-1v-2l2.24-2.24c.48.97.76 2.06.76 3.24 0 .34-.03.67-.07 1z"/></svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Drive Forge</p>
                                            <p className="text-[11px] text-white font-bold truncate opacity-80">{profile.driveEmail}</p>
                                        </div>
                                        <button 
                                            onClick={() => window.location.href = "/api/auth/google/drive"}
                                            className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all"
                                            title="Change Account"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => window.location.href = "/api/auth/google/drive"}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3 group border border-indigo-400/30"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        Connect Personal Drive
                                    </button>
                                )}
                                {!profile?.driveEmail && <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-center">Recommended for Personal Accounts</p>}
                            </div>

                            <div className="h-px bg-white/5 w-full" />
                            <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                <div>
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Global Sync</p>
                                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">Enable auto-backup for all generations</p>
                                </div>
                                <button 
                                    onClick={() => toggleGlobal(!driveEnabled)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${driveEnabled ? 'bg-indigo-500' : 'bg-slate-800 border border-white/5'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${driveEnabled ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>

                            {driveEnabled && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'audio', label: 'Audio' },
                                            { id: 'broadcast', label: 'Broadcast' },
                                            { id: 'image', label: 'Visuals' },
                                            { id: 'music', label: 'Music' }
                                        ].map((t) => (
                                            <button 
                                                key={t.id}
                                                onClick={() => toggleType(t.id, !driveToggles?.[t.id])}
                                                className={`p-3 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center justify-between transition-all ${driveToggles?.[t.id] ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-white/[0.01] border-white/[0.05] text-slate-600'}`}
                                            >
                                                {t.label}
                                                <div className={`w-1.5 h-1.5 rounded-full ${driveToggles?.[t.id] ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'bg-slate-800'}`} />
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-4 bg-white/[0.03] p-5 rounded-2xl border border-white/[0.08]">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                Smart Backup Setup
                                            </p>
                                            <p className="text-[9px] text-slate-400 leading-relaxed font-bold uppercase tracking-tight">
                                                To bypass Google's storage limits, follow these 2 simple steps:
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">1</div>
                                                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">
                                                    Create a folder named <span className="text-white bg-white/5 px-1.5 py-0.5 rounded">GenBox Backups</span> in your Drive.
                                                </p>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">2</div>
                                                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight leading-relaxed">
                                                    Share it with the email from your JSON as <span className="text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">Editor</span>.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/5">
                                            <p className="text-[8px] text-indigo-400/60 font-black uppercase tracking-widest mb-2">Advanced: Manual Folder ID</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={driveFolderId}
                                                    onChange={(e) => setDriveFolderId(e.target.value)}
                                                    placeholder="Detecting automatically..."
                                                    className="flex-1 bg-black/40 border border-white/10 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none transition-all font-mono"
                                                />
                                                <button 
                                                    onClick={handleFolderSave}
                                                    className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-tight">Upload <span className="text-white">Service Account JSON</span> to activate.</p>
                            
                            <label className="block w-full border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-indigo-500/[0.02] group">
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    className="hidden" 
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        
                                        const reader = new FileReader();
                                        reader.onload = async (event) => {
                                            const content = event.target?.result as string;
                                            setSavingKey(true);
                                            try {
                                                const res = await fetch("/api/user/save-drive-config", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ jsonKey: content }),
                                                });
                                                const data = await res.json();
                                                if (!res.ok) throw new Error(data.error || "Failed to save Drive config");
                                                toast.success("Google Drive backup enabled!", "Forge Connected");
                                            } catch (err: any) {
                                                toast.error(err.message, "Drive Setup Failed");
                                            } finally {
                                                setSavingKey(false);
                                            }
                                        };
                                        reader.readAsText(file);
                                    }}
                                />
                                <svg className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 mx-auto mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                                <span className="text-[9px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest transition-colors">
                                    {savingKey ? "Processing..." : "Drop JSON File Here"}
                                </span>
                            </label>
                            
                            {profile?.hasOwnDriveKey && (
                                <p className="text-[9px] text-emerald-400/60 font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-1.5-6l-3-3 1.06-1.06 1.94 1.94 4.44-4.44 1.06 1.06-5.5 5.5z" /></svg>
                                    Drive Cloud Sync Active
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5">
                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest text-center">Upgrade to Pro to enable <span className="text-white">Auto-Backup to Google Drive</span>.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-5 border-t border-white/5 bg-black/40 backdrop-blur-md shrink-0">
                <div className="flex gap-2 text-emerald-400/70 text-[9px] font-black uppercase tracking-widest">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    AES-256 SECURED FORGE
                </div>
            </div>
        </div>
    );

    return sidebarContent;
}
