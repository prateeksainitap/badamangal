"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useLocaleFromContext } from "@/lib/locale-context";
import { JaliCorner, OmWatermark } from "@/components/ornaments";

/**
 * "Help keep BadaMangal running", the homepage support / donate band.
 *
 * Funds the PLATFORM's running costs. UPI is device-to-device, no DB
 * write, no fee. The QR + deep-link are intentionally AMOUNT-FREE: a
 * `upi://pay?...&am=` QR hard-locks the amount in some apps (PhonePe)
 * so the donor can't change it. By omitting `am=`, the donor scans (or
 * taps) and freely enters whatever they want to give. One fixed QR,
 * generated once, not regenerated per amount.
 */

const PLATFORM_UPI =
  process.env.NEXT_PUBLIC_PLATFORM_UPI ?? "badamangal@ybl";
const PLATFORM_NAME = "BadaMangal";

// Amount-free UPI intent: opens the app on the recipient, donor types
// the amount. Constant, so the QR is fixed for every visitor.
const UPI_URL = `upi://pay?${new URLSearchParams({
  pa: PLATFORM_UPI,
  pn: PLATFORM_NAME,
  cu: "INR",
  tn: "Support BadaMangal.com",
}).toString()}`;

// Suggested amounts, shown as emphasis pills (non-interactive, the QR +
// deep-link stay amount-free so the donor types whatever they want).
const SUGGESTED_AMOUNTS = [101, 251, 501, 1001];

export default function SupportBadaMangal() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = (en: string, hi: string) => (isHi ? hi : en);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate the fixed QR once.
  useEffect(() => {
    let canceled = false;
    QRCode.toDataURL(UPI_URL, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#9C2A2A", light: "#FBF7F0" },
    })
      .then((url) => !canceled && setQrDataUrl(url))
      .catch(() => !canceled && setQrDataUrl(null));
    return () => {
      canceled = true;
    };
  }, []);

  // Fire-and-forget audit beacon, recorded once per visit. Lets /admin/
  // donations show platform-support intent. Never blocks the user;
  // keepalive lets it survive the UPI deep-link navigation. We can't see
  // the actual payment (device-to-device UPI), so this is intent only.
  const recordedRef = useRef(false);
  function recordIntent() {
    if (recordedRef.current) return;
    recordedRef.current = true;
    try {
      fetch("/api/donations/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientType: "platform",
          recipientUpiId: PLATFORM_UPI,
          recipientName: PLATFORM_NAME,
          amount: 0,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  function handleDonate() {
    recordIntent();
    setSubmitted(true);
    window.location.href = UPI_URL;
  }

  function handleCopy() {
    recordIntent();
    navigator.clipboard
      ?.writeText(PLATFORM_UPI)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  }

  const COVERS = [
    { icon: <IconServer />, label: t("Servers", "सर्वर") },
    { icon: <IconMap />, label: t("Maps", "नक्शे") },
    { icon: <IconDatabase />, label: t("Database", "डेटाबेस") },
    { icon: <IconShieldHeart />, label: t("Upkeep", "देखभाल") },
  ];

  return (
    <section
      id="support"
      aria-labelledby="support-heading"
      className="relative overflow-hidden my-14 sm:my-20"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(100% 65% at 50% 0%, rgba(252,224,193,0.4) 0%, rgba(251,247,240,0) 72%)",
        }}
      />
      <OmWatermark
        size={520}
        opacity={0.045}
        className="absolute left-1/2 top-8 -translate-x-1/2 -z-10 text-sindoor-700 hidden sm:block"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative rounded-[2rem] border border-gold-500/25 bg-cream-50/60 backdrop-blur-sm shadow-warm overflow-hidden">
          <JaliCorner position="tl" size={66} className="absolute top-0 left-0 text-gold-500/45 pointer-events-none" />
          <JaliCorner position="tr" size={66} className="absolute top-0 right-0 text-gold-500/45 pointer-events-none" />
          <JaliCorner position="bl" size={66} className="absolute bottom-0 left-0 text-gold-500/40 pointer-events-none" />
          <JaliCorner position="br" size={66} className="absolute bottom-0 right-0 text-gold-500/40 pointer-events-none" />

          {/* ── Hero ── */}
          <div className="px-6 sm:px-12 pt-10 sm:pt-12 text-center">
            <div className="relative inline-flex items-center justify-center">
              <span aria-hidden className="absolute h-24 w-24 rounded-full bg-saffron-500/25 blur-2xl" />
              <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-saffron-50 to-gold-100 border border-gold-500/50 shadow-warm">
                <Heart className="w-10 h-10 text-sindoor-700" />
              </span>
            </div>

            <p className="mt-5 font-mukta uppercase tracking-[0.34em] text-[0.7rem] text-saffron-600 font-semibold">
              {t("Support, not a fee", "सहयोग, शुल्क नहीं")}
            </p>
            <h2
              id="support-heading"
              className="mt-2 font-fraunces text-3xl sm:text-[2.65rem] leading-[1.08] text-sindoor-700 font-bold"
            >
              {t("Help keep BadaMangal running", "BadaMangal को चलाए रखें")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[0.95rem] sm:text-base text-ink-900/75 leading-relaxed">
              {t(
                "Free for all of Lucknow. Running it costs real money every month, your support keeps it going.",
                "पूरे लखनऊ के लिए मुफ़्त। इसे चलाने में हर महीने असली ख़र्च आता है, आपका योगदान इसे चालू रखता है।",
              )}
            </p>

            <ul className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 max-w-md">
              {COVERS.map((c) => (
                <li key={c.label} className="inline-flex items-center gap-2 text-[0.82rem] text-ink-600">
                  <span className="text-saffron-600 shrink-0">{c.icon}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="px-6 sm:px-12 pt-8 pb-2 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
            {/* QR, ALWAYS visible (fixed + amount-free). Mobile: on top. */}
            <aside className="order-1 shrink-0 flex flex-col items-center gap-2.5">
              <div className="relative rounded-3xl border border-gold-500/40 bg-white p-3.5 shadow-warm">
                <JaliCorner position="tl" size={22} className="absolute top-1 left-1 text-saffron-500/55" />
                <JaliCorner position="br" size={22} className="absolute bottom-1 right-1 text-saffron-500/55" />
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={t("UPI QR code for BadaMangal", "BadaMangal का UPI QR कोड")}
                    width="208"
                    height="208"
                    className="block rounded-lg"
                  />
                ) : (
                  <div className="w-[208px] h-[208px] grid place-items-center text-xs text-ink-600">
                    {t("Generating QR…", "QR बन रहा है…")}
                  </div>
                )}
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-saffron-600 font-bold">
                {t("Donate by QR", "QR से दान करें")}
              </p>
              <p className="text-[11px] text-ink-600 text-center max-w-[13rem] leading-snug">
                {t(
                  "Scan it (or screenshot and upload in your UPI app) and enter any amount you like.",
                  "स्कैन करें (या स्क्रीनशॉट लेकर अपने UPI ऐप में अपलोड करें) और जो राशि चाहें वह डालें।",
                )}
              </p>
            </aside>

            {/* Actions. The QR (left) and the UPI ID (bottom) stay visible at
                all times; only the middle swaps to a thank-you note after the
                donor taps Donate, so the scan / copy fallbacks never vanish. */}
            <div className="order-2 w-full lg:w-auto lg:max-w-md flex flex-col items-center lg:items-start gap-4 text-center lg:text-left">
              {submitted ? (
                <div className="w-full flex flex-col items-center lg:items-start gap-1.5">
                  <h3 className="font-fraunces text-2xl text-sindoor-700 font-bold">
                    {t("Dhanyavaad 🙏", "धन्यवाद 🙏")}
                  </h3>
                  <p className="text-sm text-ink-900/75 leading-relaxed max-w-md">
                    {t(
                      "Your contribution keeps the map and servers running for all of Lucknow. If your UPI app didn't open, scan the QR or copy the UPI ID below.",
                      "आपका योगदान पूरे लखनऊ के लिए नक्शा और सर्वर चालू रखता है। अगर UPI ऐप नहीं खुला, QR स्कैन करें या नीचे UPI ID कॉपी करें।",
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-1 text-sm font-semibold text-saffron-600 hover:underline"
                  >
                    {t("Make another contribution", "फिर से योगदान करें")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-full flex flex-col items-center lg:items-start gap-2.5">
                    <p className="text-[0.95rem] text-ink-900/80">
                      {t("You can start with", "आप शुरुआत कर सकते हैं")}
                    </p>
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                      {SUGGESTED_AMOUNTS.map((a) => (
                        <span
                          key={a}
                          className="rounded-full border border-gold-500/50 bg-white/80 px-4 py-1.5 font-numerals text-base font-bold text-sindoor-700 shadow-sm"
                        >
                          ₹{a.toLocaleString("en-IN")}
                        </span>
                      ))}
                      <span className="text-sm text-ink-600">
                        {t("or any amount", "या कोई भी राशि")}
                      </span>
                    </div>
                  </div>
                  {/* Deep-link button is mobile-only: a upi:// link can't
                      open an app on desktop, where the QR is the path. */}
                  <div className="relative inline-block w-full sm:w-auto lg:hidden">
                    <span aria-hidden className="absolute -inset-1 rounded-full bg-saffron-500/30 blur-lg" />
                    <button
                      type="button"
                      onClick={handleDonate}
                      className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-saffron-600 to-sindoor-700 text-cream-50 font-semibold px-7 py-3.5 text-[0.95rem] shadow-warm hover:brightness-110 transition-all duration-200"
                    >
                      <Heart className="w-[18px] h-[18px]" />
                      {t("Donate via UPI", "UPI से दान करें")}
                    </button>
                  </div>
                  {/* Mobile help (button path) */}
                  <p className="lg:hidden text-sm text-ink-600 leading-relaxed max-w-md">
                    {t(
                      "Opens your UPI app (GPay, PhonePe, Paytm), enter any amount you'd like to give. No app on this phone? Copy the UPI ID below.",
                      "आपका UPI ऐप खुलेगा (GPay, PhonePe, Paytm), जो राशि देना चाहें वह डालें। इस फ़ोन में ऐप नहीं? नीचे UPI ID कॉपी करें।",
                    )}
                  </p>
                  {/* Desktop help (QR path) */}
                  <p className="hidden lg:block text-sm text-ink-600 leading-relaxed max-w-md">
                    {t(
                      "Scan the QR with your phone's UPI app and enter any amount you'd like to give. Or copy the UPI ID below.",
                      "अपने फ़ोन के UPI ऐप से QR स्कैन करें और जो राशि देना चाहें वह डालें। या नीचे UPI ID कॉपी करें।",
                    )}
                  </p>
                </>
              )}

              {/* UPI ID + copy, ALWAYS visible (incl. the thank-you state). */}
              <div className="flex items-center gap-2.5 rounded-full border border-gold-500/45 bg-white/70 pl-4 pr-2 py-2 max-w-sm">
                <span className="text-[11px] uppercase tracking-[0.16em] text-ink-600 font-semibold shrink-0">
                  {t("UPI ID", "UPI ID")}
                </span>
                <code className="flex-1 font-mono text-base text-sindoor-700 truncate">
                  {PLATFORM_UPI}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    copied
                      ? "bg-leaf-600 text-cream-50"
                      : "bg-saffron-600 text-cream-50 hover:brightness-110"
                  }`}
                >
                  {copied ? t("Copied ✓", "कॉपी हुआ ✓") : t("Copy", "कॉपी")}
                </button>
              </div>
            </div>
          </div>

          <footer className="mt-7 px-6 sm:px-12 pb-5 pt-1 text-[11px] text-ink-600/90 leading-relaxed text-center max-w-2xl mx-auto">
            {t(
              "Your contribution goes directly to the maintainer's UPI to cover running costs. Money moves peer-to-peer, no platform fee, and these are voluntary contributions, not tax-deductible donations.",
              "आपका योगदान सीधे रखरखाव-कर्ता के UPI में जाता है ताकि ख़र्च पूरे हों। राशि सीधे जाती है, कोई शुल्क नहीं, और ये स्वैच्छिक योगदान हैं, कर-छूट योग्य दान नहीं।",
            )}
          </footer>
        </div>
      </div>
    </section>
  );
}


/* ────────── Icons ────────── */

function Heart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 20.7 C12 20.7 3.6 14.4 3.6 8.7 C3.6 5.9 5.8 4 8.2 4 C9.9 4 11.3 5 12 6.2 C12.7 5 14.1 4 15.8 4 C18.2 4 20.4 5.9 20.4 8.7 C20.4 14.4 12 20.7 12 20.7 Z" />
    </svg>
  );
}
function IconServer() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="6" rx="1.6" />
      <rect x="3" y="14" width="18" height="6" rx="1.6" />
      <path d="M7 7 h.01 M7 17 h.01" />
    </svg>
  );
}
function IconMap() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4 L3 6 v14 l6 -2 6 2 6 -2 V4 l-6 2 -6 -2 z" />
      <path d="M9 4 v14 M15 6 v14" />
    </svg>
  );
}
function IconDatabase() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5 v14 c0 1.7 3.6 3 8 3 s8 -1.3 8 -3 V5" />
      <path d="M4 12 c0 1.7 3.6 3 8 3 s8 -1.3 8 -3" />
    </svg>
  );
}
function IconShieldHeart() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 l7 3 v5 c0 4.5 -3 7.5 -7 9 c-4 -1.5 -7 -4.5 -7 -9 V6 z" />
      <path d="M12 10.5 c-1 -1.6 -3.4 -1.4 -3.4 0.6 c0 1.7 2 3 3.4 4 c1.4 -1 3.4 -2.3 3.4 -4 c0 -2 -2.4 -2.2 -3.4 -0.6 z" />
    </svg>
  );
}
