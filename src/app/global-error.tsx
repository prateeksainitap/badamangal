"use client";

/**
 * Top-level error boundary for unhandled runtime errors. Next.js wraps
 * the entire app in this, when something throws past every nested
 * `error.tsx`, we render a calm cream-and-saffron page so the visitor
 * doesn't see a raw Next.js error overlay or a blank screen.
 *
 * This is intentionally tiny and self-contained (no dependency on our
 * brand components, CSS or web fonts), since whatever broke might also
 * break a deeper-imported component. Everything is inline: the site's
 * colours, a heavy system sans, the painted diya from /public, one
 * saffron retry button and a quiet way home, both 48px tall.
 */
const C = {
  cream: "#FBF7F0",
  ink: "#1A1410",
  ink2: "#5A4F46",
  sindoor: "#9C2A2A",
  saffronInk: "#A3520B",
  gold: "#C9A24A",
  btn: "#E8862F",
  btnInk: "#2A1205",
};

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', sans-serif";

const pill = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 24px",
  borderRadius: 9999,
  fontWeight: 700,
  fontSize: 16,
  fontFamily: FONT,
  textDecoration: "none",
  cursor: "pointer",
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: FONT,
          background: C.cream,
          color: C.ink,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
          boxSizing: "border-box",
        }}
      >
        <main style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/error-diya.webp"
            alt=""
            width={200}
            height={200}
            style={{ display: "block", width: 200, height: 200, margin: "0 auto 8px" }}
          />
          <p
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontSize: 13,
              color: C.saffronInk,
              fontWeight: 700,
              margin: 0,
            }}
          >
            Pause for a breath
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(30px, 7vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: C.sindoor,
              lineHeight: 1.12,
            }}
          >
            Something stopped working.
          </h1>
          <p style={{ margin: "14px 0 0", color: C.ink2, fontSize: 17, lineHeight: 1.55 }}>
            We hit an unexpected error and the page couldn&apos;t finish loading.
            The team has been notified, please try again.
          </p>
          <div
            style={{
              marginTop: 28,
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{ ...pill, background: C.btn, color: C.btnInk, border: "none" }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ ...pill, background: C.cream, color: C.ink, border: "none", boxShadow: `inset 0 0 0 1px ${C.gold}` }}
            >
              Back home
            </a>
          </div>
          {error?.digest ? (
            <p style={{ margin: "22px 0 0", fontSize: 13, color: C.ink2, opacity: 0.75, overflowWrap: "anywhere" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
