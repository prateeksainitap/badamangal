/**
 * Community testimonials, moved out of HomeTestimonials.tsx (29 Oct 2026)
 * so the v2 homepage "Lucknow is talking" section and the classic
 * section read ONE source. Every entry traces back to a real message
 * (see the provenance notes in each entry). No fabrication.
 */
export type Testimonial = {
  /** Visible name. */
  name: string;
  /** Optional Lucknow area / city label. */
  locality?: string;
  /** Optional role / context badge (e.g. "Born and Raised"). */
  role?: string;
  /** ISO date the testimonial was received. */
  dateIso: string;
  /** Quote text, sender's exact words. */
  body: string;
  /** Source label, "Email", "WhatsApp", "Telegram", "Reddit". */
  source: string;
};

/** Reddit r/lucknow post metrics (May 26 screenshot). Surfaces as
 *  a small social-proof strip at the top of the section so a first-
 *  time visitor sees external validation before a single quote. */
// Updated 2026-05-26 evening: views ticked 9.2K, 9.4K.
// Updated 2026-05-30: views ticked to 9.6K.
// Updated 2026-06-24: views crossed 10K.
export const REDDIT_STATS = {
  views: "10K",
  upvotes: "133",
  comments: "30",
  community: "r/lucknow",
};

export const TESTIMONIALS: Testimonial[] = [
  // First names only (per design call 2026-05-26), surnames felt
  // formal in a community testimonial card. Reddit usernames stay
  // as-is since they ARE the identity people picked for themselves.
  {
    name: "Nidhi",
    locality: "Lucknow",
    dateIso: "2026-05-19",
    body:
      "The website has made it easy for people across the globe to get all the information and updates regarding bhandaras happening nearby. I really liked the doodle type of pictures in the history making it more engaging. Lets not forget how spot maps are created using Hanuman ji's Gada making it more relatable to the auspicious occasion. I don't think any website could be better than this. Glad you took the initiative and done a wonderful job. 🙏",
    source: "WhatsApp",
  },
  {
    // Source corrected to WhatsApp (was Telegram). The screenshot
    // looks Telegram-ish at first glance but it's WhatsApp's
    // "Balaji ka bhandara (3)" community group.
    name: "Vaibhav",
    locality: "Lucknow",
    dateIso: "2026-05-20",
    body: "Really admirable website 🔥",
    source: "WhatsApp",
  },
  {
    // Role kept to just the Reddit user-flair ("illahabadi amrood")
    //, the "Reddit" prefix was redundant with the "via Reddit"
    // line in the source row below, and the pill rendered as an
    // orange "REDDIT" chip that competed with the flair text.
    name: "Crouts",
    locality: "Allahabad",
    role: "illahabadi amrood",
    dateIso: "2026-05-22",
    body:
      "Demn boi, good work! In our city Allahabad we have a humungous student diaspora, on every such Tuesdays there's an unofficial ritual that students will not cook and go on bhandara hopping around the city. Badhiya WhatsApp group bana rakha hai kab kaha kidhar kya mil raha haha.",
    source: "Reddit",
  },
  {
    name: "savyasachi-",
    role: "Born and Raised",
    dateIso: "2026-05-22",
    body: "Ye hui na baat. City's tradition goes online. 😎",
    source: "Reddit",
  },
  {
    name: "Anonymous donor",
    locality: "Lucknow",
    dateIso: "2026-05-23",
    body: "Website to mst hai yar 👍🔥",
    source: "WhatsApp",
  },
  {
    // No role badge, Reddit username alone is enough; the source
    // chip below already shows "via Reddit", so a redundant pill
    // would just add visual noise.
    name: "ducksayswhack",
    dateIso: "2026-05-22",
    body:
      "I'm not from Lko but bf is. He will LOVE this haha. Ty OP.",
    source: "Reddit",
  },
];

/** The "lead" testimonial, gets its own wide card above the grid.
 *  Shashwat's email is the longest, most generous quote we have and
 *  carries a verifiable real name + email + phone, so it earns the
 *  prominence. */
export const FEATURED: Testimonial = {
  name: "Shashwat",
  locality: "Lucknow",
  dateIso: "2026-05-23",
  body:
    "Hats off to this creativity guys, absolutely phenomenal design, absolutely gorgeous UX/UI, loved it. Wishing you all the very best for all your future endeavours.",
  source: "Email",
};

/**
 * Trimmed excerpts for the v2 homepage "Lucknow is talking" section.
 * Each one is the sender's own words, only trimmed (and emoji dropped),
 * taken from the entries above.
 */
export const HOME_VOICES = {
  feature: {
    name: "Nidhi",
    sourceEn: "on WhatsApp",
    sourceHi: "WhatsApp पर",
    quote:
      "Spot maps are created using Hanuman ji's Gada making it more relatable to the auspicious occasion. I don't think any website could be better than this.",
  },
  list: [
    { name: "savyasachi-", sourceEn: "Reddit, Born and Raised", sourceHi: "Reddit, Born and Raised", quote: "Ye hui na baat. City's tradition goes online." },
    { name: "Crouts", sourceEn: "Reddit, Allahabad", sourceHi: "Reddit, इलाहाबाद", quote: "On every such Tuesdays there's an unofficial ritual that students will not cook and go on bhandara hopping around the city." },
    { name: "Shashwat", sourceEn: "by email", sourceHi: "ईमेल से", quote: "Hats off to this creativity guys, absolutely phenomenal design, absolutely gorgeous UX/UI, loved it." },
    { name: "A donor", sourceEn: "on WhatsApp", sourceHi: "WhatsApp पर", quote: "Website to mst hai yar" },
  ],
} as const;

/** Press actually run (29 Oct 2026): radio and print. Amar Ujala and
 *  Navbharat Times are NOT listed, no story ran. */
export const HOME_PRESS = {
  radio: [
    { name: "Radio Mirchi", src: "/press/radio/radio-mirchi.jpg", width: 324, height: 137, h: 60 },
    { name: "Fever FM", src: "/press/radio/fever-fm.jpg", width: 513, height: 311, h: 66 },
    { name: "Big FM", src: "/press/radio/big-fm.png", width: 400, height: 426, h: 80 },
  ],
  print: [{ name: "Dainik Jagran", src: "/media/press/dainik-jagran.png", width: 300, height: 163, h: 80 }],
} as const;
