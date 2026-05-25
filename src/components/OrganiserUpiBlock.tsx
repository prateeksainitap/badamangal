"use client";

import { useState } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";

type Props = {
  /** Bhandara row id — for the DonationIntent beacon. */
  bhandaraId: string;
  /** Bhandara display name — appears in the UPI deep-link `tn` field
   *  so the organiser can correlate the bank receipt. */
  bhandaraName: string;
  /** Recipient VPA (e.g. `9235374707@barodampay`). Required — the
   *  block self-hides when this is missing. */
  upiId: string;
  /** Organiser name on file. Surfaced as `pn` in the deep-link
   *  (what the donor sees as the payee in their UPI app). */
  organizerName: string;
  /** Public URL to the bank-issued QR PNG (Supabase Storage / R2). */
  upiQrUrl: string;
};

/**
 * OrganiserUpiBlock — donate panel on a bhandara detail page.
 *
 * Renders only when the organiser has provided BOTH a UPI ID and an
 * uploaded QR image. We deliberately prefer the bank-issued QR (with
 * its embedded merchant signature, bank logo, BBPS marker etc.) over
 * a runtime-generated one from `upi://pay?…` because:
 *
 *   • UPI-app built-in scanners (GPay / PhonePe / Paytm cameras)
 *     verify bank-issued QRs more strictly. Our generated one would
 *     work for phone-camera scans but get rejected by some UPI
 *     scanners — the organiser's screenshot doesn't have that
 *     compatibility gap.
 *   • The bank-issued QR carries the organiser's name + masked
 *     account on its face, which adds a layer of donor trust we
 *     can't fake in a runtime QR.
 *
 * Tap behaviour mirrors `MobileStickyActions.beaconAndOpen`:
 * fire-and-forget POST to `/api/donations/intent` with `keepalive`
 * before navigating to the `upi://pay?…` deep link, so we get the
 * audit row regardless of whether the user comes back. The QR image
 * is the desktop / "scan with another phone" path; the button is the
 * "I'm already on my phone" path.
 */
export default function OrganiserUpiBlock({
  bhandaraId,
  bhandaraName,
  upiId,
  organizerName,
  upiQrUrl,
}: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [copied, setCopied] = useState(false);

  // Don't render unless both fields are present. The parent already
  // guards on this, but defending here lets us drop the block into
  // any future bhandara surface without an extra check.
  if (!upiId || !upiQrUrl) return null;

  // No suggested amount: we OMIT `am` from the deep link entirely so
  // the donor's UPI app opens with an empty amount field they can fill
  // in with whatever feels right. Earlier we prefilled ₹251 but
  // organisers felt it was steering donors toward a specific number;
  // the QR is now a "pay any amount" code, identical in spirit to a
  // donation box.
  const upiDeepLink = (() => {
    const params = new URLSearchParams({
      pa: upiId,
      pn: organizerName,
      cu: "INR",
      tn: `Bada Mangal seva for ${bhandaraName}`.slice(0, 60),
    });
    return `upi://pay?${params.toString()}`;
  })();

  async function beaconAndOpen() {
    try {
      // `keepalive` lets the POST survive the immediate page nav. If
      // the API fails we still issue the redirect; the donor's flow
      // is never blocked by our telemetry. Mirrors the posture in
      // MobileStickyActions + /d/[id] route.
      //
      // `amount: 0` is our sentinel for "no suggested amount" — the
      // intent endpoint accepts it and omits `am` from the canonical
      // deep link it returns. Audit rows show ₹0 in /admin/donations
      // which the operator reads as "donor decided their own amount".
      await fetch("/api/donations/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          bhandaraId,
          amount: 0,
          recipientType: "organiser",
          recipientUpiId: upiId,
          recipientName: organizerName,
        }),
      }).catch(() => {});
    } finally {
      window.location.href = upiDeepLink;
    }
  }

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers without clipboard API — fall back silently.
    }
  }

  const t = (en: string, hi: string) => (isHi ? hi : en);

  return (
    <section
      id="donate"
      className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 scroll-mt-24"
    >
      <div className="relative overflow-hidden rounded-3xl border border-saffron-500/45 bg-cream-50 shadow-[0_18px_60px_-30px_rgba(156,42,42,0.35)]">
        {/* Soft saffron wash so the block reads as the page's "warm"
            CTA section without competing with the photo above it. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(700px 400px at 95% 5%, rgba(242,148,76,0.14), transparent 65%), radial-gradient(700px 400px at 5% 95%, rgba(214,73,73,0.08), transparent 65%)",
          }}
        />

        <div className="relative grid gap-8 p-6 sm:p-8 md:grid-cols-[auto,1fr] md:items-center">
          {/* QR — the bank-issued image the organiser uploaded. */}
          <div className="mx-auto w-full max-w-[260px] md:w-[240px]">
            <div className="rounded-2xl bg-white p-3 border border-gold-500/40 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upiQrUrl}
                alt={t(
                  `UPI QR for ${organizerName}`,
                  `${organizerName} का UPI QR`,
                )}
                width={240}
                height={240}
                loading="lazy"
                className="block w-full h-auto"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="mt-3 text-center text-[11px] uppercase tracking-[0.16em] text-ink-600/70 font-mono">
              {t("Scan with any UPI app", "किसी भी UPI ऐप से स्कैन करें")}
            </p>
          </div>

          {/* Copy block — payee, suggested amount, and the two
              actions (tap-to-pay deep-link, copy VPA). */}
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sindoor-700/85 font-mono">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-saffron-500" />
              {t("Donate to this bhandara", "इस भंडारे में दान करें")}
            </div>
            <h2 className="mt-2 font-fraunces text-2xl sm:text-[28px] text-sindoor-700 leading-tight">
              {t(
                "Sponsor a thali, scan or tap.",
                "एक थाली प्रायोजित करें — स्कैन या टैप करें।",
              )}
            </h2>
            <p className="mt-2 text-sm text-ink-600 leading-relaxed">
              {t(
                `Payments go directly to ${organizerName}'s UPI account. We don't take a cut — this is a community ledger, not a checkout.`,
                `दान सीधे ${organizerName} के UPI खाते में जाते हैं। हम कोई शुल्क नहीं लेते — यह एक सामुदायिक खाता है।`,
              )}
            </p>

            {/* VPA + copy. The mono font + the dotted-underline copy
                hint reads as "this is technical, you can tap it". */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-ink-900 bg-saffron-50 border border-saffron-500/40 rounded-full px-3 py-1">
                {upiId}
              </span>
              <button
                type="button"
                onClick={copyUpiId}
                className="text-xs font-semibold text-sindoor-700 hover:text-sindoor-900 underline decoration-dotted underline-offset-4"
              >
                {copied
                  ? t("Copied ✓", "कॉपी हो गया ✓")
                  : t("Copy UPI ID", "UPI ID कॉपी करें")}
              </button>
            </div>

            {/* Primary tap-to-pay. Uses beaconAndOpen so every tap
                lands a DonationIntent row before the UPI app opens.
                Button copy stays amount-free — once the UPI app
                takes over, the donor types whatever feels right. */}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={beaconAndOpen}
                className="inline-flex items-center gap-2 rounded-full bg-sindoor-700 hover:bg-sindoor-900 text-cream-50 font-semibold px-5 py-2.5 text-sm transition-colors shadow-[0_8px_20px_-10px_rgba(156,42,42,0.6)]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 12a9 9 0 1 1-3.51-7.12" />
                  <path d="m13 3 4 4-4 4" />
                </svg>
                {t("Donate via UPI", "UPI से दान करें")}
              </button>
              <span className="text-[11px] text-ink-600/70 self-center font-mono uppercase tracking-[0.14em]">
                {t("enter any amount", "कोई भी राशि")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
