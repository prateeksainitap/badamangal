"use client";

import { useEffect, useRef, useState } from "react";

type Locale = "hi" | "en";

type Props = {
  /** null when the bhandara has no map pin (lat=0/lng=0) — the
   *  Directions slot is hidden entirely in that case. */
  directionsHref: string | null;
  whatsappHref: string;
  sponsorHref: string | null; // null when no upiId, fall back to phone tel:
  organizerPhone: string;
  locale: Locale;
  /** Optional: when supplied, tapping Sponsor first POSTs to
   *  /api/donations/intent (audit row with bhandaraId + amount +
   *  recipient + ipHash + UA), THEN opens the UPI deep-link returned
   *  by the server. The server rebuilds the deep-link canonically so
   *  the audit row's `tn` field carries the intent id for later
   *  reconciliation against organiser confirmation or a Razorpay
   *  webhook. When omitted, the button keeps its original behaviour:
   *  a plain href to `sponsorHref` (or a tel: fallback). */
  bhandaraId?: string;
  /** UPI VPA the donation goes to — only used when bhandaraId is set,
   *  so the audit row records the actual recipient at click time
   *  (organiser.upiId may be edited later). */
  recipientUpiId?: string;
  /** Human-readable recipient name for the audit row (organiser
   *  display name). */
  recipientName?: string;
};

const LABELS: Record<Locale, { dir: string; wa: string; sponsor: string; sponsorComing: string }> = {
  hi: { dir: "रास्ता", wa: "व्हाट्सऐप", sponsor: "सहयोग", sponsorComing: "जल्द ही" },
  en: { dir: "Directions", wa: "WhatsApp", sponsor: "Sponsor", sponsorComing: "Coming soon" },
};

/**
 * Mobile-only sticky bottom action bar with three equal CTAs:
 * Directions / WhatsApp / Sponsor.
 *
 * Hidden until the user scrolls past ~280px so the hero CTAs aren't doubled.
 */
export default function MobileStickyActions({
  directionsHref,
  whatsappHref,
  sponsorHref,
  organizerPhone,
  locale,
  bhandaraId,
  recipientUpiId,
  recipientName,
}: Props) {
  const [show, setShow] = useState(false);
  const labels = LABELS[locale];
  const sponsorHostRef = useRef<HTMLAnchorElement>(null);

  // Audit-trail beacon for the Sponsor tap. When bhandaraId +
  // recipientUpiId are wired, we POST a DonationIntent row to
  // /api/donations/intent BEFORE opening the UPI app, then redirect
  // window.location to the canonical deep-link the server returns.
  // The server rebuild ensures the audit row's `tn` field carries
  // the intent id, so a future Razorpay webhook or organiser-side
  // reconciliation can correlate. If the API call fails (offline,
  // 429, server down), we fall back to the original static
  // sponsorHref so the donor's flow is never blocked by our
  // telemetry layer.
  const beaconAndOpen = (e: React.MouseEvent<HTMLAnchorElement>) => {
    burst();
    // Without the intent-tracking props this is a plain link click —
    // let the browser handle it.
    if (!bhandaraId || !recipientUpiId || !sponsorHref) return;
    // Prevent the default <a> navigation so we can fire the beacon
    // first and then drive the redirect ourselves with the server-
    // canonical deep-link.
    e.preventDefault();
    void (async () => {
      const fallback = sponsorHref;
      try {
        const res = await fetch("/api/donations/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // keepalive lets the request survive the page unload we're
          // about to trigger via window.location. Without this, mobile
          // browsers cancel the fetch as soon as the UPI deep-link
          // opens, losing the audit row.
          keepalive: true,
          body: JSON.stringify({
            // amount: 0 = "no suggested amount". The server omits
            // `am` from the canonical deep link it returns, so the
            // donor's UPI app opens with an empty amount field
            // they can fill in themselves. We dropped the
            // auto-suggested ₹251 because organisers felt it was
            // steering donors toward a fixed number.
            bhandaraId,
            amount: 0,
            recipientType: "organiser",
            recipientUpiId,
            recipientName: recipientName ?? null,
          }),
        });
        if (!res.ok) {
          window.location.href = fallback;
          return;
        }
        const data = (await res.json().catch(() => null)) as {
          upiDeepLink?: string;
        } | null;
        window.location.href = data?.upiDeepLink ?? fallback;
      } catch {
        // Network / CORS error — UX trumps telemetry. Always open
        // the deep-link so the donor isn't stranded.
        window.location.href = fallback;
      }
    })();
  };

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // If no UPI, sponsor button falls back to a tel: link to the organizer.
  const sponsorLink = sponsorHref ?? `tel:${organizerPhone.replace(/\s+/g, "")}`;
  const sponsorTitle = sponsorHref ? labels.sponsor : `${labels.sponsor} · ${labels.sponsorComing}`;

  /** Spawn a small marigold burst above the sponsor button on tap. */
  const burst = () => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (m.matches) return;
    const host = sponsorHostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const petal = document.createElement("span");
      petal.className = "marigold";
      const dx = (Math.random() - 0.5) * 70;
      const rot = (Math.random() - 0.5) * 60;
      petal.style.left = `${cx - 7}px`;
      petal.style.top = `${cy - 7}px`;
      petal.style.setProperty("--mx", `${dx}px`);
      petal.style.setProperty("--mr", `${rot}deg`);
      petal.style.animationDelay = `${i * 40}ms`;
      host.appendChild(petal);
      window.setTimeout(() => petal.remove(), 1400);
    }
  };

  return (
    <div
      className={[
        "sm:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-200",
        show ? "translate-y-0" : "translate-y-full",
      ].join(" ")}
      aria-hidden={!show}
    >
      <div className="mx-3 mb-3 rounded-2xl border border-gold-500/40 bg-cream-50/95 backdrop-blur shadow-warm">
        <div
          className={`grid divide-x divide-gold-500/30 ${
            directionsHref ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {directionsHref ? (
            <a
              href={directionsHref}
              target="_blank"
              rel="noreferrer noopener"
              data-ga="sticky_directions"
              className="flex flex-col items-center gap-0.5 py-3 text-saffron-600 hover:text-sindoor-700"
              aria-label={labels.dir}
            >
              <IconCompass />
              <span className="text-xs font-medium">{labels.dir}</span>
            </a>
          ) : null}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer noopener"
            data-ga="sticky_whatsapp"
            className="flex flex-col items-center gap-0.5 py-3 text-leaf-600 hover:text-leaf-600/80"
            aria-label={labels.wa}
          >
            <IconChat />
            <span className="text-xs font-medium">{labels.wa}</span>
          </a>
          <a
            ref={sponsorHostRef}
            href={sponsorLink}
            onClick={beaconAndOpen}
            data-ga="sticky_sponsor"
            data-ga-has-upi={sponsorHref ? "1" : "0"}
            className="marigold-host flex flex-col items-center gap-0.5 py-3 text-sindoor-700 hover:text-sindoor-700/80 min-h-[44px]"
            aria-label={sponsorTitle}
            title={sponsorTitle}
          >
            <IconDiya />
            <span className="text-xs font-medium">{labels.sponsor}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function IconCompass() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polygon points="14.5,9.5 11,13 9.5,14.5 13,11" fill="currentColor" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
    </svg>
  );
}
function IconDiya() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4 c1.6 1.5 2.5 3.2 0 5.5 c-2.5 -2.3 -1.6 -4 0 -5.5 z" fill="currentColor" />
      <path d="M4 14 q8 5 16 0 l-2 4 h-12 z" />
    </svg>
  );
}
