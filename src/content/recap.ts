// /recap, the 2026 season recap. Long-form, bilingual, mostly static
// editorial content (like history.ts / famous-bhandaras.ts) plus a
// handful of numbers pulled live from getHomepageStats() at request
// time in page.tsx. Every figure below that is NOT live-sourced is a
// verified snapshot from real analytics (GA4, Search Console,
// Instagram Insights) captured during/just after the season, dated
// inline so nobody mistakes a June snapshot for a live number.

export type Bilingual = { hi: string; en: string };

export type RecapPressItem = {
  name: string;
  logo: string;
  freq: string;
  host: Bilingual;
  dateLabel: Bilingual;
};

export type RecapCity = {
  name: string;
  visits: number;
};

export const RECAP = {
  hero: {
    kicker: { hi: "सीज़न रिकैप · 2026", en: "Season recap · 2026" },
    badge: {
      hi: "दुर्लभ 8-मंगल वर्ष · अधिक मास",
      en: "Rare 8-Tuesday year · Adhik Maas",
    },
    headline: {
      hi: "बड़ा मंगल 2026, पूरा हुआ।",
      en: "Bada Mangal 2026 is complete.",
    },
    sub: {
      hi: "5 मई से 23 जून तक, आठ मंगलवार, एक शहर, और एक ऐप जिसे लखनऊ ने ख़ुद बनाया। यहाँ है इस सीज़न की पूरी कहानी, नंबरों में।",
      en: "May 5 to June 23. Eight Tuesdays, one city, one app that Lucknow built together. Here's the whole season, in numbers.",
    },
    dateRange: { hi: "5 मई – 23 जून 2026", en: "May 5 – June 23, 2026" },
  },

  headline: {
    kicker: { hi: "शहर ने क्या किया", en: "What the city did" },
    heading: { hi: "यह सीज़न, अभी तक", en: "This season, so far" },
    body: {
      hi: "ये आँकड़े लाइव डेटाबेस से अभी लिए गए हैं, यह वही सच्चाई है जो साइट पर हर वक़्त दिखती है।",
      en: "These numbers are pulled live from the database right now, the same truth the site shows every day.",
    },
  },

  growth: {
    kicker: { hi: "डिजिटल पहुँच", en: "Digital reach" },
    heading: { hi: "लखनऊ ने ऑनलाइन खोजा", en: "Lucknow searched, and found us" },
    body: {
      hi: "गूगल एनालिटिक्स और सर्च कंसोल से, लॉन्च (12 मई) से 24 जून तक की पुष्टि की गई संख्याएँ।",
      en: "Confirmed figures from Google Analytics and Search Console, from launch (May 12) through June 24.",
    },
    asOf: { hi: "24 जून 2026 तक", en: "as of June 24, 2026" },
    momLabel: { hi: "मासिक वृद्धि (मई → जून)", en: "Month-over-month growth (May → June)" },
    mayUsers: 1770,
    juneUsers: 6004,
    momPercent: 239,
    totalUsers: 8726,
    totalPageViews: 38929,
    mapViews: 18319,
    searchClicks: 4906,
    searchImpressions: 24804,
    searchCtr: 19.78,
    brandNote: {
      hi: "\"bada mangal.com\" और \"bhandara near me\" जैसी खोजों पर गूगल पर #1 रैंकिंग।",
      en: "#1 on Google for searches like \"bada mangal.com\" and \"bhandara near me\".",
    },
  },

  press: {
    kicker: { hi: "प्रेस", en: "Press" },
    heading: { hi: "एक हफ़्ते में तीन रेडियो स्टेशन", en: "Three radio stations, one week" },
    body: {
      hi: "जून के आख़िरी हफ़्ते में, लखनऊ के तीन सबसे बड़े रेडियो स्टेशनों ने बड़ामंगल की कहानी सुनी।",
      en: "In the last week of June, Lucknow's three biggest radio stations sat down with the BadaMangal story.",
    },
    items: [
      {
        name: "Radio Mirchi",
        logo: "/press/radio/radio-mirchi.jpg",
        freq: "98.3 FM",
        host: { hi: "आरजे ताशी के साथ", en: "with RJ Tashi" },
        dateLabel: { hi: "18 जून 2026", en: "June 18, 2026" },
      },
      {
        name: "Big FM",
        logo: "/press/radio/big-fm.png",
        freq: "94.3 FM",
        host: { hi: "आरजे पिंकी के साथ", en: "with RJ Pinky" },
        dateLabel: { hi: "22 जून 2026", en: "June 22, 2026" },
      },
      {
        name: "Fever FM",
        logo: "/press/radio/fever-fm.jpg",
        freq: "104.0 FM",
        host: { hi: "आरजे स्नेहा के साथ", en: "with RJ Sneha" },
        dateLabel: { hi: "23 जून · आठवाँ बड़ा मंगल", en: "June 23 · the 8th Bada Mangal" },
      },
    ] satisfies RecapPressItem[],
  },

  social: {
    kicker: { hi: "सोशल", en: "Social" },
    heading: { hi: "इंटरनेट ने नोटिस किया", en: "The internet noticed" },
    body: {
      hi: "लगभग 100 फ़ॉलोअर्स से शुरू हुआ अकाउंट, दस लाख से ज़्यादा व्यूज़ तक पहुँचा, लगभग पूरी पहुँच ऑर्गैनिक और नॉन-फ़ॉलोअर थी।",
      en: "An account that started with about 100 followers reached over a million views, almost entirely organic, almost entirely non-followers.",
    },
    igTotalViews: "1M+",
    igReached: 780000,
    igFollowersAtStart: 98,
    topReels: [
      { views: 498924, reached: 417188 },
      { views: 425870, reached: 343677 },
    ],
    redditViews: "10K+",
    redditNote: { hi: "r/lucknow पर एक पोस्ट", en: "one post on r/lucknow" },
  },

  geography: {
    kicker: { hi: "लखनऊ से आगे", en: "Beyond Lucknow" },
    heading: { hi: "शहर के बाहर से भी नज़रें", en: "Watched from outside the city too" },
    body: {
      hi: "ज़्यादातर लखनऊ (~73%), पर दिल्ली से बेंगलुरु तक, प्रवासी लखनवियों ने भी ऐप खोला।",
      en: "Mostly Lucknow (~73%), but from Delhi to Bengaluru, homesick Lucknowites tuned in too.",
    },
    cities: [
      { name: "Delhi", visits: 259 },
      { name: "Kanpur", visits: 189 },
      { name: "New Delhi", visits: 155 },
      { name: "Varanasi", visits: 150 },
      { name: "Prayagraj", visits: 114 },
      { name: "Bengaluru", visits: 88 },
      { name: "Noida", visits: 62 },
      { name: "Gorakhpur", visits: 54 },
      { name: "Mumbai", visits: 41 },
      { name: "Pune", visits: 35 },
    ] satisfies RecapCity[],
  },

  closing: {
    kicker: { hi: "जय हनुमान", en: "Jai Hanuman" },
    heading: {
      hi: "यह किसी कंपनी की सफलता नहीं है। यह लखनऊ की है।",
      en: "This isn't a company's success story. It's Lucknow's.",
    },
    body: {
      hi: "हर सूचीबद्ध भंडारा, हर स्पॉट की गई तस्वीर, हर फ़ॉरवर्ड किया गया पैम्फ़लेट, किसी न किसी ने भेजा। हमने बस नक़्शा बनाया।",
      en: "Every listed bhandara, every spotted photo, every forwarded pamphlet, someone sent it in. We just built the map.",
    },
    ctaMap: { hi: "इस सीज़न के भंडारे देखें", en: "See this season's bhandaras" },
    ctaStory: { hi: "पूरी कहानी पढ़ें", en: "Read the full story" },
    benediction: "॥ जय श्री राम · जय हनुमान ॥",
  },
} as const;
