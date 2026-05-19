export type Locale = "hi" | "en";

type Dict = {
  siteName: string;
  taglineHero: string;
  taglineSub: string;
  cta: {
    findBhandara: string;
    listBhandara: string;
    getDirections: string;
    shareWhatsapp: string;
    sponsorPlates: string;
    callOrganizer: string;
    backHome: string;
  };
  countdown: {
    rareCycleHeading: string;
    rareCycleBody: string;
    rareCycleFactLabel: string;
    rareCycleFactPast: string;
    rareCycleFactNextLabel: string;
    rareCycleFactNext: string;
    nextBadaMangal: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    seasonComplete: string;
    /** Banner phrase rendered above the timer on a Bada Mangal day.
     *  Use `{ordinal}` as the placeholder, replaced at runtime with
     *  the ordinal phrase from `liveOrdinals`. e.g. "Today is the 2nd Bada Mangal". */
    liveToday: string;
    /** Ordinal phrases for "1st Bada Mangal" → "8th Bada Mangal".
     *  Length must equal BADA_MANGAL_DATES_2026.length (= 8). */
    liveOrdinals: readonly string[];
    timelineKicker: string;
    timelineLabelPast: string;
    timelineLabelNext: string;
    timelineLabelFuture: string;
    timelineLabelLive: string;
    storyLeadHeading: string;
    storyLeadBody: string;
    storyLeadCta: string;
  };
  map: {
    /** Takes the total count (listed + live spots) so the heading
     *  can say "All 28 …" with a live, server-fresh number. */
    sectionHeading: (count: number) => string;
    sectionBody: string;
    legendOpen: string;
    legendClosed: string;
  };
  cards: {
    sectionHeading: string;
    timeAt: string;
    servesPerDay: string;
  };
  detail: {
    landmark: string;
    timeWindow: string;
    menu: string;
    capacity: string;
    capacityUnit: string;
    organizer: string;
    servingOn: string;
    sponsorAmount: string;
    photoPlaceholder: string;
    nearbyHeading: string;
    statusOpen: string;
    statusClosed: string;
    statusUpcoming: string;
    seasonOver: string;
    notFoundTitle: string;
    notFoundBody: string;
  };
  history: {
    teaserHeading: string;
    teaserBody: string;
    readMore: string;
  };
  nav: {
    home: string;
    findBhandara: string;
    story: string;
    resources: string;
    add: string;
    menu: string;
    closeMenu: string;
  };
  stats: {
    sectionKicker: string;
    sectionHeading: string;
    sectionBody: string;
    visitorPrefix: string;
    visitorSuffix: string;
    visitorAria: string;
    bhandarasListed: string;
    bhandarasSpotted: string;
    platesPledged: string;
    platesNote: string;
    areasCovered: string;
    tuesdaysSoFar: string;
    tuesdaysOf: string;
  };
  footer: {
    rights: string;
    seva: string;
    closing: string;
    discoverHeading: string;
    getInvolvedHeading: string;
    resourcesHeading: string;
    aboutHeading: string;
    discoverMap: string;
    discoverStory: string;
    discoverAreas: string;
    getInvolvedAdd: string;
    getInvolvedSponsor: string;
    getInvolvedFind: string;
    aboutContact: string;
    aboutPrivacy: string;
    aboutAdmin: string;
    contactEmail: string;
  };
  resources: {
    navLabel: string;
    hubKicker: string;
    hubHeading: string;
    hubBody: string;
    cards: {
      news: { title: string; body: string; cta: string };
      chalisa: { title: string; body: string; cta: string };
      aarti: { title: string; body: string; cta: string };
      ashtak: { title: string; body: string; cta: string };
      bajrangBaan: { title: string; body: string; cta: string };
      ramStuti: { title: string; body: string; cta: string };
      rituals: { title: string; body: string; cta: string };
      temples: { title: string; body: string; cta: string };
    };
    common: {
      sourceLabel: string;
      verifyingText: string;
      verifyingNote: string;
      readMore: string;
      listenLabel: string;
      watchLabel: string;
      readLabel: string;
      backToResources: string;
    };
    news: {
      heading: string;
      body: string;
      featuredKicker: string;
      relatedHeading: string;
      sourcePrefix: string;
      readOnSource: string;
      empty: string;
    };
    chalisa: {
      heading: string;
      kicker: string;
      body: string;
      sourceCaption: string;
    };
    aarti: {
      heading: string;
      kicker: string;
      body: string;
      sourceCaption: string;
    };
    ashtak: {
      heading: string;
      kicker: string;
      body: string;
      sourceCaption: string;
    };
    bajrangBaan: {
      heading: string;
      kicker: string;
      body: string;
      sourceCaption: string;
    };
    ramStuti: {
      heading: string;
      kicker: string;
      body: string;
      sourceCaption: string;
    };
    rituals: {
      heading: string;
      kicker: string;
      intro: string;
    };
    temples: {
      directoryHeading: string;
      directoryKicker: string;
      directoryBody: string;
      addressLabel: string;
      timingsLabel: string;
      tuesdayLabel: string;
      historyLabel: string;
      nearbyLabel: string;
      nearbyEmpty: string;
    };
    player: {
      play: string;
      pause: string;
      speedLabel: string;
      langLabel: string;
      langDeva: string;
      langRoman: string;
      langEnglish: string;
      audioComingSoon: string;
      videoComingSoon: string;
    };
  };
  areas: Record<string, string>;
};

const en: Dict = {
  siteName: "BadaMangal",
  taglineHero: "Where there is bhakti, there is bhandara.",
  taglineSub: "Lucknow's table is always set.",
  cta: {
    findBhandara: "Find a bhandara near me",
    listBhandara: "Add a bhandara",
    getDirections: "Get directions",
    shareWhatsapp: "Share on WhatsApp",
    sponsorPlates: "Sponsor 100 plates · ₹251",
    callOrganizer: "Call organizer",
    backHome: "Back to all bhandaras",
  },
  countdown: {
    rareCycleHeading: "8 Bada Mangals in 2026: the rarest cycle in 19 years",
    rareCycleBody: "Adhik Maas adds an extra Tuesday to the season. Eight chances to feed, host, and gather.",
    rareCycleFactLabel: "When this last happened",
    rareCycleFactPast: "2007",
    rareCycleFactNextLabel: "When it'll happen next",
    rareCycleFactNext: "2045",
    nextBadaMangal: "Next Bada Mangal on",
    days: "days",
    hours: "hours",
    minutes: "minutes",
    seconds: "seconds",
    seasonComplete: "The 2026 season is complete. Jai Hanuman.",
    liveToday: "Today is the {ordinal} Bada Mangal",
    liveOrdinals: ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"],
    timelineKicker: "Eight Tuesdays of 2026",
    timelineLabelPast: "Past",
    timelineLabelNext: "Next",
    timelineLabelFuture: "Upcoming",
    timelineLabelLive: "Live now",
    storyLeadHeading: "Why eight Tuesdays this season?",
    storyLeadBody: "Once every nineteen years, Adhik Maas adds a Tuesday to Jyeshtha. The four-hundred-year story of why Lucknow keeps the table set.",
    storyLeadCta: "Read the full story",
  },
  map: {
    sectionHeading: (count) =>
      `All ${count} Bada Mangal bhandaras in Lucknow, on one map`,
    sectionBody: "Tap any pin to see the menu, time, and how to get there.",
    legendOpen: "Open now",
    legendClosed: "Closed",
  },
  cards: {
    sectionHeading: "Bhandaras listed across the city",
    timeAt: "Serving from",
    servesPerDay: "plates / day",
  },
  detail: {
    landmark: "Landmark",
    timeWindow: "Serving hours",
    menu: "On the thali",
    capacity: "Capacity",
    capacityUnit: "plates",
    organizer: "Organized by",
    servingOn: "Serving on",
    sponsorAmount: "₹251 covers ~100 plates of puri-sabzi.",
    photoPlaceholder: "Photos coming soon",
    nearbyHeading: "Other bhandaras in",
    statusOpen: "Open now",
    statusClosed: "Closed today",
    statusUpcoming: "Next:",
    seasonOver: "Season complete",
    notFoundTitle: "Bhandara not found",
    notFoundBody: "This listing may have been moved or archived. Browse all bhandaras instead.",
  },
  history: {
    teaserHeading: "A 400-year-old tradition",
    teaserBody: "From Nawab Saadat Ali Khan's vow to today's mohalla committees. Read the full story.",
    readMore: "Read the story",
  },
  nav: {
    home: "Home",
    findBhandara: "Find a bhandara",
    story: "Story",
    resources: "Resources",
    add: "Add a bhandara",
    menu: "Menu",
    closeMenu: "Close menu",
  },
  stats: {
    sectionKicker: "The city, in numbers",
    sectionHeading: "Lucknow, this season",
    sectionBody:
      "A quiet civic miracle, kept by twenty thousand kitchens and counted plate by plate.",
    visitorPrefix: "Total visitors till now",
    visitorSuffix: "",
    visitorAria: "Total visitors till now",
    bhandarasListed: "Bhandaras listed so far",
    bhandarasSpotted: "Bhandaras spotted so far",
    platesPledged: "Plates pledged",
    platesNote: "across the 8 Tuesdays of this season",
    areasCovered: "Areas covered",
    tuesdaysSoFar: "Tuesdays served",
    tuesdaysOf: "of 8",
  },
  footer: {
    rights: "Made with seva for Lucknow.",
    seva: "By Hanuman Ji's grace, every Tuesday Lucknow becomes a single kitchen.",
    closing: "Jai Shri Ram. Jai Hanuman.",
    discoverHeading: "Discover",
    getInvolvedHeading: "Get involved",
    resourcesHeading: "Resources",
    aboutHeading: "About",
    discoverMap: "Bhandaras on Map",
    discoverStory: "The story",
    discoverAreas: "Areas of Lucknow",
    getInvolvedAdd: "List a Bhandara (Free)",
    getInvolvedSponsor: "Sponsor a pandal",
    getInvolvedFind: "Find a bhandara",
    aboutContact: "Contact",
    aboutPrivacy: "Privacy",
    aboutAdmin: "Admin",
    contactEmail: "namaste@badamangal.com",
  },
  resources: {
    navLabel: "Resources",
    hubKicker: "Read · listen · watch",
    hubHeading: "The Bada Mangal companion",
    hubBody:
      "The text, the aarti, the rituals, the temples, and what's happening in Lucknow this week. One place to keep coming back to.",
    cards: {
      news: {
        title: "This week in Lucknow",
        body: "Editor's-pick news from the city's biggest meal.",
        cta: "Read the news",
      },
      chalisa: {
        title: "Hanuman Chalisa",
        body: "All forty verses with audio, in Devanagari and Roman.",
        cta: "Read the Chalisa",
      },
      aarti: {
        title: "Hanuman Aarti",
        body: "Aarti Kije Hanuman Lala Ki, the song you'll hear at every bhandara.",
        cta: "Read the Aarti",
      },
      ashtak: {
        title: "Sankat Mochan Hanuman Ashtak",
        body: "Eight stanzas Tulsidas wrote in distress, sung when the path feels stuck.",
        cta: "Read the Ashtak",
      },
      bajrangBaan: {
        title: "Bajrang Baan",
        body: "A fierce, protective recitation, sung when one needs Hanuman Ji to act now.",
        cta: "Read the Baan",
      },
      ramStuti: {
        title: "Shri Ram Stuti",
        body: "Tulsidas's five-stanza praise of Shri Ram, sung at every Hanuman temple alongside the Aarti.",
        cta: "Read the Stuti",
      },
      rituals: {
        title: "Tuesday vrat guide",
        body: "What to do on a Bada Mangal, vrat, mantra, prasad, etiquette.",
        cta: "View the guide",
      },
      temples: {
        title: "Hanuman temples of Lucknow",
        body: "Aliganj, Hanuman Setu, Sankat Mochan and more, addresses, timings, history.",
        cta: "Browse the temples",
      },
    },
    common: {
      sourceLabel: "Source",
      verifyingText: "Listen along",
      verifyingNote:
        "Press play above and listen along; the verse-by-verse text will be published here shortly so you can read together with the audio.",
      readMore: "Read more",
      listenLabel: "Listen",
      watchLabel: "Watch",
      readLabel: "Read",
      backToResources: "← Back to all resources",
    },
    news: {
      heading: "This week in Lucknow",
      body: "Hand-picked stories from across the city, bhandaras, temples, civic notes, and Bada Mangal coverage worth bookmarking.",
      featuredKicker: "Featured story",
      relatedHeading: "More from this week",
      sourcePrefix: "Source",
      readOnSource: "Read on source",
      empty: "Nothing curated this week. Check back next Monday.",
    },
    chalisa: {
      heading: "Hanuman Chalisa",
      kicker: "Forty verses, two dohas",
      body:
        "Tulsidas's Hanuman Chalisa, the song every Lucknow bhandara plays. Press play to listen along; verse-by-verse text will appear here shortly.",
      sourceCaption: "Audio recording, with text",
    },
    aarti: {
      heading: "Hanuman Aarti",
      kicker: "Aarti Kije Hanuman Lala Ki",
      body:
        "The aarti you'll hear at every Bada Mangal bhandara, sung at sunset across the city. Press play to listen along.",
      sourceCaption: "Audio recording, with text",
    },
    ashtak: {
      heading: "Sankat Mochan Hanuman Ashtak",
      kicker: "Eight stanzas, one closing doha",
      body:
        "Tulsidas's eight-verse stotra to Hanuman Ji, recited when grief or obstacle feels immovable. Press play to listen along.",
      sourceCaption: "Audio recording, with text",
    },
    bajrangBaan: {
      heading: "Bajrang Baan",
      kicker: "An arrow of protection",
      body:
        "A vigorous recitation invoking Hanuman Ji's force in moments of fear or threat. Press play to listen along.",
      sourceCaption: "Audio recording, with text",
    },
    ramStuti: {
      heading: "Shri Ram Stuti",
      kicker: "Shri Ramachandra Kripalu Bhajamana",
      body:
        "Tulsidas's five-stanza praise of Shri Ram from the Ramcharitmanas, sung at every Hanuman temple alongside the Aarti. Press play to listen along.",
      sourceCaption: "Audio recording, with text",
    },
    rituals: {
      heading: "Tuesday vrat guide",
      kicker: "What to do on a Bada Mangal",
      intro:
        "A practical, faith-respecting guide for first-time observers. None of this is required, these are the customs Lucknow has carried for centuries. Use what feels right.",
    },
    temples: {
      directoryHeading: "Hanuman temples of Lucknow",
      directoryKicker: "The places where the city begins on a Tuesday",
      directoryBody:
        "Five temples define the geography of Bada Mangal in Lucknow. Each has its own crowd, its own corridor of bhandaras, its own quiet hour.",
      addressLabel: "Address",
      timingsLabel: "Daily timings",
      tuesdayLabel: "On Bada Mangal",
      historyLabel: "History",
      nearbyLabel: "Nearby bhandaras",
      nearbyEmpty: "No bhandaras listed in this area yet, be the first.",
    },
    player: {
      play: "Play",
      pause: "Pause",
      speedLabel: "Speed",
      langLabel: "Language",
      langDeva: "हिन्दी",
      langRoman: "Roman",
      langEnglish: "English",
      audioComingSoon: "Audio coming shortly.",
      videoComingSoon: "Video embed coming shortly.",
    },
  },
  areas: {
    Aishbagh: "Aishbagh",
    Alambagh: "Alambagh",
    Aliganj: "Aliganj",
    Aminabad: "Aminabad",
    "Bakshi Ka Talab": "Bakshi Ka Talab",
    Charbagh: "Charbagh",
    Chinhat: "Chinhat",
    Chowk: "Chowk",
    Daliganj: "Daliganj",
    Faizullaganj: "Faizullaganj",
    "Gomti Nagar": "Gomti Nagar",
    "Gomti Nagar Extension": "Gomti Nagar Extension",
    "Hanuman Setu": "Hanuman Setu",
    Hazratganj: "Hazratganj",
    "IIM Road": "IIM Road",
    "Indira Nagar": "Indira Nagar",
    Jankipuram: "Jankipuram",
    Kaiserbagh: "Kaiserbagh",
    Kalyanpur: "Kalyanpur",
    Kapoorthala: "Kapoorthala",
    "Krishna Nagar": "Krishna Nagar",
    Mahanagar: "Mahanagar",
    Mohanlalganj: "Mohanlalganj",
    Munshipulia: "Munshipulia",
    "Naka Hindola": "Naka Hindola",
    Nishatganj: "Nishatganj",
    Polytechnic: "Polytechnic",
    Rajajipuram: "Rajajipuram",
    "Sarojini Nagar": "Sarojini Nagar",
    "Sitapur Road": "Sitapur Road",
    "Sushant Golf City": "Sushant Golf City",
    Telibagh: "Telibagh",
    "University Road": "University Road",
    "Vibhuti Khand": "Vibhuti Khand",
    "Vikas Nagar": "Vikas Nagar",
    "Vrindavan Yojna": "Vrindavan Yojna",
  },
};

const hi: Dict = {
  siteName: "बड़ा मंगल",
  taglineHero: "जहाँ भक्ति, वहाँ भंडारा",
  taglineSub: "लखनऊ की रसोई हर मंगल को खुली है।",
  cta: {
    findBhandara: "पास का भंडारा ढूँढें",
    listBhandara: "अपना भंडारा जोड़ें",
    getDirections: "रास्ता देखें",
    shareWhatsapp: "व्हाट्सऐप पर भेजें",
    sponsorPlates: "100 थाली का सहयोग करें · ₹251",
    callOrganizer: "व्यवस्थापक को कॉल करें",
    backHome: "सभी भंडारे",
  },
  countdown: {
    rareCycleHeading: "2026 में 8 बड़े मंगल: 19 वर्षों में सबसे दुर्लभ चक्र",
    rareCycleBody: "अधिक मास के कारण इस ज्येष्ठ में एक अतिरिक्त मंगल। आठ अवसर भंडारे के, सेवा के, मिलने के।",
    rareCycleFactLabel: "पिछली बार",
    rareCycleFactPast: "2007",
    rareCycleFactNextLabel: "अगली बार",
    rareCycleFactNext: "2045",
    nextBadaMangal: "अगला बड़ा मंगल",
    // Live-day banner, `{ordinal}` is interpolated with one of
    // liveOrdinals below ("दूसरा", "तीसरा" …) at runtime.
    days: "दिन",
    hours: "घंटे",
    minutes: "मिनट",
    seconds: "सेकंड",
    seasonComplete: "इस वर्ष का चक्र पूरा हुआ। जय हनुमान।",
    liveToday: "आज {ordinal} बड़ा मंगल है",
    liveOrdinals: [
      "पहला",
      "दूसरा",
      "तीसरा",
      "चौथा",
      "पाँचवाँ",
      "छठा",
      "सातवाँ",
      "आठवाँ",
    ],
    timelineKicker: "2026 के आठ मंगलवार",
    timelineLabelPast: "बीत चुका",
    timelineLabelNext: "अगला",
    timelineLabelFuture: "आने वाले",
    timelineLabelLive: "अभी लाइव",
    storyLeadHeading: "इस साल आठ मंगल क्यों?",
    storyLeadBody: "हर उन्नीस वर्षों में अधिक मास ज्येष्ठ में एक अतिरिक्त मंगलवार जोड़ देता है। चार सौ साल पुरानी कहानी, जिसे लखनऊ हर मंगल जीता है।",
    storyLeadCta: "पूरी कहानी पढ़ें",
  },
  map: {
    sectionHeading: (count) =>
      `लखनऊ के सभी ${count} बड़े मंगल भण्डारे, एक नक़्शे पर`,
    sectionBody: "किसी भी पिन पर टैप करें: मेन्यू, समय और रास्ता देखें।",
    legendOpen: "अभी खुला है",
    legendClosed: "बंद",
  },
  cards: {
    sectionHeading: "शहर भर में सूचीबद्ध भंडारे",
    timeAt: "समय",
    servesPerDay: "थाली प्रतिदिन",
  },
  detail: {
    landmark: "स्थान चिह्न",
    timeWindow: "सेवा समय",
    menu: "थाली में",
    capacity: "क्षमता",
    capacityUnit: "थाली",
    organizer: "व्यवस्था",
    servingOn: "सेवा दिन",
    sponsorAmount: "₹251 में लगभग 100 लोगों का पूड़ी-सब्ज़ी का भोजन।",
    photoPlaceholder: "तस्वीरें जल्द ही",
    nearbyHeading: "इसी क्षेत्र के अन्य भंडारे:",
    statusOpen: "अभी खुला है",
    statusClosed: "आज बंद",
    statusUpcoming: "अगला:",
    seasonOver: "सत्र पूरा हुआ",
    notFoundTitle: "भंडारा नहीं मिला",
    notFoundBody: "यह सूची हटा दी गई है या उपलब्ध नहीं है। सभी भंडारों की सूची देखें।",
  },
  history: {
    teaserHeading: "400 वर्ष पुरानी परंपरा",
    teaserBody: "नवाब सआदत अली ख़ान की मनौती से आज की मोहल्ला समितियों तक की पूरी कहानी पढ़ें।",
    readMore: "कहानी पढ़ें",
  },
  nav: {
    home: "होम",
    findBhandara: "भंडारा खोजें",
    story: "कहानी",
    resources: "संसाधन",
    add: "भंडारा जोड़ें",
    menu: "मेन्यू",
    closeMenu: "बंद करें",
  },
  stats: {
    sectionKicker: "शहर, संख्याओं में",
    sectionHeading: "इस सीज़न का लखनऊ",
    sectionBody:
      "बीस हज़ार रसोइयों का शांत सामूहिक चमत्कार, एक-एक थाली से गिना हुआ।",
    visitorPrefix: "अब तक कुल आगंतुक",
    visitorSuffix: "",
    visitorAria: "अब तक कुल आगंतुक",
    bhandarasListed: "अब तक सूचीबद्ध भंडारे",
    bhandarasSpotted: "अब तक स्पॉट किए भंडारे",
    platesPledged: "थाली का संकल्प",
    platesNote: "इस सीज़न के 8 मंगलवारों में",
    areasCovered: "क्षेत्र शामिल",
    tuesdaysSoFar: "मंगल पूरे हुए",
    tuesdaysOf: "/ 8",
  },
  footer: {
    rights: "लखनऊ के लिए, सेवा भाव से।",
    seva: "हनुमान जी की कृपा से, हर मंगल लखनऊ एक रसोई बन जाता है।",
    closing: "जय श्री राम। जय हनुमान।",
    discoverHeading: "देखें",
    getInvolvedHeading: "जुड़ें",
    resourcesHeading: "संसाधन",
    aboutHeading: "हमारे बारे में",
    discoverMap: "नक़्शे पर भंडारे",
    discoverStory: "कहानी",
    discoverAreas: "लखनऊ के क्षेत्र",
    getInvolvedAdd: "अपना भंडारा सूचीबद्ध करें (फ्री)",
    getInvolvedSponsor: "पंडाल को सहयोग करें",
    getInvolvedFind: "पास का भंडारा",
    aboutContact: "संपर्क",
    aboutPrivacy: "गोपनीयता",
    aboutAdmin: "एडमिन",
    contactEmail: "namaste@badamangal.com",
  },
  resources: {
    navLabel: "संसाधन",
    hubKicker: "पढ़ें · सुनें · देखें",
    hubHeading: "बड़ा मंगल का साथी",
    hubBody:
      "चालीसा, आरती, पूजा-विधि, मंदिर और इस सप्ताह लखनऊ में हो रही गतिविधियाँ, सब कुछ एक ही जगह।",
    cards: {
      news: {
        title: "इस सप्ताह लखनऊ में",
        body: "शहर के सबसे बड़े भोज की चुनी हुई ख़बरें।",
        cta: "ख़बरें पढ़ें",
      },
      chalisa: {
        title: "हनुमान चालीसा",
        body: "चालीस दोहे और दो दोहावली, ऑडियो के साथ।",
        cta: "चालीसा पढ़ें",
      },
      aarti: {
        title: "हनुमान आरती",
        body: "हर भंडारे में जो आरती गूँजती है, पाठ, ऑडियो, वीडियो।",
        cta: "आरती पढ़ें",
      },
      ashtak: {
        title: "संकट मोचन हनुमान अष्टक",
        body: "तुलसीदास द्वारा रचित आठ अष्टक, संकट के समय पाठ की जाती हैं।",
        cta: "अष्टक पढ़ें",
      },
      bajrangBaan: {
        title: "बजरंग बाण",
        body: "तीव्र, रक्षात्मक पाठ, जब हनुमान जी से तुरंत सहायता चाहिए।",
        cta: "बाण पढ़ें",
      },
      ramStuti: {
        title: "श्री राम स्तुति",
        body: "तुलसीदास रचित पाँच पद की राम स्तुति, हर हनुमान मंदिर में आरती के साथ गाई जाती है।",
        cta: "स्तुति पढ़ें",
      },
      rituals: {
        title: "मंगलवार व्रत-विधि",
        body: "बड़े मंगल पर क्या करें, व्रत, मंत्र, प्रसाद, शिष्टाचार।",
        cta: "मार्गदर्शिका देखें",
      },
      temples: {
        title: "लखनऊ के हनुमान मंदिर",
        body: "अलीगंज, हनुमान सेतु, संकट मोचन, पते, समय और इतिहास।",
        cta: "मंदिर देखें",
      },
    },
    common: {
      sourceLabel: "स्रोत",
      verifyingText: "साथ में सुनें",
      verifyingNote:
        "ऊपर प्ले बटन दबाइए और साथ में सुनिए; पाठ की पंक्ति-दर-पंक्ति प्रति शीघ्र ही यहाँ प्रकाशित होगी, ताकि आप ऑडियो के साथ पढ़ सकें।",
      readMore: "और पढ़ें",
      listenLabel: "सुनें",
      watchLabel: "देखें",
      readLabel: "पढ़ें",
      backToResources: "← सभी संसाधन",
    },
    news: {
      heading: "इस सप्ताह लखनऊ में",
      body: "शहर भर से चुनी हुई कहानियाँ, भंडारे, मंदिर, नागरिक सूचनाएँ और बड़े मंगल से जुड़ी हर ज़रूरी ख़बर।",
      featuredKicker: "प्रमुख ख़बर",
      relatedHeading: "इस सप्ताह की और ख़बरें",
      sourcePrefix: "स्रोत",
      readOnSource: "मूल स्रोत पर पढ़ें",
      empty: "इस सप्ताह कुछ संकलित नहीं किया गया। अगले सोमवार फिर आएँ।",
    },
    chalisa: {
      heading: "हनुमान चालीसा",
      kicker: "चालीस दोहे, दो दोहावली",
      body:
        "तुलसीदास रचित हनुमान चालीसा, लखनऊ के हर भंडारे में गूँजती है। प्ले बटन दबाइए और साथ में सुनिए; पाठ शीघ्र ही यहाँ प्रकाशित होगा।",
      sourceCaption: "ऑडियो रिकॉर्डिंग, पाठ सहित",
    },
    aarti: {
      heading: "हनुमान आरती",
      kicker: "आरती कीजै हनुमान लला की",
      body:
        "हर बड़े मंगल भंडारे में, सूर्यास्त के समय गूँजने वाली आरती। मानक पाठ और सत्यापित ऑडियो शीघ्र।",
      sourceCaption: "ऑडियो रिकॉर्डिंग, पाठ सहित",
    },
    ashtak: {
      heading: "संकट मोचन हनुमान अष्टक",
      kicker: "आठ अष्टक, एक समापन दोहा",
      body:
        "तुलसीदास रचित अष्टक, संकट या बाधा की घड़ी में पाठ किया जाता है। प्ले बटन दबाइए और साथ में सुनिए।",
      sourceCaption: "ऑडियो रिकॉर्डिंग, पाठ सहित",
    },
    bajrangBaan: {
      heading: "बजरंग बाण",
      kicker: "रक्षा का बाण",
      body:
        "भय या संकट के क्षण में हनुमान जी की शक्ति का आह्वान। मानक पाठ और सत्यापित ऑडियो शीघ्र।",
      sourceCaption: "ऑडियो रिकॉर्डिंग, पाठ सहित",
    },
    ramStuti: {
      heading: "श्री राम स्तुति",
      kicker: "श्रीरामचन्द्र कृपालु भजुमन",
      body:
        "तुलसीदास रचित श्रीराम की पाँच-पद स्तुति, रामचरितमानस से। हर हनुमान मंदिर में आरती के साथ गाई जाती है।",
      sourceCaption: "ऑडियो रिकॉर्डिंग, पाठ सहित",
    },
    rituals: {
      heading: "मंगलवार व्रत-विधि",
      kicker: "बड़े मंगल पर क्या करें",
      intro:
        "नए श्रद्धालुओं के लिए एक सरल, श्रद्धा-सम्मान मार्गदर्शिका। यह कोई आदेश नहीं है, ये वही रीतियाँ हैं जो लखनऊ ने सदियों से निभाई हैं। जो ठीक लगे, अपनाइए।",
    },
    temples: {
      directoryHeading: "लखनऊ के हनुमान मंदिर",
      directoryKicker: "मंगलवार को शहर जहाँ से शुरू होता है",
      directoryBody:
        "लखनऊ के बड़े मंगल का भूगोल पाँच मंदिरों के इर्द-गिर्द बनता है। हर एक की अपनी भीड़, अपना भंडारा-गलियारा, अपना शांत क्षण।",
      addressLabel: "पता",
      timingsLabel: "नियमित समय",
      tuesdayLabel: "बड़े मंगल पर",
      historyLabel: "इतिहास",
      nearbyLabel: "आस-पास के भंडारे",
      nearbyEmpty: "इस क्षेत्र में अभी कोई भंडारा सूचीबद्ध नहीं, पहला आप ही हो जाइए।",
    },
    player: {
      play: "चलाएँ",
      pause: "रुकें",
      speedLabel: "गति",
      langLabel: "भाषा",
      langDeva: "हिन्दी",
      langRoman: "Roman",
      langEnglish: "English",
      audioComingSoon: "ऑडियो शीघ्र, किसी लखनऊ के पंडित का सत्यापित पाठ रिकॉर्ड किया जा रहा है।",
      videoComingSoon: "वीडियो शीघ्र।",
    },
  },
  areas: {
    Aishbagh: "ऐशबाग़",
    Alambagh: "आलमबाग़",
    Aliganj: "अलीगंज",
    Aminabad: "अमीनाबाद",
    "Bakshi Ka Talab": "बख्शी का तालाब",
    Charbagh: "चारबाग़",
    Chinhat: "चिनहट",
    Chowk: "चौक",
    Daliganj: "डालीगंज",
    Faizullaganj: "फ़ैज़ुल्लागंज",
    "Gomti Nagar": "गोमती नगर",
    "Gomti Nagar Extension": "गोमती नगर एक्सटेंशन",
    "Hanuman Setu": "हनुमान सेतु",
    Hazratganj: "हज़रतगंज",
    "IIM Road": "आईआईएम रोड",
    "Indira Nagar": "इंदिरा नगर",
    Jankipuram: "जानकीपुरम",
    Kaiserbagh: "कैसरबाग़",
    Kalyanpur: "कल्याणपुर",
    Kapoorthala: "कपूरथला",
    "Krishna Nagar": "कृष्णा नगर",
    Mahanagar: "महानगर",
    Mohanlalganj: "मोहनलालगंज",
    Munshipulia: "मुंशीपुलिया",
    "Naka Hindola": "नक्खास / हिंडोला",
    Nishatganj: "निशातगंज",
    Polytechnic: "पॉलिटेक्निक",
    Rajajipuram: "राजाजीपुरम",
    "Sarojini Nagar": "सरोजिनी नगर",
    "Sitapur Road": "सीतापुर रोड",
    "Sushant Golf City": "सुशांत गोल्फ़ सिटी",
    Telibagh: "तेलीबाग़",
    "University Road": "यूनिवर्सिटी रोड",
    "Vibhuti Khand": "विभूति खंड",
    "Vikas Nagar": "विकास नगर",
    "Vrindavan Yojna": "वृंदावन योजना",
  },
};

export const strings: Record<Locale, Dict> = { hi, en };
