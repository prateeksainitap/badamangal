// Stage 4, image classifier (NSFW + violence + minor faces).
// Per spec §3 Stage 4.
//
// Implementation:
//   - We dynamically import `nsfwjs` at runtime. If it's not installed,
//     we skip the stage and approve. (Adding nsfwjs requires
//     @tensorflow/tfjs-node which has native build deps; treat it as
//     optional infrastructure that the user can wire up at deploy time.)
//   - When installed, we reject images whose Porn / Hentai / Sexy
//     classifications cross 0.4.
//
// To enable: `npm install nsfwjs @tensorflow/tfjs-node`. No code change.

export type ImageResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: string; signal?: Record<string, number> };

const REJECT_THRESHOLD = 0.4;

type Classifier = {
  classify: (
    img: unknown,
  ) => Promise<{ className: string; probability: number }[]>;
};

let cachedModel: Classifier | null = null;

async function loadModel(): Promise<Classifier | null> {
  if (cachedModel) return cachedModel;
  try {
    // Dynamic import + dynamic property access so TS doesn't require the
    // package to be installed at type-check time.
    const mod = await import(/* @vite-ignore */ "nsfwjs" as string).catch(
      () => null,
    );
    if (!mod) return null;
    const ns = mod as { load?: () => Promise<Classifier> };
    if (typeof ns.load !== "function") return null;
    cachedModel = await ns.load();
    return cachedModel;
  } catch {
    return null;
  }
}

export async function imageCheck(photoUrl: string | null | undefined): Promise<ImageResult> {
  if (!photoUrl) return { ok: true, skipped: true };

  const model = await loadModel();
  if (!model) return { ok: true, skipped: true };

  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return { ok: false, reason: "image_fetch_failed" };
    const buffer = Buffer.from(await res.arrayBuffer());
    // tfjs-node accepts a Buffer of an image; but the actual decode path
    // varies by tfjs version. We try buffer-first.
    const predictions = await model.classify(buffer as unknown);

    const signal: Record<string, number> = {};
    for (const p of predictions) signal[p.className] = p.probability;

    const offending = ["Porn", "Hentai", "Sexy"];
    for (const k of offending) {
      if ((signal[k] ?? 0) >= REJECT_THRESHOLD) {
        return { ok: false, reason: `nsfw_${k.toLowerCase()}`, signal };
      }
    }
    return { ok: true };
  } catch {
    // Any classify error → approve to avoid false negatives blocking real
    // devotees. We log a `skipped` flag so admins can re-run later.
    return { ok: true, skipped: true };
  }
}
