/**
 * Every painted plate the homepage uses, in ONE place.
 *
 * The v2 plates live in `public/illustrations/v2/` (manifest in the
 * coordinator's art-v2/MANIFEST.md). To swap a plate, change its `src`
 * and natural `width` / `height` here; nothing else needs to change.
 *
 * Rules that travel with these images: never put text over Hanuman ji,
 * never crop his face or his gada.
 */
export type ArtPlate = {
  src: string;
  width: number;
  height: number;
};

export const HOME_ART = {
  /** Standing Hanuman ji with gada, the hero darshan. Transparent ground. */
  hanumanStanding: {
    src: "/illustrations/v2/hero-hanuman.webp",
    width: 1024,
    height: 1536,
  },
  /** Ram-naam halo, rasterised from ram-name-halo.svg (825 KB) to keep the
   *  turning ring light. The SVG original stays in the same folder. */
  ramNaamHalo: {
    src: "/illustrations/ram-name-halo-ring.webp",
    width: 1000,
    height: 1000,
  },
  /** Seated Hanuman ji, the companion moment. */
  hanumanSitting: {
    src: "/illustrations/v2/hanuman-seated.webp",
    width: 1000,
    height: 1250,
  },
  /** An old Lucknow bazaar street on a Bada Mangal. */
  oldLucknowBand: {
    src: "/illustrations/v2/tradition-street.webp",
    width: 1672,
    height: 941,
  },
  /** Painted Lucknow, the Gomti flowing from the left edge to the lower
   *  right. Decorative, not geographic: see src/lib/home-map.ts for how
   *  real coordinates are re-placed on it. */
  paintedMap: {
    src: "/illustrations/v2/map-lucknow.webp",
    width: 1536,
    height: 1024,
  },
  /** Hands serving puri chhole and sharbat, soft vignette on cream. */
  sevaHands: {
    src: "/illustrations/v2/seva-hands.webp",
    width: 1536,
    height: 1024,
  },
  /** Gomti ghats at dusk; top fades to cream, bottom to #1E1611 so it
   *  melts into the dark footer. */
  gomtiDusk: {
    src: "/illustrations/v2/gomti-dusk.webp",
    width: 1916,
    height: 821,
  },
  /** Gold-rimmed pattal with one marigold. */
  pattal: {
    src: "/illustrations/empty-state-plate.webp",
    width: 1254,
    height: 1254,
  },
  /** Maharajji, Neem Karoli Baba, painted portrait with gold halo. */
  maharajji: {
    src: "/illustrations/v2/maharajji.webp",
    width: 1024,
    height: 1024,
  },
  /** Aliganj at dusk, diyas along the temple path. */
  aliganjDusk: {
    src: "/illustrations/aliganj-dusk.webp",
    width: 1600,
    height: 901,
  },
  /** Hands frying puris and serving at a bhandara. */
  bhandaraLine: {
    src: "/illustrations/bhandara-line.webp",
    width: 1600,
    height: 901,
  },
  templePuranaAliganj: {
    src: "/illustrations/temples/v2/aliganj-purana-hanuman.webp",
    width: 1200,
    height: 1800,
  },
  /** Dakshinmukhi Hanuman Mandir, MG Marg, Hazratganj (painted from real photos, 29 Oct 2026). */
  templeHazratganj: {
    src: "/illustrations/temples/v2/hazratganj-hanuman.webp",
    width: 1200,
    height: 1800,
  },
  templeNayaAliganj: {
    src: "/illustrations/temples/v2/aliganj-naya-hanuman.webp",
    width: 1200,
    height: 1800,
  },
  templeHanumanSetu: {
    src: "/illustrations/temples/hanuman-setu.webp",
    width: 1600,
    height: 901,
  },
} satisfies Record<string, ArtPlate>;

/** The gada map pin, also the bullet and bead of the whole page. */
export const GADA_PIN = "/brand/map-pin-gada.svg";

/** Real logos. Never recolour or redraw. */
export const BM_LOGO = "/brand/logo-mark.svg";
/** DharmKriya wordmark for light grounds (splash on cream). */
export const DK_WORDMARK_LIGHT = {
  src: "/brand/dharmkriya/dharmkriya-wordmark-light-ground.png",
  width: 2328,
  height: 604,
};
/** DharmKriya wordmark for dark grounds (the #1E1611 footer). */
export const DK_WORDMARK_DARK = {
  src: "/brand/dharmkriya/dharmkriya-wordmark-dark-ground@2x.png",
  width: 2328,
  height: 604,
};
