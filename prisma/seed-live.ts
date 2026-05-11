/**
 * Seed sample LIVE-FEED data: a handful of approved Posts (text + photo) and
 * a handful of crowd-sourced Spots so the /live page and "Happening now"
 * section have realistic content to demo. Idempotent: deletes its own seed
 * rows before inserting (matched by a tagged ipHash).
 *
 * Run:  npx tsx prisma/seed-live.ts
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

// Stable tag we can recognise our seed rows by, so reruns clean up.
const SEED_TAG_IP = crypto.createHash("sha256").update("seed:live:v1").digest("hex");
const SEED_TAG_PHONE = crypto.createHash("sha256").update("seed:live:phone").digest("hex");

// Real bhandara photos shipped under /public/illustrations/bhandara — used
// for the Live feed + Spot cards so /live and "Happening now" feel grounded.
const PHOTOS = [
  "/illustrations/bhandara/seva-lucknow.webp",
  "/illustrations/bhandara/devotees-tuesday.webp",
  "/illustrations/bhandara/sugarcane-juice.webp",
  "/illustrations/bhandara/history-2026.jpg",
  "/illustrations/bhandara/wa-2022-pandal.jpeg",
  "/illustrations/bhandara/mangal.jpg",
  "/illustrations/bhandara/crowd.jpg",
  "/illustrations/bhandara/bhandara-2.avif",
];

const TEXT_POSTS: Array<{
  authorName: string;
  text: string;
  language: "hi" | "en" | "mixed";
  photoIdx?: number;
  /** how many minutes ago this post landed */
  agoMin: number;
}> = [
  {
    authorName: "Anjali Sharma",
    language: "en",
    text:
      "Aliganj is glowing. Volunteers serving 5,000 plates already and the queue is still growing — Jai Hanuman 🙏",
    photoIdx: 0,
    agoMin: 6,
  },
  {
    authorName: "रवि तिवारी",
    language: "hi",
    text:
      "हनुमान सेतु पर बहुत अच्छी व्यवस्था। पूड़ी, सब्ज़ी, बूँदी, ठंडा शरबत — सब मिल रहा है। श्रद्धालु हज़ारों में हैं। जय बजरंगबली!",
    photoIdx: 2,
    agoMin: 18,
  },
  {
    authorName: "Vikas Mishra",
    language: "en",
    text:
      "Hazratganj corner pandal: ORS sachets being handed out with the prasad. Smart move on a 41° afternoon.",
    photoIdx: 3,
    agoMin: 27,
  },
  {
    authorName: "सीमा अग्रवाल",
    language: "hi",
    text:
      "गोमती नगर एक्सटेंशन में एक छोटा सा पंडाल — पर सेवा भाव बहुत बड़ा है। लड्डू-इमरती, और ठंडाई भी।",
    photoIdx: 5,
    agoMin: 42,
  },
  {
    authorName: "Mohit",
    language: "mixed",
    text:
      "Bada Hanuman Khun Khun Ji ke saamne aaj qatar lag rahi hai — jaise pure shahar ka khaana yahin chal raha ho 🪔",
    photoIdx: 4,
    agoMin: 58,
  },
  {
    authorName: "Priya Verma",
    language: "en",
    text:
      "Drove past Indira Nagar — three pandals on one stretch of road. Lucknow really does become one kitchen on Bada Mangal.",
    photoIdx: 6,
    agoMin: 73,
  },
  {
    authorName: "रामेश्वर पांडे",
    language: "hi",
    text:
      "कैसरबाग चौराहे पर भंडारा शुरू हो गया। पुलिस वाले भी प्रसाद लेने रुके। चालीसा का पाठ चल रहा है।",
    agoMin: 95,
  },
  {
    authorName: "Karan",
    language: "en",
    text:
      "First time at Sankat Mochan today. The aarti just ended and food's coming out now. Crowd is cheerful, not chaotic.",
    photoIdx: 3,
    agoMin: 110,
  },
  {
    authorName: "नेहा सिंह",
    language: "hi",
    text: "आलमबाग में दो पंडाल पास-पास। दूर से ही गेंदे की महक आ रही है।",
    agoMin: 132,
  },
  {
    authorName: "Saurabh",
    language: "en",
    text: "Met an uncle who's been serving at the Aliganj bhandara for 22 years. 22 years!",
    photoIdx: 1,
    agoMin: 165,
  },
];

// Spots — each gets a Lucknow-area lat/lng + photo so they show on the map.
const SPOTS: Array<{
  area: string;
  address: string;
  lat: number;
  lng: number;
  caption: string;
  reporterName: string;
  language: "hi" | "en";
  photoIdx: number;
  agoMin: number;
}> = [
  {
    area: "Aliganj",
    address: "Naya Hanuman Mandir, Aliganj",
    lat: 26.9097,
    lng: 80.9468,
    caption: "Puri-sabzi, halwa, full crowd. Live since 11am.",
    reporterName: "Anjali",
    language: "en",
    photoIdx: 0,
    agoMin: 4,
  },
  {
    area: "Hanuman Setu",
    address: "Hanuman Setu Mandir Road",
    lat: 26.8597,
    lng: 80.9382,
    caption: "हज़ारों थाली। शरबत भी मिल रहा है।",
    reporterName: "रवि",
    language: "hi",
    photoIdx: 2,
    agoMin: 12,
  },
  {
    area: "Hazratganj",
    address: "Halwasiya market corner",
    lat: 26.8509,
    lng: 80.9436,
    caption: "Big pandal at the GPO crossing.",
    reporterName: "Vikas",
    language: "en",
    photoIdx: 3,
    agoMin: 22,
  },
  {
    area: "Gomti Nagar",
    address: "Vipul Khand 5",
    lat: 26.8512,
    lng: 81.0028,
    caption: "Lassi being served free with the thali. ORS too.",
    reporterName: "Manish",
    language: "en",
    photoIdx: 7,
    agoMin: 35,
  },
  {
    area: "Indira Nagar",
    address: "Sector 14, near Polytechnic",
    lat: 26.8819,
    lng: 80.9989,
    caption: "तीन पंडाल एक ही सड़क पर।",
    reporterName: "Priya",
    language: "hi",
    photoIdx: 6,
    agoMin: 48,
  },
  {
    area: "Aminabad",
    address: "Aminabad chowk",
    lat: 26.8462,
    lng: 80.9259,
    caption: "Bundi laddoos being distributed by RWA volunteers.",
    reporterName: "Karan",
    language: "en",
    photoIdx: 5,
    agoMin: 70,
  },
  {
    area: "Mahanagar",
    address: "Sector D, Mahanagar",
    lat: 26.8775,
    lng: 80.9588,
    caption: "Small but very organised. 2 saffron canopies up.",
    reporterName: "नेहा",
    language: "hi",
    photoIdx: 4,
    agoMin: 95,
  },
  {
    area: "Charbagh",
    address: "Outside Charbagh railway station",
    lat: 26.8316,
    lng: 80.9201,
    caption: "Travellers + locals all queuing together. 🪔",
    reporterName: "Saurabh",
    language: "en",
    photoIdx: 1,
    agoMin: 130,
  },
];

async function main() {
  // 1) Clean previous seed rows so reruns don't pile up duplicates.
  await prisma.spot.deleteMany({ where: { ipHash: SEED_TAG_IP } });

  const now = Date.now();

  // The Post model (per-bhandara live comments) was removed — this seed
  // now only inserts Spots. The TEXT_POSTS / SEED_TAG_PHONE constants
  // are kept above as reference material in case the team ever wants
  // to seed Spot captions from the old post copy.
  void TEXT_POSTS;
  void SEED_TAG_PHONE;

  // 2) Spots — all "live" (not expired).
  for (const s of SPOTS) {
    const createdAt = new Date(now - s.agoMin * 60 * 1000);
    const expiresAt = new Date(createdAt.getTime() + 8 * 60 * 60 * 1000);
    await prisma.spot.create({
      data: {
        lat: s.lat,
        lng: s.lng,
        area: s.area,
        address: s.address,
        photoUrl: PHOTOS[s.photoIdx],
        caption: s.caption,
        reporterName: s.reporterName,
        language: s.language,
        status: "APPROVED",
        createdAt,
        expiresAt,
        ipHash: SEED_TAG_IP,
        userAgent: "seed-live",
      },
    });
  }

  console.log(
    `[seed-live] inserted ${TEXT_POSTS.length} posts and ${SPOTS.length} spots.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
