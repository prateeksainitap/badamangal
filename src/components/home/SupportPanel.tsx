"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { T } from "@/components/T";
import { trackEvent } from "@/lib/ga";

// Same platform UPI and amount-free intent as SupportBadaMangal.tsx.
const PLATFORM_UPI = process.env.NEXT_PUBLIC_PLATFORM_UPI ?? "badamangal@ybl";
const UPI_URL = `upi://pay?${new URLSearchParams({
  pa: PLATFORM_UPI,
  pn: "BadaMangal",
  cu: "INR",
  tn: "Support BadaMangal.com",
}).toString()}`;

/**
 * The third seva path, "Support BadaMangal". Same behaviour as the
 * classic SupportBadaMangal band: a fixed, amount-free UPI QR, the UPI
 * ID with copy, and on phones a button that opens the UPI app. The
 * intent beacon (/api/donations/intent) is sent only when the visitor
 * acts, exactly as before.
 */
export default function SupportPanel() {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const recorded = useRef(false);

  useEffect(() => {
    if (!open || qr) return;
    let cancel = false;
    QRCode.toDataURL(UPI_URL, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 368,
      color: { dark: "#9C2A2A", light: "#FFFFFF" },
    })
      .then((u) => !cancel && setQr(u))
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [open, qr]);

  const intent = () => {
    if (recorded.current) return;
    recorded.current = true;
    try {
      fetch("/api/donations/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientType: "platform",
          recipientUpiId: PLATFORM_UPI,
          recipientName: "BadaMangal",
          amount: 0,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        className="tlink"
        aria-expanded={open}
        aria-controls="bmh-support-panel"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) trackEvent("home_support_open");
        }}
      >
        {open ? <T en="Hide the UPI details" hi="UPI विवरण छिपाएँ" /> : <T en="Support the seva" hi="सेवा में सहयोग करें" />}
        <svg viewBox="0 0 24 24" className="ic" aria-hidden style={{ transform: open ? "rotate(90deg)" : undefined }}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      <div className="support-panel" id="bmh-support-panel" hidden={!open}>
        <div className="qr">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="UPI QR code for BadaMangal" width={184} height={184} />
          ) : (
            <span style={{ display: "block", width: 184, height: 184 }} />
          )}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="upi">
            <code>{PLATFORM_UPI}</code>
            <button
              type="button"
              className="b b-s"
              onClick={() => {
                intent();
                navigator.clipboard
                  ?.writeText(PLATFORM_UPI)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  })
                  .catch(() => {});
              }}
            >
              {copied ? <T en="Copied" hi="कॉपी हुआ" /> : <T en="Copy UPI ID" hi="UPI ID कॉपी करें" />}
            </button>
          </div>
          <a
            className="b b-p upi-open"
            href={UPI_URL}
            onClick={intent}
          >
            <T en="Open my UPI app" hi="UPI ऐप खोलें" />
          </a>
          <p className="fine">
            <T
              en="Scan or tap, then enter any amount. It goes straight to the maintainer's UPI to keep the map running. Voluntary, not tax deductible."
              hi="स्कैन करें या टैप करें, फिर कोई भी राशि डालें। यह सीधे रखरखाव करने वाले के UPI में जाती है ताकि नक़्शा चलता रहे। स्वैच्छिक, कर छूट योग्य नहीं।"
            />
          </p>
        </div>
      </div>
    </>
  );
}
