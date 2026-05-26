"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * Sponsor / Donate to a Bhandara, full-featured donate card that
 * lives on every bhandara detail page.
 *
 * Two recipient modes:
 *   1. "Direct to organiser", UPI deep-link goes to the bhandara's
 *      own `upiId` (Bhandara.upiId). Only enabled when that field is
 *      set. The money never touches Bada Mangal.
 *   2. "Through Bada Mangal", UPI deep-link goes to the platform's
 *      VPA (NEXT_PUBLIC_PLATFORM_UPI env var). Useful when the
 *      organiser hasn't shared a VPA, or when the donor wants the
 *      platform to forward + send a thank-you receipt.
 *
 * On submit we open the UPI deep-link (which routes the donor's
 * device to GPay / PhonePe / Paytm). On desktop the deep-link
 * won't resolve, so we ALSO render a QR code the donor can scan
 * from their phone.
 *
 * Intentionally no DB writes in v1, donations are entirely
 * device-to-device UPI. We keep a localStorage record so the
 * donor can see their own contribution history, but the platform
 * doesn't try to "track" the donation amount (we can't anyway
 * UPI confirmation is bank-side). A future v2 can wire in a
 * Razorpay collect link for receipts, but that opens up
 * GST / FCRA / 80G complications that v1 deliberately sidesteps.
 */

export type SponsorBhandaraProps = {
  bhandaraId: string;
  bhandaraName: string;
  organizerName: string;
  organizerUpi: string | null;
  isHi?: boolean;
};

// Quick amount presets, auspicious sums in the Lucknow context.
const AMOUNT_PRESETS = [101, 251, 501, 1100, 2100, 5100];

// Platform VPA, falls back to a placeholder if env not configured.
// Set NEXT_PUBLIC_PLATFORM_UPI in .env.local to enable "Through
// Bada Mangal" mode.
const PLATFORM_UPI =
  process.env.NEXT_PUBLIC_PLATFORM_UPI ?? "prateeeksaini@oksbi";
const PLATFORM_NAME = "Bada Mangal";

export default function SponsorBhandara({
  bhandaraId,
  bhandaraName,
  organizerName,
  organizerUpi,
  isHi = false,
}: SponsorBhandaraProps) {
  const [amount, setAmount] = useState<number>(501);
  const [customAmount, setCustomAmount] = useState("");
  const [recipient, setRecipient] = useState<"organiser" | "platform">(
    organizerUpi ? "organiser" : "platform",
  );
  const [donorName, setDonorName] = useState("");
  const [donorMessage, setDonorMessage] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const previousContributions = useRecentContributions();

  // Derive the effective amount, custom input wins if it's a valid
  // number, otherwise fall back to the selected preset.
  const effectiveAmount = useMemo(() => {
    const custom = Number(customAmount);
    if (Number.isFinite(custom) && custom > 0) return custom;
    return amount;
  }, [amount, customAmount]);

  const targetVpa =
    recipient === "organiser" && organizerUpi
      ? organizerUpi
      : PLATFORM_UPI;
  const targetName =
    recipient === "organiser" ? organizerName : PLATFORM_NAME;

  // Build the UPI deep-link. The transaction note is short enough
  // that GPay won't truncate it and meaningful enough that the
  // recipient sees what it was for.
  const upiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("pa", targetVpa);
    params.set("pn", targetName);
    params.set("am", String(effectiveAmount));
    params.set("cu", "INR");
    params.set(
      "tn",
      `BadaMangal · ${bhandaraName.slice(0, 30)}`,
    );
    return `upi://pay?${params.toString()}`;
  }, [targetVpa, targetName, effectiveAmount, bhandaraName]);

  // Regenerate the QR code on every parameter change. `qrcode`
  // returns a data-URL we can drop into an <img>.
  useEffect(() => {
    let canceled = false;
    QRCode.toDataURL(upiUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: {
        // Brand-aligned: warm saffron on cream (matches the rest
        // of the public-site palette, not the cyan admin palette).
        dark: "#9C2A2A",
        light: "#FBF7F0",
      },
    })
      .then((url) => {
        if (!canceled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!canceled) setQrDataUrl(null);
      });
    return () => {
      canceled = true;
    };
  }, [upiUrl]);

  function handleSponsor(e: React.FormEvent) {
    e.preventDefault();
    // Record the intent locally so the donor sees their own
    // contribution history without us needing a server table.
    recordContribution({
      bhandaraId,
      bhandaraName,
      amount: effectiveAmount,
      recipient,
      donorName: donorName.trim() || null,
      donorMessage: donorMessage.trim() || null,
      at: new Date().toISOString(),
    });
    setSubmitted(true);
    // Best-effort UPI app open. On mobile this launches the UPI
    // intent picker; on desktop the OS shows an "open with…" error
    // dialog, which is fine because we also render the QR.
    window.location.href = upiUrl;
  }

  const t = (en: string, hi: string) => (isHi ? hi : en);

  return (
    <section
      id="sponsor"
      className="mx-auto max-w-5xl px-4 sm:px-6 mt-10"
      aria-labelledby="sponsor-heading"
    >
      <div className="rounded-3xl border border-gold-500/40 bg-cream-50 overflow-hidden">
        <header className="px-6 pt-5 sm:px-8 sm:pt-7 flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-saffron-500/10 text-sindoor-700">
            <IconHeartHand />
          </div>
          <h2
            id="sponsor-heading"
            className="font-fraunces text-xl sm:text-2xl text-sindoor-700 font-semibold"
          >
            {t("Sponsor this bhandara", "इस भंडारे को सहायता दें")}
          </h2>
        </header>
        <p className="px-6 sm:px-8 mt-2 text-sm text-ink-600 max-w-2xl">
          {t(
            "Contribute directly to the organiser, or through BadaMangal. Money moves device-to-device via UPI, we never hold your contribution.",
            "सीधे आयोजक को सहायता दें, या BadaMangal के माध्यम से। पैसा UPI से सीधे जाता है, हम कोई शुल्क नहीं लेते।",
          )}
        </p>

        {previousContributions.length > 0 ? (
          <div className="mx-6 sm:mx-8 mt-3 rounded-xl border border-gold-500/30 bg-saffron-50/60 px-3 py-2 text-xs text-ink-700">
            🌿{" "}
            {t(
              `You've contributed to ${previousContributions.length} bhandara${
                previousContributions.length === 1 ? "" : "s"
              } this season. Dhanyavaad.`,
              `आपने इस सीज़न में ${previousContributions.length} भंडारों में सहायता की है। धन्यवाद।`,
            )}
          </div>
        ) : null}

        {submitted ? (
          <ThankYouState
            amount={effectiveAmount}
            organizerName={organizerName}
            recipient={recipient}
            isHi={isHi}
            onReset={() => {
              setSubmitted(false);
              setCustomAmount("");
              setDonorMessage("");
            }}
          />
        ) : (
          <form
            onSubmit={handleSponsor}
            className="px-6 sm:px-8 pb-6 sm:pb-8 mt-5 grid lg:grid-cols-[1fr_auto] gap-6"
          >
            <div className="space-y-5">
              {/* Recipient toggle */}
              <fieldset>
                <legend className="text-[11px] uppercase tracking-[0.18em] text-ink-600 font-semibold mb-2">
                  {t("Send to", "किसे भेजें")}
                </legend>
                <div className="inline-flex rounded-full bg-white border border-gold-500/40 p-1">
                  <RecipientPill
                    active={recipient === "organiser"}
                    disabled={!organizerUpi}
                    onClick={() => setRecipient("organiser")}
                  >
                    {t("Organiser direct", "आयोजक को सीधे")}
                  </RecipientPill>
                  <RecipientPill
                    active={recipient === "platform"}
                    onClick={() => setRecipient("platform")}
                  >
                    {t("Through Bada Mangal", "Bada Mangal के माध्यम से")}
                  </RecipientPill>
                </div>
                {!organizerUpi ? (
                  <p className="mt-2 text-[11px] text-ink-600 italic">
                    {t(
                      "Organiser hasn't shared a UPI ID yet. Send through Bada Mangal and we'll forward it.",
                      "आयोजक ने UPI साझा नहीं किया। Bada Mangal के माध्यम से भेजें, हम आगे पहुँचा देंगे।",
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-ink-600">
                    {t("Recipient: ", "प्राप्तकर्ता: ")}
                    <span className="font-mono">{targetVpa}</span>
                  </p>
                )}
              </fieldset>

              {/* Amount presets */}
              <fieldset>
                <legend className="text-[11px] uppercase tracking-[0.18em] text-ink-600 font-semibold mb-2">
                  {t("Amount", "राशि")}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {AMOUNT_PRESETS.map((p) => {
                    const isSelected = amount === p && !customAmount;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setAmount(p);
                          setCustomAmount("");
                        }}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-saffron-600 text-cream-50 shadow-warm"
                            : "border border-gold-500/40 text-ink-700 hover:border-saffron-500/55 hover:bg-saffron-500/[0.06]"
                        }`}
                      >
                        ₹{p.toLocaleString("en-IN")}
                      </button>
                    );
                  })}
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 px-3 py-1.5 bg-white">
                    <span className="text-sm text-ink-600">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder={t("Custom", "अन्य")}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-20 bg-transparent text-sm text-ink-900 placeholder:text-ink-600/55 focus:outline-none"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Optional name + message */}
              <fieldset className="grid sm:grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-ink-600 font-semibold">
                    {t("Your name (optional)", "आपका नाम (वैकल्पिक)")}
                  </span>
                  <input
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    maxLength={60}
                    placeholder={t("e.g. Prateek", "उदा. प्रतीक")}
                    className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-ink-600 font-semibold">
                    {t("Note (optional)", "संदेश (वैकल्पिक)")}
                  </span>
                  <input
                    value={donorMessage}
                    onChange={(e) => setDonorMessage(e.target.value)}
                    maxLength={80}
                    placeholder={t("Best wishes / kuch shabd", "शुभकामनाएँ")}
                    className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                  />
                </label>
              </fieldset>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-5 py-2.5 text-sm shadow-warm transition-colors"
              >
                <IconUpiOpen />
                {t(
                  `Sponsor ₹${effectiveAmount.toLocaleString("en-IN")} via UPI`,
                  `₹${effectiveAmount.toLocaleString("en-IN")} सहायता करें (UPI)`,
                )}
              </button>
              <p className="text-[11px] text-ink-600">
                {t(
                  "Opens your UPI app (GPay, PhonePe, Paytm). On desktop, scan the QR with your phone.",
                  "आपका UPI ऐप खुलेगा (GPay, PhonePe, Paytm)। डेस्कटॉप पर QR स्कैन करें।",
                )}
              </p>
            </div>

            {/* QR fallback for desktop */}
            <aside className="lg:w-56 flex flex-col items-center gap-2">
              <div className="rounded-2xl border border-gold-500/30 bg-white p-3 shadow-sm">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={t("UPI QR code", "UPI QR कोड")}
                    width="220"
                    height="220"
                    className="block"
                  />
                ) : (
                  <div className="w-[220px] h-[220px] grid place-items-center text-xs text-ink-600">
                    {t("Generating QR…", "QR बन रहा है…")}
                  </div>
                )}
              </div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-600 font-semibold">
                {t("Scan with any UPI app", "किसी भी UPI ऐप से स्कैन करें")}
              </p>
              <p className="text-[10px] text-ink-600 font-mono break-all text-center">
                {targetVpa}
              </p>
            </aside>
          </form>
        )}

        {/* Trust footer */}
        <footer className="px-6 sm:px-8 py-3 border-t border-gold-500/20 bg-saffron-50/40 text-[11px] text-ink-600 leading-relaxed">
          {t(
            "Bada Mangal does not hold your contribution. Money is transferred peer-to-peer via UPI. We don't collect a fee.",
            "Bada Mangal आपके पैसे को नहीं रखता। राशि UPI से सीधे जाती है। हम कोई शुल्क नहीं लेते।",
          )}
        </footer>
      </div>
    </section>
  );
}

/* ────────── Sub-components ────────── */

function RecipientPill({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
        active
          ? "bg-saffron-600 text-cream-50 shadow-warm"
          : disabled
            ? "text-ink-600/40 cursor-not-allowed"
            : "text-ink-600 hover:text-sindoor-700 hover:bg-saffron-500/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

function ThankYouState({
  amount,
  organizerName,
  recipient,
  isHi,
  onReset,
}: {
  amount: number;
  organizerName: string;
  recipient: "organiser" | "platform";
  isHi: boolean;
  onReset: () => void;
}) {
  const t = (en: string, hi: string) => (isHi ? hi : en);
  return (
    <div className="px-6 sm:px-8 py-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-leaf-600/10 text-leaf-600 mb-3">
        <IconHeartHand />
      </div>
      <h3 className="font-fraunces text-xl text-sindoor-700">
        {t(`Dhanyavaad`, `धन्यवाद`)}
      </h3>
      <p className="mt-2 text-sm text-ink-700">
        {recipient === "organiser"
          ? t(
              `Your ₹${amount.toLocaleString("en-IN")} contribution is on its way to ${organizerName}.`,
              `आपकी ₹${amount.toLocaleString("en-IN")} की राशि ${organizerName} को पहुँच रही है।`,
            )
          : t(
              `Your ₹${amount.toLocaleString("en-IN")} contribution will be forwarded by Bada Mangal to ${organizerName} this week.`,
              `आपकी ₹${amount.toLocaleString("en-IN")} की राशि Bada Mangal इस हफ़्ते ${organizerName} तक पहुँचा देगा।`,
            )}
      </p>
      <p className="mt-2 text-xs text-ink-600">
        {t(
          "If your UPI app didn't open, scan the QR code above or copy the UPI ID.",
          "अगर UPI ऐप नहीं खुला, ऊपर QR स्कैन करें।",
        )}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 hover:border-saffron-500/55 px-4 py-1.5 text-sm text-ink-700 hover:text-sindoor-700 transition-colors"
      >
        {t("Sponsor again", "और सहायता करें")}
      </button>
    </div>
  );
}

/* ────────── localStorage helpers ────────── */

type Contribution = {
  bhandaraId: string;
  bhandaraName: string;
  amount: number;
  recipient: "organiser" | "platform";
  donorName: string | null;
  donorMessage: string | null;
  at: string;
};

const STORAGE_KEY = "badamangal:contributions";

function recordContribution(c: Contribution) {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as Contribution[];
    existing.unshift(c);
    // Cap at 50, that's a season's worth.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(existing.slice(0, 50)),
    );
  } catch {
    // localStorage might be unavailable (private browsing); fail
    // silently. The UPI deep-link is still fired.
  }
}

function useRecentContributions() {
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? "[]";
      const parsed = JSON.parse(raw) as Contribution[];
      if (mounted.current) setContribs(parsed);
    } catch {
      /* ignore */
    }
    return () => {
      mounted.current = false;
    };
  }, []);
  return contribs;
}

/* ────────── Icons ────────── */

function IconHeartHand() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21 c-4 -2 -8 -5 -8 -10 a4 4 0 0 1 8 -2 a4 4 0 0 1 8 2 c0 5 -4 8 -8 10 z" />
    </svg>
  );
}

function IconUpiOpen() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4 h6 v6" />
      <path d="M10 14 L20 4" />
      <path d="M19 13 v6 a1.5 1.5 0 0 1 -1.5 1.5 H5 a1.5 1.5 0 0 1 -1.5 -1.5 V6.5 A1.5 1.5 0 0 1 5 5 h6" />
    </svg>
  );
}
