/**
 * Seed listed bhandaras extracted from WhatsApp invite images
 * ("/Users/prateeksaini/.../Whatsapp Bhandara/Till-12th May").
 *
 * Behaviour:
 *   1. WIPES all existing `Spot` rows
 *   2. WIPES all existing `Bhandara` rows (including the demo seed)
 *   3. Inserts 19 bhandaras with status = APPROVED so they go live on
 *      the city map immediately. `isVerified` stays false — the team
 *      will phone-confirm later to add the green badge.
 *
 * Photos are pre-copied to `/public/uploads/whatsapp/<slug>.jpg` so the
 * `photoUrl` field on each record resolves cleanly in dev and on
 * Netlify (the `public` folder is served as static assets).
 *
 * Coordinates are area-approximate (within Lucknow's bounding box but
 * not pin-accurate). The team can fine-tune via the admin panel.
 *
 * Run:
 *   npx tsx prisma/seed-whatsapp.ts
 */
import { PrismaClient } from "@prisma/client";
import { menuHiFor } from "../src/lib/menu";

const prisma = new PrismaClient();

// Tuesday 12 May 2026 — the first Bada Mangal of the 2026 season.
const TUE_12_MAY = "2026-05-12";
const TUE_19_MAY = "2026-05-19";
const SAT_16_MAY = "2026-05-16"; // Shani Jayanti Bhandara

type SeedBhandara = {
  slug: string;
  name: string;
  nameHi: string;
  description?: string;
  descriptionHi?: string;
  area: string;
  address: string;
  addressHi?: string;
  landmark?: string;
  lat: number;
  lng: number;
  tuesdayDates: string[];
  timeStart: string;
  timeEnd?: string;
  menu: string[];
  organizerName: string;
  organizerPhone: string;
  photoSlug: string;
};

const ROWS: SeedBhandara[] = [
  // 1) Pragati Mart, LU 2nd Campus, Jankipuram — 10:15 AM
  {
    slug: "bada-mangal-mahotsav-pragati-mart",
    name: "Bada Mangal Mahotsav 2026",
    nameHi: "बड़ा मंगल महोत्सव 2026",
    description:
      "Bhandara at Pragati Mart on the auspicious occasion of the second Bada Mangal of 2026.",
    descriptionHi:
      "द्वितीय बड़ा मंगल पर प्रगति मार्ट में सादर आमंत्रण।",
    area: "Jankipuram",
    address:
      "Pragati Mart, Lucknow University 2nd Campus, Jankipuram, Lucknow",
    addressHi:
      "प्रगति मार्ट, लखनऊ विश्वविद्यालय द्वितीय परिसर (जानकीपुरम), लखनऊ",
    landmark: "Lucknow University 2nd Campus",
    lat: 26.9151,
    lng: 80.9384,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "10:15",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Pragati Mart",
    organizerPhone: "9999999999",
    photoSlug: "pragati-mart-jankipuram",
  },

  // 2) Hanuman Mandir, Cotton Mill, Talkatora — 9 AM Sundarkand + 12 PM Bhandara
  {
    slug: "hanuman-mandir-talkatora-bhandara",
    name: "Hanuman Mandir Bhandara — Talkatora",
    nameHi: "हनुमान मंदिर भंडारा — तालकटोरा",
    description:
      "Sundarkand Path from 9 AM, Vishal Bhandara from 12 PM onwards at Hanuman Mandir, Cotton Mill, Talkatora.",
    descriptionHi:
      "सुंदरकांड पाठ प्रातः 9 बजे से, विशाल भंडारा दोपहर 12 बजे से प्रभु इच्छा तक।",
    area: "Aishbagh",
    address: "Hanuman Mandir, Cotton Mill, Talkatora, Lucknow",
    addressHi: "हनुमान मंदिर, कॉटन मिल, तालकटोरा, लखनऊ",
    landmark: "Cotton Mill",
    lat: 26.8311,
    lng: 80.895,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "09:00",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Hanuman Mandir Trust",
    organizerPhone: "9999999998",
    photoSlug: "hanuman-mandir-talkatora",
  },

  // 3) Awadh Tent House, E-3851, Rajajipuram — Shrivastav Pariwar
  {
    slug: "shrivastav-pariwar-rajajipuram",
    name: "Shrivastav Pariwar Bhandara",
    nameHi: "श्रीवास्तव परिवार भंडारा",
    description:
      "Sundarkand Path + Vishal Bhandara hosted by the Shrivastav family at Awadh Tent House, Rajajipuram.",
    descriptionHi:
      "द्वितीय बड़े मंगल के पावन अवसर पर समस्त श्रीवास्तव परिवार द्वारा सुंदरकांड पाठ एवं विशाल भंडारे का भव्य आयोजन।",
    area: "Rajajipuram",
    address: "Awadh Tent House, E-3851, Rajajipuram, Lucknow",
    addressHi: "अवध टेंट हाउस, E-3851, राजाजीपुरम, लखनऊ",
    landmark: "Near Awadh Tent House",
    lat: 26.841,
    lng: 80.865,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "09:00",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Shrivastav Pariwar",
    organizerPhone: "9999999997",
    photoSlug: "awadh-tent-house-rajajipuram",
  },

  // 4) Hotel ANR, Gurudwara Road, Naka Hindola — 12 PM
  {
    slug: "vishal-bhandara-hotel-anr-naka-hindola",
    name: "Vishal Bhandara — Hotel ANR",
    nameHi: "विशाल भंडारा — होटल ए.एन.आर.",
    description:
      "Vishal Bhandara on the auspicious second Bada Mangal, Tuesday 12 May 2026.",
    descriptionHi:
      "द्वितीय बड़ा मंगल निमंत्रण — विशाल भंडारा का आयोजन।",
    area: "Naka Hindola",
    address:
      "Hotel ANR, Gurudwara Road, Naka Hindola, Lucknow",
    addressHi: "होटल ए.एन.आर., गुरुद्वारा रोड, नाका हिंडोला, लखनऊ",
    landmark: "Gurudwara Road",
    lat: 26.8341,
    lng: 80.9136,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "12:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Hotel ANR",
    organizerPhone: "9999999996",
    photoSlug: "hotel-anr-naka-hindola",
  },

  // 5) Nawab Pasad Chauraha, Near TD Girls College
  {
    slug: "bhandara-nawab-pasad-chauraha",
    name: "Bhandara — Nawab Pasad Chauraha",
    nameHi: "भंडारा — नवाब पसाद चौराहा",
    description:
      "Bada Mangal Bhandara at Nawab Pasad Chauraha, near TD Girls Inter College.",
    descriptionHi:
      "मंगलवार बड़े मंगल के अवसर पर भंडारे का आयोजन।",
    area: "Aliganj",
    address:
      "Nawab Pasad Chauraha, Near TD Girls Inter College, Lucknow",
    addressHi:
      "नवाब पसाद चौराहा, टी.डी. गर्ल्स इंटर कॉलेज के पास, लखनऊ",
    landmark: "Near TD Girls Inter College",
    // Ola geocode: Beli Garad Chauraha Main Rd, Sector J, Aliganj —
    // the chauraha is colloquially called "Nawab Pasand" by locals.
    lat: 26.8993,
    lng: 80.9453,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "12:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Bhakta Mandali",
    organizerPhone: "9999999995",
    photoSlug: "nawab-pasad-chauraha",
  },

  // 6) Vishesh Khand, Gomti Nagar — Hotel The Sara Grand / Digital Ninja Labs
  {
    slug: "bhandara-vishesh-khand-gomti-nagar",
    name: "Vishal Bhandara — Vishesh Khand",
    nameHi: "विशाल भंडारा — विशेष खंड",
    description:
      "Sundarkand from 10 AM, Vishal Bhandara from 2 PM at Vishesh Khand, Gomti Nagar. Hosted by Digital Ninja Labs, Premium Shoe Care & Service, and Hotel The Sara Grand.",
    descriptionHi:
      "सुंदरकांड प्रातः 10 बजे, विशाल भंडारा दोपहर 2 बजे से।",
    area: "Gomti Nagar",
    address: "624V/177, Vishesh Khand, Gomti Nagar, Lucknow",
    addressHi: "624V/177, विशेष खंड, गोमती नगर, लखनऊ",
    landmark: "Vishesh Khand 4",
    lat: 26.8585,
    lng: 80.999,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "10:00",
    timeEnd: "16:00",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Hotel The Sara Grand",
    organizerPhone: "7054742865",
    photoSlug: "vishesh-khand-gomti-nagar",
  },

  // 7) Ram Janki Mandir, Daroga Kheda — Mayfair / Vasudha Estate, Sarojini Nagar
  {
    slug: "ram-janki-mandir-daroga-kheda-bhandara",
    name: "Ram Janki Mandir Bhandara — Daroga Kheda",
    nameHi: "राम जानकी मंदिर भंडारा — दरोगा खेड़ा",
    description:
      "Sundarkand Path from 8 AM, Bhavya Bhandara from 10 AM at Ram Janki Mandir, near Outer Ring Road, Daroga Kheda, Kanpur Road.",
    descriptionHi:
      "सुन्दर कांड पाठ पूर्वाह्न 8 बजे, भव्य भंडारा पूर्वाह्न 10 बजे से।",
    area: "Sarojini Nagar",
    address:
      "Ram Janki Mandir, Near Outer Ring Road, Daroga Kheda, Kanpur Road, Lucknow",
    addressHi:
      "राम जानकी मंदिर, निकट आउटर रिंग रोड, दरोगा खेड़ा, कानपुर रोड, लखनऊ",
    landmark: "Near Outer Ring Road",
    lat: 26.767,
    lng: 80.883,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "08:00",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Jitendra Dixit & family",
    organizerPhone: "9651990993",
    photoSlug: "ram-janki-daroga-kheda",
  },

  // 8) Indu Medical Center, Sector-K, Aliganj — 11:30 AM
  {
    slug: "indu-medical-bhandara-aliganj",
    name: "Indu Medical Center Bhandara",
    nameHi: "इन्दु मेडिकल सेंटर भंडारा",
    description:
      "Sundarkand Path and Vishal Bhandara organised by the Indu Medical family on the second Bada Mangal.",
    descriptionHi:
      "द्वितीय बड़े मंगल के अवसर पर सुंदरकांड पाठ एवं विशाल भंडारा।",
    area: "Aliganj",
    address: "B-1-26/69, Sector-K, Aliganj, Lucknow",
    addressHi: "बी-1-26/69, सेक्टर-के, अलीगंज, लखनऊ",
    landmark: "Sector K",
    lat: 26.905,
    lng: 80.945,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "11:30",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Indu Medical Pariwar",
    organizerPhone: "9999999994",
    photoSlug: "indu-medical-aliganj",
  },

  // 9) Devendram Complex, C164 Aravali Marg, Indiranagar
  {
    slug: "devendram-complex-bhandara-indiranagar",
    name: "Devendram Complex Bhandara",
    nameHi: "देवेंद्रम कॉम्प्लेक्स भंडारा",
    description:
      "Bada Mangal Mahotsav + Sundarkand Path at Devendram Complex, Indiranagar. Hosted by Arena Animation Lucknow Indiranagar, T-Institutes, Coffea, H²Glam Studio, and Oriental Engineers.",
    descriptionHi:
      "बड़ा मंगल महोत्सव एवं सुंदरकांड पाठ — देवेंद्रम कॉम्प्लेक्स, इंदिरा नगर।",
    area: "Indira Nagar",
    address:
      "C164, Aravali Marg, Indiranagar (Near Indiranagar Metro Station), Lucknow 226016",
    addressHi:
      "C164, अरावली मार्ग, इंदिरा नगर (निकट इंदिरा नगर मेट्रो स्टेशन), लखनऊ - 226016",
    landmark: "Near Indiranagar Metro Station",
    lat: 26.873,
    lng: 80.993,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "10:00",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Devendram Complex",
    organizerPhone: "9999999993",
    photoSlug: "devendram-indiranagar",
  },

  // 10) Saxena Pariwar, Vivek Khand-4, Patrakarpuram, Gomti Nagar
  {
    slug: "saxena-pariwar-patrakarpuram",
    name: "Saxena Pariwar Bhandara",
    nameHi: "सक्सेना परिवार भंडारा",
    description:
      "Bada Mangal Bhandara hosted by the Saxena family in Vivek Khand 4, near Indian Oil Petrol Pump, Patrakarpuram Crossing, Gomti Nagar.",
    descriptionHi:
      "विवेक खंड-4, अभिषेक पार्क, निकट इंडियन ऑयल पेट्रोल पंप, पत्रकारपुरम क्रॉसिंग रोड, गोमती नगर, लखनऊ।",
    area: "Gomti Nagar",
    address:
      "Vivek Khand-4, Abhishek Park, Near Indian Oil Petrol Pump, Patrakarpuram Crossing Road, Gomti Nagar, Lucknow 226010",
    addressHi:
      "विवेक खंड-4, अभिषेक पार्क, निकट इंडियन ऑयल पेट्रोल पंप, पत्रकारपुरम क्रॉसिंग रोड, गोमतीनगर, लखनऊ-226010",
    landmark: "Indian Oil Petrol Pump, Patrakarpuram Crossing",
    lat: 26.8615,
    lng: 81.002,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "11:00",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Saxena Pariwar",
    organizerPhone: "9999999992",
    photoSlug: "saxena-pariwar-patrakarpuram",
  },

  // 11) Janki Plaza, Jankipuram
  {
    slug: "janki-plaza-bhandara-jankipuram",
    name: "Bada Mangal Bhandara — Janki Plaza",
    nameHi: "बड़ा मंगल भंडारा — जानकी प्लाज़ा",
    description:
      "Bhandara at Janki Plaza on the second Bada Mangal of 2026.",
    descriptionHi:
      "हनुमान जी की कृपा से जानकी प्लाज़ा पर भंडारे का आयोजन।",
    area: "Jankipuram",
    address: "Janki Plaza, Jankipuram, Lucknow",
    addressHi: "जानकी प्लाज़ा, जानकीपुरम, लखनऊ",
    landmark: "Janki Plaza",
    // Hand-pinned: Ola couldn't find "Janki Plaza" specifically and
    // bounced the bare "Jankipuram" query to a centroid 7 km off
    // (south Talkatora). Pinned to Sector G/H by satellite review.
    lat: 26.9178,
    lng: 80.9445,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "11:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Janki Plaza",
    organizerPhone: "9999999991",
    photoSlug: "janki-plaza-jankipuram",
  },

  // 12) Patel Puram, Gomti Nagar Vistar — Anurag Singh Chauhan
  {
    slug: "patel-puram-bhandara-gomti-vistar",
    name: "Patel Puram Bhandara — Gomti Nagar Vistar",
    nameHi: "पटेल पुरम भंडारा — गोमती नगर विस्तार",
    description:
      "Sundarkand from 12:30 PM and Prasad Vitran from 2 PM, organised by Anurag Singh Chauhan, Advocate.",
    descriptionHi:
      "सुन्दरकांड प्रारम्भ दोपहर 12:30 बजे, प्रसाद वितरण दोपहर 2 बजे से।",
    area: "Gomti Nagar Extension",
    address:
      "Patel Puram, near Greenwood Apartment, under Brand Godam Bridge, Lift Hotel, Gomti Nagar Vistar, Lucknow",
    addressHi:
      "पटेल पुरम, निकट ग्रीनवुड अपार्टमेन्ट, ब्रॉड गोदाम ब्रिज के नीचे, लिफ्ट होटल, गोमती नगर विस्तार, लखनऊ",
    landmark: "Near Greenwood Apartment, under Brand Godam Bridge",
    // Ola geocode: Satlaj Apartment, Greenwood Ave, Sector 4 Gomti
    // Nagar Vistar — same complex named in the invite.
    lat: 26.8342,
    lng: 81.0059,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "12:30",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Anurag Singh Chauhan, Advocate",
    organizerPhone: "9999999990",
    photoSlug: "patel-puram-gomti-vistar",
  },

  // 13) Virendra Construction, Verma Market, BBD, Tiwariganj — 6 PM
  {
    slug: "virendra-construction-bbd-tiwariganj",
    name: "Sundarkand & Prasad Bhandara — Tiwariganj",
    nameHi: "सुंदरकांड एवं प्रसाद भंडारा — तिवारीगंज",
    description:
      "Prasad Bhandara from 6 PM at Virendra Construction & Electrical, Verma Market, BBD, Tiwariganj.",
    descriptionHi:
      "शाम 6 बजे से प्रसाद भंडारा — वीरेंद्र कंस्ट्रक्शन एंड इलेक्ट्रिकल।",
    area: "Chinhat",
    address:
      "Virendra Construction & Electrical, Shop N-9, Verma Market, BBD, Tiwariganj, Lucknow",
    addressHi:
      "वीरेंद्र कंस्ट्रक्शन एंड इलेक्ट्रिकल, शॉप एन-9, वर्मा मार्केट, बीबीडी, तिवारीगंज, लखनऊ",
    landmark: "Verma Market, BBD",
    lat: 26.893,
    lng: 81.056,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "18:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Virendra Singh",
    organizerPhone: "8090700792",
    photoSlug: "virendra-bbd-tiwariganj",
  },

  // 14) Blackwood Family, Amar Shaheed Path, Vikrant Khand 2, Gomti Nagar
  {
    slug: "blackwood-family-vikrant-khand",
    name: "Blackwood Family Bhandara",
    nameHi: "ब्लैकवुड फैमिली भंडारा",
    description:
      "Sundarkand Path from 9 AM and Bhandara from 1 PM, hosted by the Blackwood Family at Amar Shaheed Path, Vikrant Khand 2.",
    descriptionHi:
      "सुंदरकांड पाठ प्रातः 9 बजे, भंडारा दोपहर 1 बजे से।",
    area: "Gomti Nagar",
    address:
      "2/24, Amar Shaheed Path, Vikrant Khand 2, Gomti Nagar, Lucknow",
    addressHi:
      "2/24, अमर शहीद पथ, विक्रांत खंड 2, गोमती नगर, लखनऊ",
    landmark: "Amar Shaheed Path, Vikrant Khand 2",
    lat: 26.8645,
    lng: 80.996,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "09:00",
    menu: ["puri", "sabzi", "halwa", "prasad"],
    organizerName: "Blackwood Family",
    organizerPhone: "9999999989",
    photoSlug: "blackwood-vikrant-khand",
  },

  // 15) Shani Dev Mandir behind Hotel Clarks Avadh — Saturday 16 May (Shani Jayanti)
  {
    slug: "shani-janmotsav-clarks-avadh",
    name: "Shani Janmotsav Bhandara",
    nameHi: "शनि जन्मोत्सव भंडारा",
    description:
      "Bhandara on Shani Jayanti (Saturday 16 May 2026) at Shani Dev Mandir behind Hotel Clarks Avadh.",
    descriptionHi:
      "दिन शनिवार, 16 मई 2026 को भण्डारे का आयोजन — शनि देव मन्दिर, होटल क्लार्क अवध के पीछे।",
    area: "Hazratganj",
    address:
      "Shani Dev Mandir, behind Hotel Clarks Avadh, Lucknow",
    addressHi:
      "शनि देव मन्दिर, होटल क्लार्क अवध के पीछे, लखनऊ",
    landmark: "Behind Hotel Clarks Avadh",
    lat: 26.854,
    lng: 80.946,
    tuesdayDates: [SAT_16_MAY],
    timeStart: "11:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Shani Dev Mandir Trust",
    organizerPhone: "9999999988",
    photoSlug: "shani-mandir-clarks-avadh",
  },

  // 16) Mohan Mekin Gate, Daliganj — Tuesday 19 May 2026 (3rd Bada Mangal)
  {
    slug: "bada-mangal-mohan-mekin-daliganj",
    name: "Bada Mangal — Mohan Mekin Gate",
    nameHi: "बड़ा मंगल — मोहन मेकिन गेट",
    description:
      "Bada Mangal Bhandara at Mohan Mekin Gate, Bagshah Ji, Daliganj on 19 May 2026.",
    descriptionHi:
      "मोहन मेकिन गेट, बगशाह जी, डालीगंज लखनऊ — दिनांक 19 मई 2026।",
    area: "Daliganj",
    address: "Mohan Mekin Gate, Bagshah Ji, Daliganj, Lucknow",
    addressHi: "मोहन मेकिन गेट, बगशाह जी, डालीगंज लखनऊ",
    landmark: "Mohan Mekin Gate",
    lat: 26.874,
    lng: 80.929,
    tuesdayDates: [TUE_19_MAY],
    timeStart: "11:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Bagshah Ji Mandali",
    organizerPhone: "9999999987",
    photoSlug: "mohan-mekin-daliganj",
  },

  // 17) Hind Nagar Vyapar Mandal — Chungi Parag Road (Krishna Nagar zone)
  {
    slug: "hind-nagar-vyapar-mandal-chungi-parag",
    name: "Bada Mangal Bhandara — Hind Nagar Vyapar Mandal",
    nameHi: "बड़ा मंगल भंडारा — हिन्द नगर व्यापार मंडल",
    description:
      "Bada Mangal Bhandara hosted by Hind Nagar Vyapar Mandal at Chungi, Parag Road, Lucknow.",
    descriptionHi:
      "बड़ा मंगल भंडारा — आयोजक: हिन्द नगर व्यापार मंडल, चुंगी पराग रोड, लखनऊ।",
    area: "Krishna Nagar",
    address: "Chungi, Parag Road, Hind Nagar, Krishna Nagar, Lucknow",
    addressHi: "चुंगी, पराग रोड, हिन्द नगर, कृष्णा नगर, लखनऊ",
    landmark: "Chungi, Parag Road",
    // Ola Maps geocode: "Chungi - Parag Rd, Hind Nagar, Sector C1, LDA
    // Colony" — exact match for the invite's location.
    lat: 26.78433,
    lng: 80.89219,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "11:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Hind Nagar Vyapar Mandal",
    organizerPhone: "9999999986",
    photoSlug: "hind-nagar-vyapar-mandal",
  },

  // 18) Lucknow University Main Campus — Gate No. 3 & 4 parking, 12 May 12 PM
  {
    slug: "lucknow-university-main-campus-bhandara",
    name: "Bhandara — Lucknow University (Main Campus)",
    nameHi: "भंडारा — लखनऊ विश्वविद्यालय (मुख्य परिसर)",
    description:
      "Bada Mangal Bhandara at Lucknow University Main Campus parking between Gate No. 3 and 4. Prasad from 12 PM until Prabhu Iccha.",
    descriptionHi:
      "स्थान: लखनऊ विश्वविद्यालय (मेन कैंपस), गेट नंबर 3 और 4 की पार्किंग। समय: मंगलवार दोपहर 12 बजे से प्रभु इच्छा तक।",
    area: "University Road",
    address:
      "Lucknow University Main Campus, between Gate No. 3 & 4 parking, University Road, Lucknow",
    addressHi:
      "लखनऊ विश्वविद्यालय (मेन कैंपस), गेट नंबर 3 और 4 की पार्किंग, यूनिवर्सिटी रोड, लखनऊ",
    landmark: "LU Main Campus, between Gate No. 3 & 4",
    // Hand-set to the old/main LU campus on University Road. Ola's
    // geocoder kept resolving "Lucknow University" to the New Campus in
    // Jankipuram Extension, which is the wrong gate cluster.
    lat: 26.8702,
    lng: 80.9387,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "12:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Samast Bhakta Gan",
    organizerPhone: "9999999985",
    photoSlug: "lucknow-university-gate-3-4",
  },

  // 19) Hanuman Mandir near Civil Hospital, Mahanagar — Tue 12 May, 11 AM
  {
    slug: "hanuman-mandir-civil-hospital-mahanagar",
    name: "Vishal Bhandara — Hanuman Mandir, Mahanagar",
    nameHi: "विशाल भंडारा — हनुमान मंदिर, महानगर",
    description:
      "Vishal Bhandara on the second Bada Mangal at Hanuman Mandir, near Civil Hospital, Mahanagar.",
    descriptionHi:
      "ज्येष्ठ माह के दूसरे मंगलवार पर हनुमान मंदिर, निकट सिविल हॉस्पिटल, महानगर में विशाल भंडारे का आयोजन।",
    area: "Mahanagar",
    address:
      "Hanuman Mandir, near Civil Hospital, Mahanagar, Lucknow",
    addressHi:
      "हनुमान मंदिर, निकट सिविल हॉस्पिटल, महानगर, लखनऊ",
    landmark: "Near Civil Hospital, Mahanagar",
    // Ola Maps geocode → "Civil Hospital, Bhau Rao Devras Hospital,
    // Mandir Marg, Mahanagar Colony" — exact match for the invite.
    lat: 26.875276,
    lng: 80.953652,
    tuesdayDates: [TUE_12_MAY],
    timeStart: "11:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Samast Bhakta Gan",
    organizerPhone: "9999999984",
    photoSlug: "hanuman-mandir-mahanagar",
  },
];

async function main() {
  console.log("→ Wiping existing Spot rows…");
  const spotsDeleted = await prisma.spot.deleteMany({});
  console.log(`  ${spotsDeleted.count} spots deleted.`);

  console.log("→ Wiping existing Bhandara rows…");
  const bhandarasDeleted = await prisma.bhandara.deleteMany({});
  console.log(`  ${bhandarasDeleted.count} bhandaras deleted.`);

  console.log(`→ Inserting ${ROWS.length} WhatsApp bhandaras…`);
  for (const r of ROWS) {
    const googleMapsUrl = `https://www.google.com/maps?q=${r.lat},${r.lng}&z=18`;
    await prisma.bhandara.create({
      data: {
        slug: r.slug,
        name: r.name,
        nameHi: r.nameHi,
        description: r.description ?? null,
        descriptionHi: r.descriptionHi ?? null,
        address: r.address,
        addressHi: r.addressHi ?? null,
        area: r.area,
        landmark: r.landmark ?? null,
        lat: r.lat,
        lng: r.lng,
        tuesdayDates: JSON.stringify(r.tuesdayDates),
        timeStart: r.timeStart,
        timeEnd: r.timeEnd ?? "",
        menu: JSON.stringify(r.menu),
        menuHi: JSON.stringify(menuHiFor(r.menu)),
        organizerName: r.organizerName,
        organizerPhone: r.organizerPhone,
        photoUrl: `/uploads/whatsapp/${r.photoSlug}.jpg`,
        googleMapsUrl,
        status: "APPROVED",
        approvedAt: new Date(),
        isVerified: false,
      },
    });
    console.log(`  ✓ ${r.name}`);
  }

  console.log("✓ Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
