"use client";

import { useEffect, useRef, useState } from "react";

export type ToastType = "overloaded" | "error" | "success" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number; // ms, default 6000
  retryAfter?: number; // seconds, shown for overloaded
}

// ─── Singleton event bus ───────────────────────────────────────────────────
type Listener = (toast: Toast) => void;
const listeners: Set<Listener> = new Set();

export function showToast(toast: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach((fn) => fn({ id, ...toast }));
}

/** Convenience wrappers */
export const toast = {
  overloaded: (retryAfter = 30) =>
    showToast({
      type: "overloaded",
      title: "Gemini is overloaded",
      message:
        "We automatically retried 3 times. The AI service is under high load right now. Please wait and try again.",
      retryAfter,
      duration: 10000,
    }),
  error: (message: string, title = "Something went wrong") =>
    showToast({ type: "error", title, message, duration: 7000 }),
  success: (message: string, title = "Done!") =>
    showToast({ type: "success", title, message, duration: 4000 }),
  warning: (message: string, title = "Heads up") =>
    showToast({ type: "warning", title, message, duration: 6000 }),
  info: (message: string, title = "Info") =>
    showToast({ type: "info", title, message, duration: 5000 }),
};

// ─── Icons ─────────────────────────────────────────────────────────────────
const ICONS: Record<ToastType, React.ReactNode> = {
  overloaded: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
};

const STYLES: Record<ToastType, { bg: string; border: string; icon: string; bar: string; title: string }> = {
  overloaded: {
    bg: "bg-amber-950/90",
    border: "border-amber-500/40",
    icon: "text-amber-400 bg-amber-500/20",
    bar: "bg-amber-500",
    title: "text-amber-100",
  },
  error: {
    bg: "bg-red-950/90",
    border: "border-red-500/40",
    icon: "text-red-400 bg-red-500/20",
    bar: "bg-red-500",
    title: "text-red-100",
  },
  success: {
    bg: "bg-emerald-950/90",
    border: "border-emerald-500/40",
    icon: "text-emerald-400 bg-emerald-500/20",
    bar: "bg-emerald-500",
    title: "text-emerald-100",
  },
  warning: {
    bg: "bg-yellow-950/90",
    border: "border-yellow-500/40",
    icon: "text-yellow-400 bg-yellow-500/20",
    bar: "bg-yellow-500",
    title: "text-yellow-100",
  },
  info: {
    bg: "bg-indigo-950/90",
    border: "border-indigo-500/40",
    icon: "text-indigo-400 bg-indigo-500/20",
    bar: "bg-indigo-500",
    title: "text-indigo-100",
  },
};

// ─── Single toast card ──────────────────────────────────────────────────────
function ToastCard({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const [countdown, setCountdown] = useState(t.retryAfter ?? 0);
  const duration = t.duration ?? 6000;
  const s = STYLES[t.type];

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(t.id), 300);
  };

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, []);

  // Countdown for overloaded
  useEffect(() => {
    if (!t.retryAfter) return;
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [t.retryAfter]);

  return (
    <div
      className={`${exiting ? "toast-exit" : "toast-enter"} ${s.bg} ${s.border} border backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden`}
    >
      <div className="px-4 py-4 flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${s.icon}`}>
          {ICONS[t.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${s.title}`}>{t.title}</p>
          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">{t.message}</p>

          {/* Overloaded: countdown badge */}
          {t.type === "overloaded" && countdown > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                </span>
                <span className="text-amber-300 text-xs font-semibold">
                  Retry in {countdown}s
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-800/60">
        <div
          className={`h-full ${s.bar} opacity-60`}
          style={{ animation: `shrink ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

// ─── Toast Container (mounts once in layout) ──────────────────────────────
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const fn: Listener = (t) => setToasts((prev) => [t, ...prev].slice(0, 5));
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-sm">
          <ToastCard toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
