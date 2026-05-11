import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Remaining 7 Bada Mangals after the launch on May 9, 2026.
const ALL_TUESDAYS = [
  "2026-05-12",
  "2026-05-19",
  "2026-05-26",
  "2026-06-02",
  "2026-06-09",
  "2026-06-16",
  "2026-06-23",
] as const;

const FIRST_THREE = ALL_TUESDAYS.slice(0, 3);
const LAST_THREE  = ALL_TUESDAYS.slice(4);
const ALTERNATE_A = [ALL_TUESDAYS[0], ALL_TUESDAYS[2], ALL_TUESDAYS[4], ALL_TUESDAYS[6]];
const ALTERNATE_B = [ALL_TUESDAYS[1], ALL_TUESDAYS[3], ALL_TUESDAYS[5]];

type SeedRow = {
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
  tuesdayDates: readonly string[];
  timeStart: string;
  timeEnd: string;
  menu: string[];
  menuHi: string[];
  organizerName: string;
  organizerPhone: string;
  organizerWhatsapp?: string;
  upiId?: string;
  isSponsored?: boolean;
};

const ROWS: SeedRow[] = [
  // ── Aliganj (4) · the heart of Bada Mangal ──────────────────────────────
  {
    slug: "aliganj-purani-hanuman-mandir-bhandara",
    name: "Purani Hanuman Mandir Bhandara",
    nameHi: "पुरानी हनुमान मंदिर भंडारा",
    description: "Lucknow's oldest Bada Mangal pandal: 12,000+ plates of puri-sabzi-halwa every Tuesday from 11am.",
    descriptionHi: "लखनऊ का सबसे पुराना बड़ा मंगल पंडाल: हर मंगलवार सुबह 11 से 12,000+ थाली पूड़ी-सब्ज़ी-हलवा।",
    area: "Aliganj",
    address: "Old Hanuman Mandir, Sector A, Aliganj, Lucknow",
    addressHi: "पुरानी हनुमान मंदिर, सेक्टर ए, अलीगंज, लखनऊ",
    landmark: "Aliganj police chowki",
    lat: 26.8966, lng: 80.9525,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:00", timeEnd: "16:00",
    menu: ["puri", "sabzi", "halwa", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा", "शरबत"],
    organizerName: "Aliganj Bhandara Samiti",
    organizerPhone: "+91 98390 11122",
    organizerWhatsapp: "919839011122",
    upiId: "aliganjsamiti@upi",
    isSponsored: true,
  },
  {
    slug: "aliganj-naya-mandir-bhandara",
    name: "Naya Hanuman Mandir Bhandara",
    nameHi: "नया हनुमान मंदिर भंडारा",
    area: "Aliganj",
    address: "New Hanuman Mandir, Sector E, Aliganj, Lucknow",
    addressHi: "नया हनुमान मंदिर, सेक्टर ई, अलीगंज, लखनऊ",
    lat: 26.9012, lng: 80.9568,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "10:30", timeEnd: "15:30",
    menu: ["puri", "sabzi", "boondi", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "बूँदी", "शरबत"],
    organizerName: "Naya Mandir Trust",
    organizerPhone: "+91 94155 22002",
    upiId: "nayamandir@upi",
  },
  {
    slug: "aliganj-sector-h-bhandara",
    name: "Sector H Mohalla Bhandara",
    nameHi: "सेक्टर एच मोहल्ला भंडारा",
    area: "Aliganj",
    address: "Sector H Park, Aliganj, Lucknow",
    addressHi: "सेक्टर एच पार्क, अलीगंज, लखनऊ",
    lat: 26.8915, lng: 80.9489,
    tuesdayDates: FIRST_THREE,
    timeStart: "11:00", timeEnd: "14:30",
    menu: ["puri", "sabzi", "kheer"],
    menuHi: ["पूड़ी", "सब्ज़ी", "खीर"],
    organizerName: "Sector H RWA",
    organizerPhone: "+91 98399 71010",
  },
  {
    slug: "aliganj-purania-vyapari-bhandara",
    name: "Purania Market Vyapari Bhandara",
    nameHi: "पुरानिया बाज़ार व्यापारी भंडारा",
    area: "Aliganj",
    address: "Purania Market, near Mandir Marg, Aliganj, Lucknow",
    addressHi: "पुरानिया बाज़ार, मंदिर मार्ग, अलीगंज, लखनऊ",
    lat: 26.8950, lng: 80.9500,
    tuesdayDates: ALTERNATE_A,
    timeStart: "12:00", timeEnd: "16:00",
    menu: ["puri", "sabzi", "lassi"],
    menuHi: ["पूड़ी", "सब्ज़ी", "लस्सी"],
    organizerName: "Purania Vyapar Mandal",
    organizerPhone: "+91 94151 88677",
    organizerWhatsapp: "919415188677",
    upiId: "puraniavm@upi",
  },

  // ── Hazratganj (3) ──────────────────────────────────────────────────────
  {
    slug: "hazratganj-gpo-chauraha-bhandara",
    name: "GPO Chauraha Bhandara",
    nameHi: "जी॰पी॰ओ॰ चौराहा भंडारा",
    description: "Hazratganj's central pandal at GPO crossing: sharbat stall and full thali through the afternoon.",
    descriptionHi: "हज़रतगंज के बीचों-बीच जी॰पी॰ओ॰ चौराहा पर दोपहर भर शरबत और पूरी थाली।",
    area: "Hazratganj",
    address: "Near GPO, Hazratganj, Lucknow",
    addressHi: "जी॰पी॰ओ॰ के पास, हज़रतगंज, लखनऊ",
    landmark: "Vidhan Sabha Marg",
    lat: 26.8540, lng: 80.9483,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "10:30", timeEnd: "15:00",
    menu: ["puri", "aloo-sabzi", "boondi", "sharbat"],
    menuHi: ["पूड़ी", "आलू सब्ज़ी", "बूँदी", "शरबत"],
    organizerName: "Ganj Vyapar Mandal",
    organizerPhone: "+91 94150 33344",
    organizerWhatsapp: "919415033344",
    upiId: "ganjvm@upi",
    isSponsored: true,
  },
  {
    slug: "hazratganj-jankipuram-extn-bhandara",
    name: "Sahara Ganj Sharbat Stall",
    nameHi: "सहारा गंज शरबत स्टॉल",
    area: "Hazratganj",
    address: "Outside Sahara Ganj Mall, Shahnajaf Road, Hazratganj, Lucknow",
    addressHi: "सहारा गंज मॉल के बाहर, शाहनजफ़ रोड, हज़रतगंज, लखनऊ",
    lat: 26.8525, lng: 80.9422,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:00", timeEnd: "17:00",
    menu: ["sharbat", "buttermilk"],
    menuHi: ["शरबत", "मठ्ठा"],
    organizerName: "Hazratganj Traders' Union",
    organizerPhone: "+91 99357 22188",
  },
  {
    slug: "hazratganj-residency-road-bhandara",
    name: "Residency Road Bhandara",
    nameHi: "रेज़िडेन्सी रोड भंडारा",
    area: "Hazratganj",
    address: "Residency Road, near British Residency, Lucknow",
    addressHi: "रेज़िडेन्सी रोड, ब्रिटिश रेज़िडेन्सी के पास, लखनऊ",
    lat: 26.8576, lng: 80.9396,
    tuesdayDates: ALTERNATE_B,
    timeStart: "11:30", timeEnd: "15:00",
    menu: ["puri", "sabzi", "halwa"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा"],
    organizerName: "Residency Hanuman Bhakt Mandal",
    organizerPhone: "+91 98382 14411",
  },

  // ── Aminabad (2) ────────────────────────────────────────────────────────
  {
    slug: "aminabad-ghantaghar-bhandara",
    name: "Ghantaghar Aminabad Bhandara",
    nameHi: "घंटाघर अमीनाबाद भंडारा",
    area: "Aminabad",
    address: "Ghantaghar Chauraha, Aminabad, Lucknow",
    addressHi: "घंटाघर चौराहा, अमीनाबाद, लखनऊ",
    landmark: "Aminabad market",
    lat: 26.8550, lng: 80.9314,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "10:00", timeEnd: "14:30",
    menu: ["puri", "sabzi", "imarti", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "इमरती", "शरबत"],
    organizerName: "Aminabad Vyapar Mandal",
    organizerPhone: "+91 99350 11788",
    upiId: "aminabadvm@upi",
  },
  {
    slug: "aminabad-mohan-market-bhandara",
    name: "Mohan Market Bhandara",
    nameHi: "मोहन मार्केट भंडारा",
    area: "Aminabad",
    address: "Mohan Market, Aminabad, Lucknow",
    addressHi: "मोहन मार्केट, अमीनाबाद, लखनऊ",
    lat: 26.8533, lng: 80.9300,
    tuesdayDates: FIRST_THREE,
    timeStart: "11:00", timeEnd: "15:00",
    menu: ["puri", "sabzi", "kheer"],
    menuHi: ["पूड़ी", "सब्ज़ी", "खीर"],
    organizerName: "Mohan Market Samiti",
    organizerPhone: "+91 94157 99220",
  },

  // ── Chowk (2) ───────────────────────────────────────────────────────────
  {
    slug: "chowk-akbari-gate-bhandara",
    name: "Akbari Gate Bhandara",
    nameHi: "अकबरी दरवाज़ा भंडारा",
    area: "Chowk",
    address: "Akbari Gate, Chowk, Lucknow",
    addressHi: "अकबरी दरवाज़ा, चौक, लखनऊ",
    landmark: "Tehri Kothi",
    lat: 26.8645, lng: 80.9165,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "10:00", timeEnd: "14:30",
    menu: ["puri", "sabzi", "imarti"],
    menuHi: ["पूड़ी", "सब्ज़ी", "इमरती"],
    organizerName: "Chowk Vyapar Mandal",
    organizerPhone: "+91 94155 44558",
    organizerWhatsapp: "919415544558",
  },
  {
    slug: "chowk-mansoor-nagar-bhandara",
    name: "Mansoor Nagar Bhandara",
    nameHi: "मंसूर नगर भंडारा",
    area: "Chowk",
    address: "Mansoor Nagar, Chowk, Lucknow",
    addressHi: "मंसूर नगर, चौक, लखनऊ",
    lat: 26.8662, lng: 80.9192,
    tuesdayDates: LAST_THREE,
    timeStart: "11:30", timeEnd: "15:00",
    menu: ["puri", "sabzi", "halwa"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा"],
    organizerName: "Mansoor Nagar Samiti",
    organizerPhone: "+91 98395 77001",
  },

  // ── Gomti Nagar (3) ─────────────────────────────────────────────────────
  {
    slug: "vibhuti-khand-bhandara",
    name: "Vibhuti Khand Bhandara",
    nameHi: "विभूति खंड भंडारा",
    area: "Gomti Nagar",
    address: "Vibhuti Khand, opp. Phoenix Mall, Gomti Nagar, Lucknow",
    addressHi: "विभूति खंड, फीनिक्स मॉल के सामने, गोमती नगर, लखनऊ",
    landmark: "Phoenix Palassio",
    lat: 26.8556, lng: 81.0143,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "12:00", timeEnd: "17:00",
    menu: ["puri", "chana", "halwa", "lassi"],
    menuHi: ["पूड़ी", "चना", "हलवा", "लस्सी"],
    organizerName: "Vibhuti Khand RWA",
    organizerPhone: "+91 90050 22211",
    organizerWhatsapp: "919005022211",
    upiId: "vkrwa@upi",
    isSponsored: true,
  },
  {
    slug: "vastu-khand-bhandara",
    name: "Vastu Khand Bhandara",
    nameHi: "वास्तु खंड भंडारा",
    area: "Gomti Nagar",
    address: "Vastu Khand, Gomti Nagar, Lucknow",
    addressHi: "वास्तु खंड, गोमती नगर, लखनऊ",
    lat: 26.8489, lng: 81.0083,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:00", timeEnd: "15:00",
    menu: ["puri", "sabzi", "kheer", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "खीर", "शरबत"],
    organizerName: "Vastu Khand Welfare",
    organizerPhone: "+91 99350 60002",
  },
  {
    slug: "patrakarpuram-bhandara",
    name: "Patrakarpuram Crossing Bhandara",
    nameHi: "पत्रकारपुरम चौराहा भंडारा",
    area: "Gomti Nagar",
    address: "Patrakarpuram Crossing, Gomti Nagar, Lucknow",
    addressHi: "पत्रकारपुरम चौराहा, गोमती नगर, लखनऊ",
    lat: 26.8628, lng: 81.0010,
    tuesdayDates: ALTERNATE_A,
    timeStart: "11:30", timeEnd: "16:00",
    menu: ["puri", "sabzi", "boondi"],
    menuHi: ["पूड़ी", "सब्ज़ी", "बूँदी"],
    organizerName: "Patrakarpuram Hanuman Mandal",
    organizerPhone: "+91 94151 33001",
  },

  // ── Indira Nagar (2) ────────────────────────────────────────────────────
  {
    slug: "indira-nagar-c-block-bhandara",
    name: "Indira Nagar C-Block Bhandara",
    nameHi: "इंदिरा नगर सी-ब्लॉक भंडारा",
    area: "Indira Nagar",
    address: "C-Block Park, Indira Nagar, Lucknow",
    addressHi: "सी-ब्लॉक पार्क, इंदिरा नगर, लखनऊ",
    lat: 26.8767, lng: 80.9930,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:30", timeEnd: "15:30",
    menu: ["puri", "sabzi", "kheer"],
    menuHi: ["पूड़ी", "सब्ज़ी", "खीर"],
    organizerName: "Indira Nagar Mohalla Samiti",
    organizerPhone: "+91 98381 99887",
    upiId: "innagar@upi",
  },
  {
    slug: "indira-nagar-bhutnath-bhandara",
    name: "Bhootnath Market Bhandara",
    nameHi: "भूतनाथ मार्केट भंडारा",
    area: "Indira Nagar",
    address: "Bhootnath Market, Indira Nagar, Lucknow",
    addressHi: "भूतनाथ मार्केट, इंदिरा नगर, लखनऊ",
    lat: 26.8741, lng: 81.0001,
    tuesdayDates: ALTERNATE_B,
    timeStart: "11:00", timeEnd: "14:30",
    menu: ["puri", "sabzi", "halwa"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा"],
    organizerName: "Bhootnath Vyapar Mandal",
    organizerPhone: "+91 94155 90003",
  },

  // ── Mahanagar (2) ───────────────────────────────────────────────────────
  {
    slug: "mahanagar-c-block-bhandara",
    name: "Mahanagar C-Block Bhandara",
    nameHi: "महानगर सी-ब्लॉक भंडारा",
    area: "Mahanagar",
    address: "C-Block Park, Mahanagar, Lucknow",
    addressHi: "सी-ब्लॉक पार्क, महानगर, लखनऊ",
    lat: 26.8773, lng: 80.9572,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:00", timeEnd: "15:00",
    menu: ["puri", "sabzi", "halwa", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा", "शरबत"],
    organizerName: "Mahanagar Hanuman Mandal",
    organizerPhone: "+91 98390 22115",
    organizerWhatsapp: "919839022115",
    upiId: "mahanagarmandal@upi",
  },
  {
    slug: "mahanagar-sector-c-bhandara",
    name: "Sector C Bhandara",
    nameHi: "सेक्टर सी भंडारा",
    area: "Mahanagar",
    address: "Sector C Park, Mahanagar, Lucknow",
    addressHi: "सेक्टर सी पार्क, महानगर, लखनऊ",
    lat: 26.8792, lng: 80.9605,
    tuesdayDates: FIRST_THREE,
    timeStart: "11:30", timeEnd: "14:30",
    menu: ["puri", "sabzi"],
    menuHi: ["पूड़ी", "सब्ज़ी"],
    organizerName: "Sector C Welfare Society",
    organizerPhone: "+91 94151 60201",
  },

  // ── Alambagh (2) ────────────────────────────────────────────────────────
  {
    slug: "alambagh-bus-stand-bhandara",
    name: "Alambagh Bus Stand Bhandara",
    nameHi: "आलमबाग़ बस स्टैंड भंडारा",
    area: "Alambagh",
    address: "Near Alambagh Bus Terminal, Kanpur Road, Lucknow",
    addressHi: "आलमबाग़ बस अड्डा, कानपुर रोड, लखनऊ",
    landmark: "Alambagh Metro",
    lat: 26.8033, lng: 80.9024,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:00", timeEnd: "15:00",
    menu: ["puri", "sabzi", "halwa", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा", "शरबत"],
    organizerName: "Alambagh Seva Samiti",
    organizerPhone: "+91 99350 70011",
    upiId: "alambaghseva@upi",
    isSponsored: true,
  },
  {
    slug: "alambagh-shri-shankar-bhandara",
    name: "Shri Shankar Mandir Bhandara",
    nameHi: "श्री शंकर मंदिर भंडारा",
    area: "Alambagh",
    address: "Shri Shankar Mandir, Singar Nagar, Alambagh, Lucknow",
    addressHi: "श्री शंकर मंदिर, सिंगार नगर, आलमबाग़, लखनऊ",
    lat: 26.8068, lng: 80.8989,
    tuesdayDates: ALTERNATE_A,
    timeStart: "10:30", timeEnd: "14:00",
    menu: ["puri", "sabzi", "kheer"],
    menuHi: ["पूड़ी", "सब्ज़ी", "खीर"],
    organizerName: "Singar Nagar Samiti",
    organizerPhone: "+91 94150 88300",
  },

  // ── University Road (2) ─────────────────────────────────────────────────
  {
    slug: "lu-tagore-marg-bhandara",
    name: "Tagore Marg LU Bhandara",
    nameHi: "टैगोर मार्ग LU भंडारा",
    area: "University Road",
    address: "Tagore Marg, near LU New Campus, Lucknow",
    addressHi: "टैगोर मार्ग, एल॰यू॰ नया परिसर के पास, लखनऊ",
    lat: 26.8717, lng: 80.9436,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:00", timeEnd: "15:00",
    menu: ["puri", "sabzi", "boondi"],
    menuHi: ["पूड़ी", "सब्ज़ी", "बूँदी"],
    organizerName: "LU Alumni Hanuman Bhakt Mandal",
    organizerPhone: "+91 94155 60011",
  },
  {
    slug: "kk-vihar-bhandara",
    name: "Kalyanpur Vihar Bhandara",
    nameHi: "कल्याणपुर विहार भंडारा",
    area: "University Road",
    address: "Kalyanpur Vihar, University Road, Lucknow",
    addressHi: "कल्याणपुर विहार, यूनिवर्सिटी रोड, लखनऊ",
    lat: 26.8682, lng: 80.9402,
    tuesdayDates: FIRST_THREE,
    timeStart: "11:30", timeEnd: "14:30",
    menu: ["puri", "sabzi"],
    menuHi: ["पूड़ी", "सब्ज़ी"],
    organizerName: "Kalyanpur Vihar RWA",
    organizerPhone: "+91 98390 41020",
  },

  // ── Hanuman Setu / Daliganj (1) ─────────────────────────────────────────
  {
    slug: "hanuman-setu-mandir-bhandara",
    name: "Hanuman Setu Mandir Bhandara",
    nameHi: "हनुमान सेतु मंदिर भंडारा",
    description: "The riverside Hanuman Setu mandir runs the longest sharbat seva in the city: 8am to sundown.",
    descriptionHi: "हनुमान सेतु मंदिर पर सुबह 8 बजे से शाम तक: शहर की सबसे लंबी शरबत सेवा।",
    area: "Hanuman Setu",
    address: "Hanuman Setu Mandir, Daliganj, Lucknow",
    addressHi: "हनुमान सेतु मंदिर, डालीगंज, लखनऊ",
    landmark: "Hanuman Setu bridge",
    lat: 26.8772, lng: 80.9459,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "08:00", timeEnd: "18:00",
    menu: ["puri", "sabzi", "halwa", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा", "शरबत"],
    organizerName: "Hanuman Setu Mandir Trust",
    organizerPhone: "+91 98380 11111",
    organizerWhatsapp: "919838011111",
    upiId: "hanumansetu@upi",
    isSponsored: true,
  },

  // ── Naka Hindola (1) ────────────────────────────────────────────────────
  {
    slug: "naka-hindola-bhandara",
    name: "Naka Hindola Bhandara",
    nameHi: "नक्खास हिंडोला भंडारा",
    area: "Naka Hindola",
    address: "Naka Hindola crossing, Lucknow",
    addressHi: "नक्खास हिंडोला चौराहा, लखनऊ",
    lat: 26.8366, lng: 80.9211,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "10:30", timeEnd: "14:00",
    menu: ["puri", "sabzi", "lassi"],
    menuHi: ["पूड़ी", "सब्ज़ी", "लस्सी"],
    organizerName: "Naka Vyapar Mandal",
    organizerPhone: "+91 94155 11900",
  },

  // ── Charbagh (1) ────────────────────────────────────────────────────────
  {
    slug: "charbagh-station-bhandara",
    name: "Charbagh Station Bhandara",
    nameHi: "चारबाग़ स्टेशन भंडारा",
    area: "Charbagh",
    address: "Outside Charbagh Railway Station, Lucknow",
    addressHi: "चारबाग़ रेलवे स्टेशन के बाहर, लखनऊ",
    landmark: "Charbagh Metro",
    lat: 26.8311, lng: 80.9234,
    tuesdayDates: ALL_TUESDAYS,
    timeStart: "11:00", timeEnd: "16:00",
    menu: ["puri", "sabzi", "halwa", "sharbat"],
    menuHi: ["पूड़ी", "सब्ज़ी", "हलवा", "शरबत"],
    organizerName: "Charbagh Yatri Seva Samiti",
    organizerPhone: "+91 98381 56700",
    organizerWhatsapp: "919838156700",
    upiId: "charbaghseva@upi",
  },
];

async function main() {
  console.log(`Seeding ${ROWS.length} bhandaras...`);
  await prisma.bhandara.deleteMany({});
  let i = 0;
  for (const row of ROWS) {
    const googleMapsUrl = `https://www.google.com/maps?q=${row.lat},${row.lng}&z=18`;
    await prisma.bhandara.create({
      data: {
        slug: row.slug,
        name: row.name,
        nameHi: row.nameHi,
        description: row.description ?? null,
        descriptionHi: row.descriptionHi ?? null,
        address: row.address,
        addressHi: row.addressHi ?? null,
        area: row.area,
        landmark: row.landmark ?? null,
        lat: row.lat,
        lng: row.lng,
        geoNeighborhood: row.area,
        geoDistrict: "Lucknow",
        geoState: "Uttar Pradesh",
        googleMapsUrl,
        tuesdayDates: JSON.stringify([...row.tuesdayDates]),
        timeStart: row.timeStart,
        timeEnd: row.timeEnd,
        menu: JSON.stringify(row.menu),
        menuHi: JSON.stringify(row.menuHi),
        organizerName: row.organizerName,
        organizerPhone: row.organizerPhone,
        organizerWhatsapp: row.organizerWhatsapp ?? null,
        upiId: row.upiId ?? null,
        status: "APPROVED",
        isSponsored: row.isSponsored ?? false,
        approvedAt: new Date(),
      },
    });
    i += 1;
  }
  console.log(`Inserted ${i} bhandaras.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
