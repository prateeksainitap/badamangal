/**
 * Beautiful, on-brand isometric illustrations rendered at the top of
 * each admin page hero. Pure inline SVG — no images, no external
 * assets — so they're fast, themeable, and look crisp at every DPR.
 *
 * Each scene is built from layered isometric primitives (~30° tile
 * grid, 45° projection) tinted with the same cyan/violet/leaf/saffron
 * palette the rest of the AI/ops console uses. The whole illustration
 * sits at fixed dimensions but scales via `width: 100%` so the parent
 * panel controls the visible size.
 *
 * Shared geometric primitives:
 *   • IsoBase    — the diamond ground plate everything sits on
 *   • IsoCube    — 3-face stacked cube (top/left/right)
 *   • IsoGlow    — soft cyan halo behind a focal element
 *   • IsoPin     — gada-style map pin
 *   • IsoStar    — tiny accent star sprinkled in negative space
 *
 * Each `<AdminHero{Subject}>` composes those into one of:
 *   Dashboard / Bhandaras / Spots / Mentions / Organise / Volunteers
 *   / Discover / Gallery / Scan / Login
 */

type Tone = "cyan" | "violet" | "leaf" | "saffron" | "sindoor";

const TONE_HEX: Record<Tone, { hi: string; mid: string; lo: string }> = {
  cyan: { hi: "#a5f3fc", mid: "#22d3ee", lo: "#0e7490" },
  violet: { hi: "#ddd6fe", mid: "#a78bfa", lo: "#6d28d9" },
  leaf: { hi: "#bbf7d0", mid: "#5dae5d", lo: "#3f7d3f" },
  saffron: { hi: "#fed7aa", mid: "#f2944c", lo: "#9c4b1a" },
  sindoor: { hi: "#fecaca", mid: "#9C2A2A", lo: "#5b1717" },
};

type AdminHeroProps = {
  /** Subject of the hero — picks which composition renders. */
  subject:
    | "dashboard"
    | "bhandaras"
    | "spots"
    | "mentions"
    | "organise"
    | "volunteers"
    | "discover"
    | "gallery"
    | "scan"
    | "content"
    | "emails"
    | "login";
  /** Extra className passthrough for the outer wrapper. */
  className?: string;
};

export default function AdminHeroArt({
  subject,
  className = "",
}: AdminHeroProps) {
  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none relative w-full h-full select-none",
        className,
      ].join(" ")}
    >
      <svg
        viewBox="0 0 320 200"
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-full"
      >
        <Defs />
        {subject === "dashboard" ? <DashboardScene /> : null}
        {subject === "bhandaras" ? <BhandarasScene /> : null}
        {subject === "spots" ? <SpotsScene /> : null}
        {subject === "mentions" ? <MentionsScene /> : null}
        {subject === "organise" ? <OrganiseScene /> : null}
        {subject === "volunteers" ? <VolunteersScene /> : null}
        {subject === "discover" ? <DiscoverScene /> : null}
        {subject === "gallery" ? <GalleryScene /> : null}
        {subject === "scan" ? <ScanScene /> : null}
        {subject === "content" ? <ContentScene /> : null}
        {subject === "emails" ? <EmailsScene /> : null}
        {subject === "login" ? <LoginScene /> : null}
      </svg>
    </div>
  );
}

/* ────────────── Shared SVG defs (gradients, filters) ──────────── */

function Defs() {
  return (
    <defs>
      {(["cyan", "violet", "leaf", "saffron", "sindoor"] as Tone[]).map((t) => {
        const c = TONE_HEX[t];
        return (
          <linearGradient
            key={`grad-${t}`}
            id={`grad-${t}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor={c.hi} stopOpacity="0.9" />
            <stop offset="100%" stopColor={c.mid} stopOpacity="0.85" />
          </linearGradient>
        );
      })}
      <radialGradient id="halo-cyan" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="halo-violet" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="halo-saffron" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#f2944c" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#f2944c" stopOpacity="0" />
      </radialGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.6" />
      </filter>
    </defs>
  );
}

/* ────────────── Reusable iso primitives ───────────────────────── */

/** Diamond floor tile (the iso ground plate). */
function IsoBase({
  cx,
  cy,
  w = 240,
  h = 120,
  tone = "cyan",
}: {
  cx: number;
  cy: number;
  w?: number;
  h?: number;
  tone?: Tone;
}) {
  const c = TONE_HEX[tone];
  return (
    <g>
      <polygon
        points={`${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`}
        fill={c.lo}
        fillOpacity="0.18"
        stroke={c.mid}
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />
      <polygon
        points={`${cx},${cy - h / 2 + 18} ${cx + w / 2 - 36},${cy} ${cx},${cy + h / 2 - 18} ${cx - w / 2 + 36},${cy}`}
        fill={c.mid}
        fillOpacity="0.05"
        stroke={c.mid}
        strokeOpacity="0.25"
        strokeWidth="0.4"
      />
    </g>
  );
}

/** Isometric cube — top, left and right faces, stacked from (x, y). */
function IsoCube({
  x,
  y,
  size = 22,
  tone = "cyan",
  raise = 0,
}: {
  x: number;
  y: number;
  size?: number;
  tone?: Tone;
  raise?: number;
}) {
  const c = TONE_HEX[tone];
  const s = size;
  const yy = y - raise;
  // Top diamond
  const top = `${x},${yy - s / 2} ${x + s},${yy} ${x},${yy + s / 2} ${x - s},${yy}`;
  // Left side
  const left = `${x - s},${yy} ${x},${yy + s / 2} ${x},${yy + s / 2 + s} ${x - s},${yy + s}`;
  // Right side
  const right = `${x + s},${yy} ${x},${yy + s / 2} ${x},${yy + s / 2 + s} ${x + s},${yy + s}`;
  return (
    <g>
      <polygon points={left} fill={c.lo} opacity="0.75" />
      <polygon points={right} fill={c.mid} opacity="0.92" />
      <polygon
        points={top}
        fill={`url(#grad-${tone})`}
        stroke={c.hi}
        strokeOpacity="0.35"
        strokeWidth="0.4"
      />
    </g>
  );
}

/** Glowing halo disc behind a focal point. */
function IsoGlow({
  cx,
  cy,
  r = 48,
  tone = "cyan",
}: {
  cx: number;
  cy: number;
  r?: number;
  tone?: "cyan" | "violet" | "saffron";
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={`url(#halo-${tone})`}
      filter="url(#soft)"
    />
  );
}

/** Gada-style pin sitting on an iso plate. */
function IsoPin({
  cx,
  cy,
  tone = "saffron",
  size = 16,
}: {
  cx: number;
  cy: number;
  tone?: Tone;
  size?: number;
}) {
  const c = TONE_HEX[tone];
  return (
    <g>
      <ellipse cx={cx} cy={cy + 2} rx={size * 0.5} ry={size * 0.18} fill="#000" opacity="0.35" />
      <circle cx={cx} cy={cy - size * 0.7} r={size * 0.55} fill={c.mid} />
      <circle cx={cx - size * 0.18} cy={cy - size * 0.85} r={size * 0.18} fill={c.hi} opacity="0.95" />
      <rect x={cx - 1} y={cy - size * 0.2} width="2" height={size * 0.6} fill={c.lo} rx="1" />
    </g>
  );
}

/** Decorative twinkle / micro-star. */
function IsoStar({
  cx,
  cy,
  r = 1.4,
  tone = "cyan",
}: {
  cx: number;
  cy: number;
  r?: number;
  tone?: Tone;
}) {
  const c = TONE_HEX[tone];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={c.hi} />
      <line
        x1={cx - r * 2}
        y1={cy}
        x2={cx + r * 2}
        y2={cy}
        stroke={c.hi}
        strokeWidth="0.5"
        strokeOpacity="0.55"
      />
      <line
        x1={cx}
        y1={cy - r * 2}
        x2={cx}
        y2={cy + r * 2}
        stroke={c.hi}
        strokeWidth="0.5"
        strokeOpacity="0.55"
      />
    </g>
  );
}

/* ────────────── Scenes ────────────────────────────────────────── */

/** Dashboard — city radar. Iso base + a glowing centre + 3 floating
 *  data orbs + scattered pins around the plate. */
function DashboardScene() {
  return (
    <g>
      <IsoBase cx={160} cy={120} tone="cyan" />
      <IsoGlow cx={160} cy={108} r={54} tone="cyan" />
      {/* Centre stack */}
      <IsoCube x={160} y={102} size={20} tone="cyan" />
      <IsoCube x={160} y={80} size={16} tone="violet" raise={0} />
      {/* Outer pins */}
      <IsoPin cx={92} cy={132} tone="saffron" />
      <IsoPin cx={224} cy={134} tone="cyan" size={14} />
      <IsoPin cx={130} cy={154} tone="violet" size={14} />
      <IsoPin cx={196} cy={108} tone="leaf" size={12} />
      {/* Twinkles */}
      <IsoStar cx={62} cy={56} tone="cyan" />
      <IsoStar cx={264} cy={48} tone="violet" />
      <IsoStar cx={284} cy={90} r={1} tone="cyan" />
      <IsoStar cx={48} cy={108} r={1} tone="cyan" />
      <IsoStar cx={250} cy={156} r={1} tone="saffron" />
    </g>
  );
}

/** Bhandaras — temple silhouette with a flame on top + glowing pins. */
function BhandarasScene() {
  return (
    <g>
      <IsoBase cx={160} cy={134} tone="saffron" />
      {/* Temple body */}
      <g transform="translate(140, 60)">
        <IsoGlow cx={20} cy={50} r={50} tone="saffron" />
        {/* Steps */}
        <polygon
          points="0,84 40,84 60,72 -20,72"
          fill={TONE_HEX.saffron.lo}
          opacity="0.85"
        />
        <polygon
          points="-4,76 44,76 24,66 -24,66"
          fill={TONE_HEX.saffron.mid}
          opacity="0.9"
        />
        {/* Main hall */}
        <rect x="2" y="36" width="36" height="32" fill="url(#grad-saffron)" />
        <rect
          x="2"
          y="36"
          width="36"
          height="32"
          fill="none"
          stroke={TONE_HEX.saffron.hi}
          strokeOpacity="0.45"
        />
        {/* Door */}
        <rect x="16" y="48" width="8" height="20" fill={TONE_HEX.sindoor.lo} />
        {/* Shikhara */}
        <polygon
          points="2,36 38,36 30,12 10,12"
          fill={TONE_HEX.saffron.mid}
        />
        <polygon
          points="10,12 30,12 20,-2"
          fill={TONE_HEX.saffron.hi}
        />
        {/* Kalash dot */}
        <circle cx="20" cy="-5" r="2" fill={TONE_HEX.cyan.hi} />
        {/* Flame above */}
        <path
          d="M20 -10 Q15 -16 20 -22 Q25 -16 20 -10"
          fill={TONE_HEX.saffron.hi}
          opacity="0.95"
        />
      </g>
      <IsoPin cx={86} cy={150} tone="cyan" size={14} />
      <IsoPin cx={236} cy={148} tone="violet" size={14} />
      <IsoStar cx={70} cy={60} tone="cyan" />
      <IsoStar cx={260} cy={56} tone="violet" />
    </g>
  );
}

/** Spots — isometric camera + a stack of polaroid frames. */
function SpotsScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="cyan" />
      <IsoGlow cx={160} cy={92} r={50} tone="cyan" />
      {/* Polaroid stack — three offset frames */}
      <g transform="translate(118, 60)">
        <rect x="0" y="0" width="46" height="38" rx="2" fill={TONE_HEX.violet.lo} opacity="0.7" transform="rotate(-8 23 19)" />
        <rect x="4" y="4" width="46" height="38" rx="2" fill={TONE_HEX.cyan.lo} opacity="0.85" transform="rotate(3 27 23)" />
        <rect x="8" y="8" width="46" height="38" rx="2" fill="url(#grad-cyan)" />
        <rect x="12" y="12" width="38" height="22" rx="1" fill={TONE_HEX.cyan.hi} opacity="0.45" />
        <circle cx="20" cy="22" r="2" fill={TONE_HEX.saffron.hi} />
        <circle cx="42" cy="26" r="1.6" fill={TONE_HEX.violet.hi} />
      </g>
      {/* Camera */}
      <g transform="translate(186, 84)">
        <rect x="0" y="6" width="40" height="26" rx="3" fill={TONE_HEX.cyan.lo} />
        <rect x="6" y="2" width="14" height="8" rx="1.5" fill={TONE_HEX.cyan.mid} />
        <circle cx="20" cy="19" r="9" fill={TONE_HEX.violet.mid} stroke={TONE_HEX.cyan.hi} strokeWidth="0.8" />
        <circle cx="20" cy="19" r="5" fill={TONE_HEX.cyan.hi} opacity="0.85" />
        <circle cx="33" cy="11" r="1.6" fill={TONE_HEX.saffron.hi} />
      </g>
      <IsoStar cx={72} cy={62} tone="violet" />
      <IsoStar cx={258} cy={66} tone="cyan" />
      <IsoStar cx={290} cy={140} r={1} tone="cyan" />
    </g>
  );
}

/** Mentions — chat bubbles stacked iso with type-y dots. */
function MentionsScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="violet" />
      <IsoGlow cx={160} cy={90} r={52} tone="violet" />
      {/* Bubble 1 */}
      <g transform="translate(102, 66)">
        <rect x="0" y="0" width="60" height="34" rx="10" fill="url(#grad-violet)" />
        <polygon
          points="14,30 18,40 28,30"
          fill={TONE_HEX.violet.mid}
        />
        <circle cx="18" cy="17" r="2" fill={TONE_HEX.violet.hi} />
        <circle cx="30" cy="17" r="2" fill={TONE_HEX.violet.hi} />
        <circle cx="42" cy="17" r="2" fill={TONE_HEX.violet.hi} />
      </g>
      {/* Bubble 2 */}
      <g transform="translate(170, 92)">
        <rect x="0" y="0" width="68" height="32" rx="10" fill="url(#grad-cyan)" />
        <polygon
          points="48,28 60,40 56,28"
          fill={TONE_HEX.cyan.mid}
        />
        <rect x="10" y="12" width="40" height="3" rx="1.5" fill={TONE_HEX.cyan.hi} opacity="0.9" />
        <rect x="10" y="20" width="28" height="3" rx="1.5" fill={TONE_HEX.cyan.hi} opacity="0.7" />
      </g>
      <IsoStar cx={70} cy={64} tone="cyan" />
      <IsoStar cx={262} cy={48} tone="violet" />
      <IsoStar cx={50} cy={150} r={1} tone="violet" />
    </g>
  );
}

/** Organise — clipboard, checks, and a calendar on iso base. */
function OrganiseScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="cyan" />
      <IsoGlow cx={160} cy={92} r={48} tone="cyan" />
      {/* Clipboard */}
      <g transform="translate(118, 56)">
        <rect x="0" y="6" width="50" height="68" rx="4" fill={TONE_HEX.cyan.lo} />
        <rect x="2" y="8" width="46" height="64" rx="3" fill="url(#grad-cyan)" />
        <rect x="14" y="0" width="22" height="10" rx="2" fill={TONE_HEX.cyan.mid} />
        {/* Lines */}
        <rect x="8" y="20" width="34" height="3" rx="1.5" fill={TONE_HEX.cyan.hi} opacity="0.85" />
        <rect x="8" y="30" width="28" height="3" rx="1.5" fill={TONE_HEX.cyan.hi} opacity="0.7" />
        <rect x="8" y="40" width="32" height="3" rx="1.5" fill={TONE_HEX.cyan.hi} opacity="0.7" />
        {/* Check */}
        <g transform="translate(34, 56)">
          <circle cx="0" cy="0" r="6" fill={TONE_HEX.leaf.mid} />
          <polyline points="-3,0 -1,2 3,-2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      {/* Mini calendar floating */}
      <g transform="translate(192, 78)">
        <rect x="0" y="0" width="38" height="36" rx="3" fill={TONE_HEX.violet.lo} />
        <rect x="0" y="0" width="38" height="10" rx="3" fill={TONE_HEX.violet.mid} />
        <circle cx="10" cy="20" r="2" fill={TONE_HEX.violet.hi} />
        <circle cx="20" cy="20" r="2" fill={TONE_HEX.violet.hi} opacity="0.55" />
        <circle cx="30" cy="20" r="2" fill={TONE_HEX.violet.hi} opacity="0.55" />
        <circle cx="10" cy="28" r="2" fill={TONE_HEX.violet.hi} opacity="0.55" />
        <circle cx="20" cy="28" r="2" fill={TONE_HEX.saffron.hi} />
        <circle cx="30" cy="28" r="2" fill={TONE_HEX.violet.hi} opacity="0.55" />
      </g>
      <IsoStar cx={70} cy={60} tone="violet" />
      <IsoStar cx={260} cy={140} r={1} tone="cyan" />
    </g>
  );
}

/** Volunteers — three iso figures on a plate. */
function VolunteersScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="leaf" />
      <IsoGlow cx={160} cy={88} r={50} tone="cyan" />
      {/* Figure helper */}
      {(
        [
          { x: 124, y: 78, tone: "cyan" as Tone },
          { x: 160, y: 70, tone: "leaf" as Tone },
          { x: 196, y: 78, tone: "violet" as Tone },
        ]
      ).map((f, i) => (
        <g key={i} transform={`translate(${f.x}, ${f.y})`}>
          <ellipse cx="0" cy="46" rx="14" ry="3" fill="#000" opacity="0.3" />
          {/* Body */}
          <path
            d="M-8 16 Q-10 40 -6 44 L6 44 Q10 40 8 16 Z"
            fill={`url(#grad-${f.tone})`}
          />
          {/* Head */}
          <circle cx="0" cy="6" r="9" fill={TONE_HEX[f.tone].hi} />
          {/* Smile */}
          <path
            d="M-3 7 Q0 9 3 7"
            stroke={TONE_HEX[f.tone].lo}
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
          {/* Arms */}
          <line
            x1="-8"
            y1="20"
            x2="-13"
            y2="36"
            stroke={TONE_HEX[f.tone].mid}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="20"
            x2="13"
            y2="36"
            stroke={TONE_HEX[f.tone].mid}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ))}
      <IsoStar cx={60} cy={60} tone="cyan" />
      <IsoStar cx={266} cy={56} tone="violet" />
      <IsoStar cx={290} cy={120} r={1} tone="leaf" />
    </g>
  );
}

/** Discover — compass + magnifier on iso base. */
function DiscoverScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="cyan" />
      <IsoGlow cx={160} cy={90} r={52} tone="cyan" />
      {/* Compass */}
      <g transform="translate(140, 60)">
        <circle cx="20" cy="36" r="34" fill={TONE_HEX.cyan.lo} opacity="0.6" />
        <circle cx="20" cy="36" r="30" fill="url(#grad-cyan)" />
        <circle cx="20" cy="36" r="26" fill="#0B0E16" opacity="0.55" />
        {/* Needle */}
        <polygon
          points="20,12 26,36 20,28 14,36"
          fill={TONE_HEX.sindoor.mid}
        />
        <polygon
          points="20,60 14,36 20,44 26,36"
          fill={TONE_HEX.cyan.hi}
        />
        <circle cx="20" cy="36" r="3" fill={TONE_HEX.cyan.hi} />
      </g>
      {/* Magnifier */}
      <g transform="translate(212, 100)">
        <circle cx="0" cy="0" r="14" fill="none" stroke={TONE_HEX.violet.mid} strokeWidth="3" />
        <circle cx="0" cy="0" r="11" fill={TONE_HEX.violet.hi} opacity="0.3" />
        <line
          x1="10"
          y1="10"
          x2="22"
          y2="22"
          stroke={TONE_HEX.violet.mid}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <IsoStar cx={62} cy={56} tone="violet" />
      <IsoStar cx={282} cy={56} tone="cyan" />
    </g>
  );
}

/** Gallery — fanned photo frames on iso base. */
function GalleryScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="violet" />
      <IsoGlow cx={160} cy={88} r={52} tone="violet" />
      {/* Fanned frames */}
      {[
        { x: 110, y: 62, rot: -15, tone: "cyan" as Tone },
        { x: 158, y: 56, rot: 0, tone: "saffron" as Tone },
        { x: 206, y: 62, rot: 15, tone: "violet" as Tone },
      ].map((f, i) => (
        <g key={i} transform={`translate(${f.x}, ${f.y}) rotate(${f.rot})`}>
          <rect x="0" y="0" width="50" height="56" rx="3" fill={TONE_HEX[f.tone].lo} />
          <rect x="2" y="2" width="46" height="44" rx="2" fill={`url(#grad-${f.tone})`} />
          <circle cx="14" cy="18" r="3" fill={TONE_HEX[f.tone].hi} />
          <polygon
            points={`4,42 18,30 28,38 38,26 46,46 4,46`}
            fill={TONE_HEX[f.tone].hi}
            opacity="0.55"
          />
        </g>
      ))}
      <IsoStar cx={66} cy={62} tone="cyan" />
      <IsoStar cx={264} cy={62} tone="violet" />
    </g>
  );
}

/** Scan — invite-poster going through a scanner beam. */
function ScanScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="cyan" />
      <IsoGlow cx={160} cy={88} r={52} tone="cyan" />
      {/* Poster */}
      <g transform="translate(132, 50)">
        <rect x="0" y="0" width="56" height="74" rx="3" fill={TONE_HEX.saffron.lo} />
        <rect x="2" y="2" width="52" height="70" rx="2" fill="url(#grad-saffron)" />
        {/* Decorative lines */}
        <rect x="8" y="10" width="40" height="4" rx="1.5" fill={TONE_HEX.saffron.hi} opacity="0.95" />
        <rect x="8" y="20" width="30" height="3" rx="1.5" fill={TONE_HEX.saffron.hi} opacity="0.7" />
        <rect x="8" y="28" width="36" height="3" rx="1.5" fill={TONE_HEX.saffron.hi} opacity="0.6" />
        <circle cx="28" cy="48" r="10" fill={TONE_HEX.sindoor.lo} />
        <circle cx="28" cy="48" r="6" fill={TONE_HEX.saffron.hi} />
      </g>
      {/* Scan beam — diagonal cyan stripe */}
      <rect
        x="118"
        y="84"
        width="86"
        height="6"
        fill={TONE_HEX.cyan.hi}
        opacity="0.7"
      />
      <rect
        x="118"
        y="84"
        width="86"
        height="2"
        fill="#fff"
        opacity="0.85"
      />
      {/* Dots streaming off the beam */}
      <circle cx="214" cy="80" r="2" fill={TONE_HEX.cyan.hi} />
      <circle cx="222" cy="76" r="1.4" fill={TONE_HEX.cyan.hi} opacity="0.8" />
      <circle cx="230" cy="74" r="1" fill={TONE_HEX.cyan.hi} opacity="0.6" />
      <IsoStar cx={64} cy={62} tone="violet" />
      <IsoStar cx={284} cy={60} tone="cyan" />
    </g>
  );
}

/** Content — a stack of document cards next to a glowing prompt
 *  bubble + an Instagram-frame card with a tiny AI sparkle. Reads
 *  as "centralised library of pitches, templates, images, prompts". */
function ContentScene() {
  return (
    <g>
      <IsoBase cx={160} cy={132} tone="violet" />
      <IsoGlow cx={108} cy={84} r={48} tone="violet" />
      <IsoGlow cx={220} cy={84} r={48} tone="cyan" />

      {/* Left: stack of three document cards (pitches/templates/strategy). */}
      <g transform="translate(64, 56)">
        <rect x="0" y="14" width="52" height="64" rx="3" fill={TONE_HEX.violet.lo} opacity="0.85" />
        <rect x="6" y="7" width="52" height="64" rx="3" fill={TONE_HEX.violet.mid} opacity="0.9" />
        <rect x="12" y="0" width="52" height="64" rx="3" fill="url(#grad-violet)" />
        <rect x="18" y="8" width="40" height="3" rx="1.5" fill={TONE_HEX.violet.hi} opacity="0.95" />
        <rect x="18" y="16" width="34" height="2.5" rx="1.2" fill={TONE_HEX.violet.hi} opacity="0.7" />
        <rect x="18" y="22" width="38" height="2.5" rx="1.2" fill={TONE_HEX.violet.hi} opacity="0.6" />
        <rect x="18" y="28" width="30" height="2.5" rx="1.2" fill={TONE_HEX.violet.hi} opacity="0.55" />
        <rect x="18" y="34" width="36" height="2.5" rx="1.2" fill={TONE_HEX.violet.hi} opacity="0.45" />
        <rect x="18" y="40" width="28" height="2.5" rx="1.2" fill={TONE_HEX.violet.hi} opacity="0.4" />
      </g>

      {/* Centre: AI prompt bubble — speech-bubble shape with a tiny
          ✦ sparkle to suggest LLM-generated content. */}
      <g transform="translate(140, 64)">
        <rect x="0" y="0" width="46" height="34" rx="6" fill={TONE_HEX.cyan.lo} opacity="0.85" />
        <rect x="2" y="2" width="42" height="30" rx="5" fill="url(#grad-cyan)" />
        <path
          d="M16 34 L20 40 L24 34 Z"
          fill={TONE_HEX.cyan.mid}
          opacity="0.9"
        />
        {/* Sparkle ✦ */}
        <path
          d="M12 13 L13 16 L16 17 L13 18 L12 21 L11 18 L8 17 L11 16 Z"
          fill={TONE_HEX.cyan.hi}
        />
        <path
          d="M30 10 L31 13 L34 14 L31 15 L30 18 L29 15 L26 14 L29 13 Z"
          fill={TONE_HEX.cyan.hi}
          opacity="0.85"
        />
        {/* Prompt lines */}
        <rect x="8" y="22" width="20" height="1.6" rx="0.8" fill="#fff" opacity="0.85" />
        <rect x="8" y="26" width="14" height="1.6" rx="0.8" fill="#fff" opacity="0.6" />
      </g>

      {/* Right: Instagram-frame card to show "AI images for IG/WA". */}
      <g transform="translate(204, 56)">
        <rect x="0" y="0" width="56" height="68" rx="4" fill={TONE_HEX.violet.lo} opacity="0.9" />
        <rect x="2" y="2" width="52" height="42" rx="3" fill="url(#grad-saffron)" />
        {/* Mountain / scene */}
        <path
          d="M2 38 L18 24 L28 32 L40 18 L54 36 L54 44 L2 44 Z"
          fill={TONE_HEX.sindoor.lo}
          opacity="0.85"
        />
        <circle cx="44" cy="14" r="4" fill={TONE_HEX.saffron.hi} />
        {/* IG handle line */}
        <rect x="6" y="50" width="32" height="2.5" rx="1.2" fill={TONE_HEX.violet.hi} opacity="0.85" />
        <rect x="6" y="56" width="40" height="2" rx="1" fill={TONE_HEX.violet.hi} opacity="0.55" />
        <rect x="6" y="61" width="22" height="2" rx="1" fill={TONE_HEX.violet.hi} opacity="0.4" />
        {/* AI badge */}
        <circle cx="48" cy="8" r="4.5" fill={TONE_HEX.cyan.hi} />
        <text
          x="48"
          y="10.5"
          textAnchor="middle"
          fontSize="5.5"
          fontWeight="700"
          fill={TONE_HEX.violet.lo}
        >
          AI
        </text>
      </g>

      <IsoStar cx={48} cy={56} tone="cyan" />
      <IsoStar cx={286} cy={138} tone="violet" />
    </g>
  );
}

/** Emails — a stack of envelopes with one open + a pulsing "new"
 *  marker. Reads as inbox-with-fresh-mail. */
function EmailsScene() {
  return (
    <g>
      <IsoBase cx={160} cy={132} tone="cyan" />
      <IsoGlow cx={160} cy={88} r={56} tone="cyan" />

      {/* Back-stack envelope */}
      <g transform="translate(116, 70)">
        <rect x="0" y="0" width="80" height="50" rx="3" fill={TONE_HEX.violet.lo} opacity="0.85" />
        <rect x="2" y="2" width="76" height="46" rx="2" fill="url(#grad-violet)" />
        <path
          d="M2 2 L40 32 L78 2"
          fill="none"
          stroke={TONE_HEX.violet.hi}
          strokeWidth="1.2"
          opacity="0.6"
        />
      </g>

      {/* Mid-stack envelope, slight offset */}
      <g transform="translate(108, 60)">
        <rect x="0" y="0" width="80" height="50" rx="3" fill={TONE_HEX.cyan.lo} opacity="0.92" />
        <rect x="2" y="2" width="76" height="46" rx="2" fill="url(#grad-cyan)" />
        <path
          d="M2 2 L40 32 L78 2"
          fill="none"
          stroke={TONE_HEX.cyan.hi}
          strokeWidth="1.4"
          opacity="0.75"
        />
      </g>

      {/* Top envelope — opened (flap up), a letter peeking out */}
      <g transform="translate(100, 50)">
        {/* Envelope back */}
        <rect x="0" y="0" width="80" height="50" rx="3" fill={TONE_HEX.cyan.lo} />
        <rect x="2" y="2" width="76" height="46" rx="2" fill="url(#grad-cyan)" />
        {/* Letter sticking up out of the envelope */}
        <rect
          x="14"
          y="-8"
          width="52"
          height="34"
          rx="1.5"
          fill="#FBF7F0"
          opacity="0.95"
        />
        <rect x="18" y="-3" width="32" height="2" rx="1" fill={TONE_HEX.cyan.mid} opacity="0.85" />
        <rect x="18" y="3" width="44" height="1.5" rx="0.8" fill={TONE_HEX.cyan.mid} opacity="0.55" />
        <rect x="18" y="8" width="38" height="1.5" rx="0.8" fill={TONE_HEX.cyan.mid} opacity="0.45" />
        <rect x="18" y="13" width="40" height="1.5" rx="0.8" fill={TONE_HEX.cyan.mid} opacity="0.4" />
        {/* Envelope front flap (opened down) */}
        <path
          d="M2 26 L40 48 L78 26 L78 48 L2 48 Z"
          fill={TONE_HEX.cyan.mid}
          opacity="0.9"
        />
        {/* "New" pulsing dot — top-right of the top envelope */}
        <circle cx="76" cy="0" r="6" fill={TONE_HEX.sindoor.mid} />
        <circle cx="76" cy="0" r="3" fill={TONE_HEX.sindoor.hi} />
      </g>

      <IsoStar cx={56} cy={56} tone="violet" />
      <IsoStar cx={278} cy={68} tone="cyan" />
      <IsoStar cx={262} cy={138} tone="violet" />
    </g>
  );
}

/** Login — saffron disc with cyan halo, single brand mark. */
function LoginScene() {
  return (
    <g>
      <IsoBase cx={160} cy={130} tone="saffron" />
      <IsoGlow cx={160} cy={86} r={54} tone="saffron" />
      <IsoGlow cx={160} cy={86} r={40} tone="cyan" />
      <circle cx="160" cy="86" r="26" fill={TONE_HEX.saffron.mid} />
      <circle cx="160" cy="86" r="20" fill="url(#grad-saffron)" />
      {/* Flame */}
      <path
        d="M160 70 Q152 60 160 50 Q168 60 160 70"
        fill={TONE_HEX.saffron.hi}
      />
      {/* Pulse rings */}
      <circle
        cx="160"
        cy="86"
        r="36"
        fill="none"
        stroke={TONE_HEX.cyan.mid}
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />
      <circle
        cx="160"
        cy="86"
        r="44"
        fill="none"
        stroke={TONE_HEX.cyan.mid}
        strokeOpacity="0.18"
        strokeWidth="0.5"
      />
      <IsoStar cx={68} cy={60} tone="cyan" />
      <IsoStar cx={260} cy={60} tone="violet" />
    </g>
  );
}
