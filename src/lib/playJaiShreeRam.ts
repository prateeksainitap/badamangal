/**
 * Play the "Jai Shree Ram" chant once. Used on submission-success screens
 * (list-bhandara + spot) as a small celebratory blessing.
 *
 * Autoplay note: this fires moments after the user clicks Submit, so it
 * sits inside the user-gesture window in every modern browser. If the
 * promise still rejects (e.g. user has muted the tab), we swallow the
 * error silently — the visual confirmation is enough on its own.
 */
export function playJaiShreeRam(): void {
  if (typeof window === "undefined") return;
  try {
    const a = new Audio("/audio/jai-shree-ram.mp3");
    a.volume = 0.85;
    void a.play().catch(() => {
      /* autoplay blocked or asset missing — ignore */
    });
  } catch {
    /* Audio constructor unavailable — ignore */
  }
}
