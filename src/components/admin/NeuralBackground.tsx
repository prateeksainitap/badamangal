/**
 * Ambient neural-network background for the admin dashboard.
 *
 * Renders a fixed-position SVG behind everything: ~24 nodes
 * scattered across a 1600×1000 viewBox, each connected to its
 * 2–3 nearest neighbours by a thin edge. Nodes pulse gently;
 * edges carry a slow dashed-line "data packet" flow so the surface
 * reads as a live AI system, not a static decal.
 *
 * Why SVG (not Canvas):
 *   • Pure CSS animations → GPU-accelerated, no JS loop, no
 *     requestAnimationFrame cost.
 *   • Honours `prefers-reduced-motion` for free via globals.css
 *     media query (suppresses all animations).
 *   • Server-renders perfectly (no client-only initialization).
 *
 * The positions are pre-computed at module load (deterministic
 * pseudo-random seeded by index), not regenerated per render, so
 * the graph stays stable across re-mounts — flicker-free.
 */

type Node = { x: number; y: number; r: number; delay: number };
type Edge = { from: number; to: number; len: number; delay: number };

/** Mulberry32 PRNG so the layout is deterministic + reproducible. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const VIEW_W = 1600;
const VIEW_H = 1000;
const NODE_COUNT = 28;
const NEIGHBOURS_PER_NODE = 3;

const { nodes, edges } = (() => {
  const rng = mulberry32(0xb4d3a517); // any fixed seed → stable layout
  const ns: Node[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    ns.push({
      x: rng() * VIEW_W,
      y: rng() * VIEW_H,
      r: 2 + rng() * 2.5,
      delay: rng() * 4, // sec
    });
  }
  // For each node, link to NEIGHBOURS_PER_NODE nearest others (de-
  // duplicated so we don't draw a→b and b→a separately).
  const seen = new Set<string>();
  const es: Edge[] = [];
  for (let i = 0; i < ns.length; i++) {
    const dists = ns
      .map((n, j) => ({
        j,
        d: Math.hypot(n.x - ns[i].x, n.y - ns[i].y),
      }))
      .filter((d) => d.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEIGHBOURS_PER_NODE);
    for (const { j, d } of dists) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      es.push({ from: i, to: j, len: d, delay: rng() * 6 });
    }
  }
  return { nodes: ns, edges: es };
})();

export default function NeuralBackground() {
  return (
    <div
      aria-hidden
      className="neural-bg pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-55"
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0"
      >
        <defs>
          {/* Edge glow — a soft outer halo on the line so the
              connections read as energy, not pencil sketches. */}
          <filter id="neural-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Node-core gradient — bright cyan center, faded edge. */}
          <radialGradient id="neural-node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9be4ff" stopOpacity="1" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          {/* Accent node — violet for variety. Sprinkled on a few
              nodes so the network has a two-tone feel. */}
          <radialGradient id="neural-node-violet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d8b4fe" stopOpacity="1" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Edges. Each line gets a long dash pattern + animated
            stroke-dashoffset that travels its length over 6–14s
            depending on its physical length, so longer edges look
            slower (data takes longer to traverse). */}
        <g
          stroke="rgba(96, 165, 230, 0.22)"
          strokeWidth="0.7"
          fill="none"
          filter="url(#neural-glow)"
        >
          {edges.map((e, i) => {
            const a = nodes[e.from];
            const b = nodes[e.to];
            const speed = Math.max(6, Math.min(14, e.len / 80));
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeDasharray="2 14"
                style={{
                  animation: `neural-flow ${speed}s linear ${e.delay}s infinite`,
                }}
              />
            );
          })}
        </g>

        {/* Nodes. Every 5th node is violet — distributes the accent
            colour across the network without clustering. The pulse
            animation re-scales the circle slightly, staggered by
            per-node delay so the network never blinks in sync. */}
        <g filter="url(#neural-glow)">
          {nodes.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={n.r * 2.2}
              fill={i % 5 === 0 ? "url(#neural-node-violet)" : "url(#neural-node)"}
              style={{
                animation: `neural-pulse 4.5s ease-in-out ${n.delay}s infinite`,
                transformOrigin: `${n.x}px ${n.y}px`,
                transformBox: "fill-box",
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
