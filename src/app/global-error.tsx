"use client";

/**
 * Top-level error boundary for unhandled runtime errors. Next.js wraps
 * the entire app in this — when something throws past every nested
 * `error.tsx`, we render a calm cream-and-saffron page so the visitor
 * doesn't see a raw Next.js error overlay or a blank screen.
 *
 * This is intentionally tiny and self-contained (no dependency on our
 * brand components), since whatever broke might also break a
 * deeper-imported component.
 */
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
          fontFamily:
            "ui-serif, Georgia, 'Iowan Old Style', 'Apple Garamond', serif",
          background: "#FBF7F0",
          color: "#1A1410",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <p
            style={{
              fontFamily:
                "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.32em",
              fontSize: "0.7rem",
              color: "#E07A1F",
              fontWeight: 600,
              margin: 0,
            }}
          >
            🪔 Pause for a breath
          </p>
          <h1
            style={{
              marginTop: "0.75rem",
              fontSize: "2rem",
              fontWeight: 600,
              color: "#9C2A2A",
              lineHeight: 1.2,
            }}
          >
            Something stopped working.
          </h1>
          <p style={{ marginTop: "1rem", color: "#5A4F46", lineHeight: 1.6 }}>
            We hit an unexpected error and the page couldn&apos;t finish loading.
            The team has been notified, please try again.
          </p>
          {error?.digest ? (
            <p
              style={{
                marginTop: "1rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.7rem",
                color: "#5A4F46",
                opacity: 0.6,
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#E07A1F",
                color: "#FBF7F0",
                border: "none",
                borderRadius: 9999,
                padding: "0.7rem 1.4rem",
                fontWeight: 600,
                fontSize: "0.95rem",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                background: "transparent",
                color: "#9C2A2A",
                border: "1.5px solid #C9A24A",
                borderRadius: 9999,
                padding: "0.6rem 1.3rem",
                fontWeight: 600,
                fontSize: "0.95rem",
                textDecoration: "none",
                fontFamily: "inherit",
              }}
            >
              ← Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
