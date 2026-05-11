"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "info" | "error";

type ToastShape = {
  id: number;
  text: string;
  tone: ToastTone;
};

type Ctx = {
  show: (text: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<Ctx | null>(null);

/**
 * Site-wide toast. Mount once in the root layout; trigger from anywhere
 * with `useToast().show("Link copied")`. Each toast auto-dismisses after
 * 2.4s and renders a tiny pill at the bottom of the viewport.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastShape | null>(null);

  const show = useCallback((text: string, tone: ToastTone = "success") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  // Auto-dismiss the active toast after 2.4s. Cleared if a new toast
  // arrives before the timer fires.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Bridge for non-React surfaces (e.g. raw-HTML Leaflet popups). They can
  // dispatch a `bm:toast` CustomEvent and we'll show it.
  useEffect(() => {
    const onEvt = (ev: Event) => {
      const ce = ev as CustomEvent<{ text?: string; tone?: ToastTone }>;
      if (!ce.detail?.text) return;
      show(ce.detail.text, ce.detail.tone);
    };
    window.addEventListener("bm:toast", onEvt as EventListener);
    return () => window.removeEventListener("bm:toast", onEvt as EventListener);
  }, [show]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed inset-x-0 z-[2200] flex justify-center px-4 pointer-events-none"
        // Bottom is computed in inline style so we can stack above the
        // floating Spot CTA + iOS home-indicator.
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
      >
        {toast ? (
          <div
            key={toast.id}
            role="status"
            className={[
              "pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-warm backdrop-blur",
              "motion-safe:animate-[bm-toast-in_180ms_cubic-bezier(0.22,1,0.36,1)]",
              toast.tone === "error"
                ? "bg-alert-500/10 border-alert-500/55 text-alert-500"
                : toast.tone === "info"
                  ? "bg-cream-50/95 border-gold-500/55 text-ink-900"
                  : "bg-leaf-600 border-leaf-600 text-cream-50",
            ].join(" ")}
          >
            {toast.tone === "success" ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
            {toast.text}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback no-op so components don't crash if rendered outside the
    // provider (e.g. in unit tests).
    return { show: () => {} };
  }
  return ctx;
}
