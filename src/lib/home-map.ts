/**
 * Painted homepage map: re-places REAL bhandara coordinates on the
 * painted Lucknow plate (public/illustrations/v2/map-lucknow.webp).
 *
 * The painting is decorative, not geographic, so a plain lat/lng box
 * would drop Aliganj into the painted river. Instead every point is
 * described relative to the real Gomti (how far along the river, and
 * how far off it on which bank), then rebuilt at the same fraction
 * along the PAINTED river, pushed off it along the painted river's
 * normal. Every bhandara keeps its true bank and its order along the
 * river. Distance from the river is compressed only as much as the
 * paper needs.
 *
 * Server only. Output is percentages of the 3:2 plate, so the whole
 * map (pins, labels) is static HTML: no client JS, no layout shift.
 */
import { ALL_AREA_SLUGS, areaToSlug } from "@/lib/areaSlug";
import { CITIES } from "@/lib/cities";
import { WATER_BITS, WATER_CELL_PX, WATER_COLS, WATER_ROWS } from "@/lib/map-water";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  /** Link target: the bhandara page, or the live feed for a spot that
   *  has no listing. */
  href: string;
  label: string;
  area: string | null;
  kind: "listed" | "spotted";
  /** A real photo of it, for the hover card. */
  photo?: string | null;
  /** Free text that may name its locality (a spot's address and
   *  caption). Only read for a spot with no coordinates (0,0). */
  place?: string | null;
  /** Set by buildPaintedMap when a coordless spot was placed at its
   *  locality: the locality's name, shown as "around Aliganj". */
  approx?: string;
};

export type ProjectedPin = {
  key: string;
  x: number;
  y: number;
  href: string;
  label: string;
  count: number;
  /** A real photo from this spot on the map, for the hover card. */
  photo: string | null;
  /** Drop order, drives the staggered animation delay. */
  order: number;
};

export type ProjectedLabel = {
  key: string;
  x: number;
  y: number;
  hi: string;
  en: string;
  href: string | null;
};

export type PaintedMapModel = {
  /** Pins de-duplicated for the desktop canvas. */
  pinsDesktop: ProjectedPin[];
  /** Pins de-duplicated for the phone canvas (swipeable). */
  pinsMobile: ProjectedPin[];
  labels: ProjectedLabel[];
  riverLabel: { x: number; y: number };
  /** Where the phone window starts scrolled to, percent of the plate. */
  focusX: number;
};

/** Plate size in px, used for the painted river trace. */
const PLATE_W = 1536;
const PLATE_H = 1024;

/** The painted river's centre line, traced from the plate (px). */
const PAINTED_RIVER: [number, number][] = [
  [0, 158], [128, 166], [256, 214], [384, 288], [448, 334], [520, 384],
  [640, 434], [760, 464], [900, 486], [1000, 540], [1088, 614], [1152, 650],
  [1216, 698], [1280, 758], [1350, 798], [1440, 830], [1536, 872],
];

/** The real Gomti through Lucknow, north west to south east (lat, lng). */
const REAL_GOMTI: [number, number][] = [
  [26.935, 80.858], [26.912, 80.878], [26.893, 80.894], [26.878, 80.909],
  [26.868, 80.925], [26.863, 80.94], [26.858, 80.955], [26.852, 80.968],
  [26.846, 80.983], [26.833, 80.994], [26.814, 81.003], [26.797, 81.022],
  [26.784, 81.05],
];

/** Real locality anchors, Hindi and English. */
const LOCALITIES: {
  key: string;
  hi: string;
  en: string;
  lat: number;
  lng: number;
  area: string | null;
}[] = [
  { key: "aliganj", hi: "अलीगंज", en: "Aliganj", lat: 26.9005, lng: 80.9415, area: "Aliganj" },
  { key: "kapoorthala", hi: "कपूरथला", en: "Kapoorthala", lat: 26.8826, lng: 80.9497, area: "Kapoorthala" },
  { key: "indira", hi: "इंदिरा नगर", en: "Indira Nagar", lat: 26.8781, lng: 81.0003, area: "Indira Nagar" },
  { key: "gomti", hi: "गोमती नगर", en: "Gomti Nagar", lat: 26.8522, lng: 81.0072, area: "Gomti Nagar" },
  { key: "setu", hi: "हनुमान सेतु", en: "Hanuman Setu", lat: 26.8636, lng: 80.9418, area: "Hanuman Setu" },
  { key: "hazratganj", hi: "हज़रतगंज", en: "Hazratganj", lat: 26.8494, lng: 80.9479, area: "Hazratganj" },
  { key: "chowk", hi: "चौक", en: "Chowk", lat: 26.8679, lng: 80.9106, area: "Chowk" },
  { key: "aminabad", hi: "अमीनाबाद", en: "Aminabad", lat: 26.8427, lng: 80.9255, area: "Aminabad" },
  { key: "alambagh", hi: "आलमबाग", en: "Alambagh", lat: 26.8139, lng: 80.9031, area: "Alambagh" },
  { key: "ashiyana", hi: "आशियाना", en: "Ashiyana", lat: 26.7915, lng: 80.9236, area: null },
];

type V = { x: number; y: number };

const K = Math.cos((26.85 * Math.PI) / 180);
/** Real coordinates as a y-down plane (x east, y south), in degrees. */
const realXY = (lat: number, lng: number): V => ({ x: lng * K, y: -lat });

type Line = { pts: V[]; cum: number[]; len: number };

function makeLine(pts: V[], extend: number): Line {
  // Extend both ends straight out so points beyond the ends still get a
  // sensible projection instead of piling onto the end vertex.
  const a = pts[0];
  const b = pts[1];
  const y = pts[pts.length - 2];
  const z = pts[pts.length - 1];
  const unit = (p: V, q: V) => {
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
  };
  const u0 = unit(b, a);
  const u1 = unit(y, z);
  const all = [
    { x: a.x + u0.x * extend, y: a.y + u0.y * extend },
    ...pts,
    { x: z.x + u1.x * extend, y: z.y + u1.y * extend },
  ];
  const cum = [0];
  for (let i = 1; i < all.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(all[i].x - all[i - 1].x, all[i].y - all[i - 1].y));
  }
  return { pts: all, cum, len: cum[cum.length - 1] };
}

/** Nearest point on the line: arc position and signed offset. */
function locate(line: Line, q: V): { s: number; d: number } {
  let best = { dist: Infinity, s: 0, d: 0 };
  for (let i = 0; i < line.pts.length - 1; i++) {
    const p = line.pts[i];
    const r = line.pts[i + 1];
    const tx = r.x - p.x;
    const ty = r.y - p.y;
    const l2 = tx * tx + ty * ty || 1;
    const u = Math.max(0, Math.min(1, ((q.x - p.x) * tx + (q.y - p.y) * ty) / l2));
    const fx = p.x + tx * u;
    const fy = p.y + ty * u;
    const dist = Math.hypot(q.x - fx, q.y - fy);
    if (dist < best.dist) {
      const l = Math.sqrt(l2);
      const d = ((tx / l) * (q.y - fy) - (ty / l) * (q.x - fx));
      best = { dist, s: line.cum[i] + u * l, d };
    }
  }
  return { s: best.s, d: best.d };
}

/** Point and unit tangent at arc position s. */
function at(line: Line, s: number): { p: V; t: V } {
  const clamped = Math.max(0, Math.min(line.len, s));
  let i = 0;
  while (i < line.cum.length - 2 && line.cum[i + 1] < clamped) i++;
  const p = line.pts[i];
  const r = line.pts[i + 1];
  const l = line.cum[i + 1] - line.cum[i] || 1;
  const u = (clamped - line.cum[i]) / l;
  return {
    p: { x: p.x + (r.x - p.x) * u, y: p.y + (r.y - p.y) * u },
    t: { x: (r.x - p.x) / l, y: (r.y - p.y) / l },
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function buildProjector(points: MapPoint[]) {
  const real = makeLine(REAL_GOMTI.map(([la, ln]) => realXY(la, ln)), 0.12);
  const painted = makeLine(PAINTED_RIVER.map(([x, y]) => ({ x, y })), 900);
  // Map the real river's (unextended) span onto the painted span.
  const realStart = real.cum[1];
  const realLen = real.cum[real.cum.length - 2] - realStart;
  const paintStart = painted.cum[1];
  const paintLen = painted.cum[painted.cum.length - 2] - paintStart;
  const along = paintLen / realLen;
  // Perpendicular scale: true scale unless the data needs compressing
  // to stay on the paper (about 400 px either side of the river).
  const offs = points
    .map((p) => Math.abs(locate(real, realXY(p.lat, p.lng)).d))
    .sort((a, b) => a - b);
  const p96 = quantile(offs, 0.96) || 0.05;
  const perp = Math.min(along, 380 / p96);

  /** `land` false only for the river's own label, which sits on the water. */
  return (lat: number, lng: number, land = true): V => {
    const { s, d } = locate(real, realXY(lat, lng));
    const sp = paintStart + ((s - realStart) / realLen) * paintLen;
    const { p, t } = at(painted, sp);
    // Offset from the painted river in plate px. A gada never stands in
    // the river: while its foot or its body would be on water, walk it
    // further out on the same bank, so it keeps its side of the Gomti.
    const side = d < 0 ? -1 : 1;
    let off = d * perp;
    let x = p.x + -t.y * off;
    let y = p.y + t.x * off;
    for (let i = 0; land && i < 60 && onWater(x, y); i++) {
      off += side * 6;
      x = p.x + -t.y * off;
      y = p.y + t.x * off;
    }
    return { x: (x / PLATE_W) * 100, y: (y / PLATE_H) * 100 };
  };
}

/** Water cells of the plate (the Gomti, its pale banks, the bridges). */
const WATER = Buffer.from(WATER_BITS, "base64");
function waterAt(px: number, py: number): boolean {
  const cx = Math.floor(px / WATER_CELL_PX);
  const cy = Math.floor(py / WATER_CELL_PX);
  if (cx < 0 || cy < 0 || cx >= WATER_COLS || cy >= WATER_ROWS) return false;
  const i = cy * WATER_COLS + cx;
  return ((WATER[i >> 3] >> (7 - (i & 7))) & 1) === 1;
}
/** A gada's foot, with a little margin either side, and its body above. */
function onWater(px: number, py: number): boolean {
  return (
    waterAt(px, py) ||
    waterAt(px - 7, py) ||
    waterAt(px + 7, py) ||
    waterAt(px, py + 6) ||
    waterAt(px, py - 14) ||
    waterAt(px, py - 28) ||
    waterAt(px, py - 42)
  );
}

/**
 * Painted Islamic monuments where no gada may stand (founder, 29 Oct
 * 2026: Bada Mangal bhandaras do not happen at the Bada Imambara).
 * Percent boxes of the plate. A pin is anchored at its foot and rises
 * about 4% of the plate height, so the box is padded below by HEAD.
 * Pins that land inside move just outside, to the side away from the
 * river, so they keep their bank and their order.
 */
const NO_PIN_ZONES: { x0: number; x1: number; y0: number; y1: number; to: "up" | "down" }[] = [
  // Bada Imambara complex, north of the painted river.
  { x0: 38.5, x1: 72, y0: 19.5, y1: 36, to: "up" },
  // White domed mosque or tomb, south of the painted river.
  { x0: 33.5, x1: 46.5, y0: 53.5, y1: 65.5, to: "down" },
];
const HEAD = 4;
const BAND = 5;

function clearMonuments(v: V): V {
  for (const z of NO_PIN_ZONES) {
    const bottom = z.y1 + HEAD;
    if (v.x < z.x0 || v.x > z.x1 || v.y < z.y0 || v.y > bottom) continue;
    const frac = (v.y - z.y0) / (bottom - z.y0);
    return {
      x: v.x,
      y: z.to === "up" ? z.y0 - 1.5 - (1 - frac) * BAND : bottom + 1.5 + frac * BAND,
    };
  }
  return v;
}

function dedupe(
  points: MapPoint[],
  project: (lat: number, lng: number) => V,
  canvasWidthPx: number,
  cellPx: number,
): ProjectedPin[] {
  const canvasH = canvasWidthPx / (PLATE_W / PLATE_H);
  const cellX = (cellPx / canvasWidthPx) * 100;
  const cellY = (cellPx / canvasH) * 100;
  const cells = new Map<
    string,
    { sx: number; sy: number; n: number; first: MapPoint; listed: boolean; photo: string | null }
  >();
  for (const p of points) {
    const { x, y } = clearMonuments(project(p.lat, p.lng));
    if (x < 3 || x > 97 || y < 6 || y > 96) continue;
    const key = `${Math.floor(x / cellX)}:${Math.floor(y / cellY)}`;
    const c = cells.get(key);
    if (c) {
      c.sx += x;
      c.sy += y;
      c.n += 1;
      if (!c.listed && p.kind === "listed") {
        c.first = p;
        c.listed = true;
        // The listing's own photo wins; otherwise keep a neighbour's.
        if (p.photo) c.photo = p.photo;
      } else if (c.first.approx && !p.approx && (p.kind === "listed" || !c.listed)) {
        // A pin with its own coordinates names the gada before one
        // placed only by its locality.
        c.first = p;
      }
      if (!c.photo && p.photo) c.photo = p.photo;
    } else {
      cells.set(key, { sx: x, sy: y, n: 1, first: p, listed: p.kind === "listed", photo: p.photo ?? null });
    }
  }
  const centre = project(26.8636, 80.9418);
  return [...cells.entries()]
    .map(([key, c]) => {
      const where = c.first.approx
        ? `, around ${c.first.approx}`
        : c.first.area
          ? `, ${c.first.area}`
          : "";
      return {
        key,
        x: r2(c.sx / c.n),
        y: r2(c.sy / c.n),
        href: c.first.href,
        label:
          c.n > 1 ? `${c.first.label}${where}, and ${c.n - 1} more nearby` : `${c.first.label}${where}`,
        count: c.n,
        photo: c.photo,
        order: 0,
      };
    })
    .sort(
      (a, b) =>
        Math.hypot(a.x - centre.x, (a.y - centre.y) / 1.5) -
        Math.hypot(b.x - centre.x, (b.y - centre.y) / 1.5),
    )
    .map((p, i) => ({ ...p, order: i }))
    // Paint north first so southern gadas overlap correctly.
    .sort((a, b) => a.y - b.y);
}

/**
 * Where a coordless spot can stand: the centre of the official Lucknow
 * locality its text names. Medians of the real, located 2026 listings
 * and spots tagged with that locality (1 Nov 2026), rounded; checked by
 * hand where fewer than five points existed. Ashiyana is not in the
 * official list but is a painted label above, so it counts too.
 */
const AREA_CENTRES: Record<string, [number, number]> = {
  Aishbagh: [26.8354, 80.9077],
  Alambagh: [26.8047, 80.9017],
  Aliganj: [26.8943, 80.9452],
  Aminabad: [26.8469, 80.928],
  "Bakshi Ka Talab": [26.9874, 80.9175],
  Charbagh: [26.834, 80.922],
  Chinhat: [26.8798, 81.0362],
  Chowk: [26.8697, 80.9088],
  Daliganj: [26.87, 80.925],
  Faizullaganj: [26.898, 80.925],
  "Gomti Nagar": [26.8537, 81.0037],
  "Gomti Nagar Extension": [26.8321, 81.0131],
  "Hanuman Setu": [26.8636, 80.9418],
  Hazratganj: [26.8509, 80.944],
  "IIM Road": [26.9353, 80.9072],
  "Indira Nagar": [26.8783, 80.9909],
  Jankipuram: [26.9281, 80.9461],
  Kaiserbagh: [26.858, 80.93],
  Kalyanpur: [26.9225, 80.97],
  Kapoorthala: [26.8815, 80.9433],
  "Krishna Nagar": [26.7959, 80.8931],
  Mahanagar: [26.8763, 80.9571],
  Mohanlalganj: [26.6706, 80.9893],
  Munshipulia: [26.8886, 81.0047],
  "Naka Hindola": [26.837, 80.9207],
  Nishatganj: [26.8665, 80.957],
  Polytechnic: [26.8722, 81.0186],
  Rajajipuram: [26.84, 80.8826],
  "Sarojini Nagar": [26.7437, 80.8603],
  "Sitapur Road": [26.8819, 80.925],
  "Sushant Golf City": [26.7883, 81.0085],
  Telibagh: [26.7826, 80.95],
  "University Road": [26.8671, 80.9384],
  "Vibhuti Khand": [26.8625, 81.001],
  "Vikas Nagar": [26.8962, 80.9603],
  "Vrindavan Yojna": [26.7559, 80.9662],
  Ashiyana: [26.79, 80.9173],
};

/** Looser than areaKey, for typed captions: "Munsipuliya" is
 *  Munshipulia, "Aligang" and "Aligunj" are Aliganj. */
function looseKey(s: string): string {
  return areaKey(s).replace(/sh/g, "s").replace(/g[au]n[gj]/g, "ganj");
}

const LOOSE_AREAS = Object.keys(AREA_CENTRES).map((name) => ({ name, key: looseKey(name) }));
/** "Chowk" is also the everyday word for a crossing ("Bhootnath
 *  chowk"), so free text only places a spot in Chowk when the spot's
 *  own area field says so. */
const NOT_IN_FREE_TEXT = new Set(["Chowk"]);
const HINDI_AREAS = LOCALITIES.filter((l) => l.area || l.key === "ashiyana").map((l) => ({
  hi: l.hi,
  name: l.area ?? l.en,
}));

/** The locality a piece of text names, matched on whole words. */
function areaInText(text: string, freeText: boolean): string | null {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const k = looseKey(words.slice(i, i + n).join(""));
      const hit = LOOSE_AREAS.find((a) => a.key === k);
      if (hit && !(freeText && NOT_IN_FREE_TEXT.has(hit.name))) return hit.name;
    }
  }
  const hi = HINDI_AREAS.find((a) => text.includes(a.hi));
  return hi && !(freeText && NOT_IN_FREE_TEXT.has(hi.name)) ? hi.name : null;
}

/** The official locality a coordless spot belongs to, if its area
 *  field, address or caption names one. */
export function localityOf(p: Pick<MapPoint, "area" | "place">): string | null {
  const area = (p.area ?? "").trim();
  if (area) {
    const canon = canonicalArea(area);
    if (canon && AREA_CENTRES[canon]) return canon;
    const inArea = areaInText(area, false);
    if (inArea) return inArea;
  }
  return p.place ? areaInText(p.place, true) : null;
}

/** Small stable offset from an id, so pins placed at one locality
 *  spread a little instead of stacking, and never move between renders. */
function jitter(id: string): { dLat: number; dLng: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 3600) / 3600;
  const r = 0.4 + (((h >>> 12) % 1000) / 1000) * 0.6;
  const R = 0.0035; // about 400 m
  return { dLat: Math.sin(a * 2 * Math.PI) * r * R, dLng: (Math.cos(a * 2 * Math.PI) * r * R) / K };
}

/** Real coordinates stay; a coordless spot that names an official
 *  locality stands around that locality's centre, marked approximate;
 *  any other coordless point stays off the map. */
function placeCoordless(points: MapPoint[]): MapPoint[] {
  const out: MapPoint[] = [];
  for (const p of points) {
    if (p.lat !== 0 && p.lng !== 0) {
      out.push(p);
      continue;
    }
    const name = localityOf(p);
    const centre = name ? AREA_CENTRES[name] : undefined;
    if (!name || !centre) continue;
    const j = jitter(p.id);
    out.push({ ...p, lat: centre[0] + j.dLat, lng: centre[1] + j.dLng, approx: name });
  }
  return out;
}

export function buildPaintedMap(input: MapPoint[]): PaintedMapModel {
  const points = placeCoordless(input);
  const project = buildProjector(points);

  // Labels with a vertical de-overlap pass (desktop canvas metrics).
  const canvasW = 1180;
  const canvasH = canvasW / 1.5;
  const labelH = (44 / canvasH) * 100;
  const placed: { x: number; y: number; w: number }[] = [];
  const labels: ProjectedLabel[] = LOCALITIES.map((l) => {
    const p = project(l.lat, l.lng);
    const w = ((Math.max(l.hi.length * 9.4, l.en.length * 8.2) + 26) / canvasW) * 100;
    let y = p.y;
    for (let guard = 0; guard < 6; guard++) {
      const hit = placed.find((q) => Math.abs(q.x - p.x) < (q.w + w) / 2 && Math.abs(q.y - y) < labelH);
      if (!hit) break;
      y = hit.y + (y >= hit.y ? labelH : -labelH);
    }
    placed.push({ x: p.x, y, w });
    const slug = l.area ? areaToSlug(l.area) : null;
    return {
      key: l.key,
      x: r2(Math.min(93, Math.max(7, p.x))),
      y: r2(Math.min(93, Math.max(8, y))),
      hi: l.hi,
      en: l.en,
      href: slug && ALL_AREA_SLUGS.includes(slug) ? `/area/${slug}` : null,
    };
  });

  const rl = project(26.8, 81.016, false);
  const hz = project(26.8494, 80.9479);
  return {
    pinsDesktop: dedupe(points, project, 1180, 18),
    pinsMobile: dedupe(points, project, 672, 15),
    labels,
    riverLabel: { x: r2(Math.min(92, rl.x)), y: r2(Math.min(92, rl.y + 6)) },
    focusX: r2(hz.x),
  };
}

export type LocalityGroup = {
  area: string;
  href: string | null;
  /** The catch-all group of one-off places; its rows name their place. */
  more?: boolean;
  items: { slug: string; name: string; nameHi: string | null; place: string | null; dates: string[] }[];
};

/** Spelling-blind key: "Aashiyana", "Ashiyana" and "Ashiana" match. */
function areaKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/aa/g, "a")
    .replace(/iya/g, "ia")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u");
}

const LUCKNOW_AREA_KEYS = (CITIES.lucknow?.areas ?? [])
  .map((a) => ({ name: a as string, key: areaKey(a) }))
  .sort((a, b) => b.key.length - a.key.length);

/** The official locality a free-text area belongs to, if any
 *  ("LDA Colony Sector C1" is not one; "Jankipuram Extension" is
 *  Jankipuram; "Saraswan Arjunganj" stays as typed). */
function canonicalArea(raw: string): string | null {
  const k = areaKey(raw);
  if (!k) return null;
  for (const a of LUCKNOW_AREA_KEYS) if (k === a.key || k.startsWith(a.key)) return a.name;
  return null;
}

/** Every listed bhandara grouped by locality, for the crawlable list.
 *  Spellings of one locality are merged; places with a single listing
 *  and no area page share one "More localities" group at the end. */
export function groupByLocality(
  listings: { slug: string; name: string; nameHi?: string | null; area?: string | null; tuesdayDates?: string[] }[],
): LocalityGroup[] {
  const groups = new Map<string, LocalityGroup["items"]>();
  for (const b of listings) {
    const raw = (b.area ?? "").trim();
    const area = (raw && canonicalArea(raw)) || raw || "Lucknow";
    const arr = groups.get(area) ?? [];
    arr.push({
      slug: b.slug,
      name: b.name,
      nameHi: b.nameHi ?? null,
      place: raw && raw !== area ? raw : null,
      dates: [...(b.tuesdayDates ?? [])].sort(),
    });
    groups.set(area, arr);
  }
  const main: LocalityGroup[] = [];
  const more: LocalityGroup["items"] = [];
  for (const [area, items] of groups) {
    const slug = areaToSlug(area);
    const href = ALL_AREA_SLUGS.includes(slug) ? `/area/${slug}` : null;
    if (!href && (items.length < 2 || area === "Lucknow")) {
      more.push(...items.map((it) => ({ ...it, place: area === "Lucknow" ? null : area })));
      continue;
    }
    main.push({ area, href, items: items.sort((a, b) => a.name.localeCompare(b.name)) });
  }
  main.sort((a, b) => b.items.length - a.items.length || a.area.localeCompare(b.area));
  if (more.length) {
    main.push({
      area: "More localities",
      href: null,
      more: true,
      items: more.sort((a, b) => (a.place ?? "~").localeCompare(b.place ?? "~") || a.name.localeCompare(b.name)),
    });
  }
  return main;
}

/** A painted map window for an inner page (a bhandara page, an area
 *  page): the same projection the homepage map uses, for a few target
 *  points, plus the painted locality labels. `context` should be the
 *  full set of listed bhandaras so the bank distances are scaled the
 *  way the homepage scales them. Coordless targets (0,0) are dropped.
 *  Output is percent of the 3:2 plate. Server only. */
export function placeOnPaintedMap(
  targets: { id: string; lat: number; lng: number }[],
  context: { lat: number; lng: number }[],
): {
  pins: { id: string; x: number; y: number }[];
  labels: { key: string; x: number; y: number; hi: string; en: string }[];
} {
  const real = (p: { lat: number; lng: number }) => p.lat !== 0 && p.lng !== 0;
  const ctx: MapPoint[] = context.filter(real).map((p, i) => ({
    id: `c${i}`,
    lat: p.lat,
    lng: p.lng,
    href: "",
    label: "",
    area: null,
    kind: "listed" as const,
  }));
  const project = buildProjector(ctx.length ? ctx : targets.filter(real).map((t) => ({ ...t, href: "", label: "", area: null, kind: "listed" as const })));
  return {
    pins: targets.filter(real).map((t) => {
      const v = project(t.lat, t.lng);
      return { id: t.id, x: r2(v.x), y: r2(v.y) };
    }),
    labels: LOCALITIES.map((l) => {
      const v = project(l.lat, l.lng);
      return { key: l.key, x: r2(v.x), y: r2(v.y), hi: l.hi, en: l.en };
    }),
  };
}
