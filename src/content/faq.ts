/**
 * Bilingual FAQ source.
 *
 * Drives the visible <HomeFAQ /> accordion on the homepage + the
 * dedicated /faq page, plus the FAQPage JSON-LD (which lives in
 * src/lib/seo.ts and currently still hand-lists English copies of
 * the same questions, kept in sync manually, refactor target).
 *
 * Keep each answer under ~300 chars so Google SERPs don't truncate
 * the rich-snippet preview. Keep the visible answer the same as the
 * JSON-LD answer so the SERP excerpt matches the on-site text.
 */
export type FaqItem = {
  /** Stable id for `#anchor` deep-linking + React key. */
  id: string;
  questionEn: string;
  questionHi: string;
  answerEn: string;
  answerHi: string;
  /** Optional inline "read more" links shown directly below the
   *  answer. Each link routes to a deeper page that elaborates on
   *  the answer (e.g. the "what is Bada Mangal" FAQ links to the
   *  full /history page; "list a bhandara" links to the listing
   *  form). Keep the labels short (~3-5 words), they render as
   *  small chips. */
  relatedLinks?: ReadonlyArray<{
    href: string;
    labelEn: string;
    labelHi: string;
  }>;
};

export const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    id: "what-is-bada-mangal",
    questionEn: "What is Bada Mangal?",
    questionHi: "बड़ा मंगल क्या है?",
    answerEn:
      "Bada Mangal is the Tuesday community-meal tradition of Lucknow, observed every Tuesday of the Hindu month of Jyeshtha (May to June). Free bhandaras open across the city to feed everyone who comes through Hanuman Ji's blessing. The tradition is around 400 years old, dating back to Nawab Saadat Ali Khan's vow.",
    answerHi:
      "बड़ा मंगल लखनऊ की मंगलवार-सामुदायिक-भोज परंपरा है, जो हिंदू ज्येष्ठ माह (मई से जून) के हर मंगलवार को मनाई जाती है। हनुमान जी की कृपा से शहर भर में मुफ़्त भंडारे लगते हैं और हर आगंतुक को प्रसाद मिलता है। यह परंपरा लगभग 400 वर्ष पुरानी है, जो नवाब सआदत अली ख़ान की मनौती से जुड़ी हुई है।",
    relatedLinks: [
      {
        href: "/history",
        labelEn: "Read the full story",
        labelHi: "पूरी कहानी पढ़ें",
      },
    ],
  },
  {
    id: "why-eight-in-2026",
    questionEn: "Why are there 8 Bada Mangals in 2026?",
    questionHi: "2026 में 8 बड़े मंगल क्यों हैं?",
    answerEn:
      "Adhik Maas, the leap month that occurs roughly once every 19 years, adds an extra Tuesday to Jyeshtha in 2026. So instead of the usual 4 to 5 Tuesdays, Lucknow gets 8 Bada Mangals. The last time this happened was 2007; the next will be 2045.",
    answerHi:
      "अधिक मास, हर लगभग 19 वर्ष में एक बार आने वाला लीप-मास, 2026 में ज्येष्ठ माह में अतिरिक्त मंगलवार जोड़ देता है। तो सामान्य 4 से 5 मंगलवारों के बजाय लखनऊ को इस बार 8 बड़े मंगल मिल रहे हैं। पिछली बार यह 2007 में हुआ था; अगली बार 2045 में होगा।",
    relatedLinks: [
      {
        href: "/history",
        labelEn: "About Adhik Maas + the 2026 cycle",
        labelHi: "अधिक मास और 2026 चक्र के बारे में",
      },
    ],
  },
  {
    id: "next-bada-mangal",
    questionEn: "When is the next Bada Mangal in Lucknow?",
    questionHi: "लखनऊ में अगला बड़ा मंगल कब है?",
    answerEn:
      "The 2026 Bada Mangal Tuesdays are 5 May, 12 May, 19 May, 26 May, 2 June, 9 June, 16 June, and 23 June. The countdown on BadaMangal.com always shows the next upcoming one in real time.",
    answerHi:
      "2026 के बड़े मंगल मंगलवार हैं: 5 मई, 12 मई, 19 मई, 26 मई, 2 जून, 9 जून, 16 जून, और 23 जून। BadaMangal.com पर लगा countdown हमेशा अगला आने वाला बड़ा मंगल real-time में दिखाता है।",
    relatedLinks: [
      {
        href: "/",
        labelEn: "See the live countdown",
        labelHi: "live countdown देखें",
      },
      {
        href: "/archive",
        labelEn: "Past Tuesdays",
        labelHi: "बीते मंगलवार",
      },
    ],
  },
  {
    id: "find-bhandara-near-me",
    questionEn: "How do I find a Bada Mangal bhandara near me?",
    questionHi: "मेरे पास का बड़ा मंगल भंडारा कैसे ढूँढूँ?",
    answerEn:
      "Open the city map on BadaMangal.com, every listed bhandara appears as a pin with the menu, time window, and organiser details. Use the 'Bhandaras near me' button to filter to a 3 km radius around you, or tap any pin to get directions in one tap.",
    answerHi:
      "BadaMangal.com पर शहर का map खोलिए, हर सूचीबद्ध भंडारा एक पिन के रूप में दिखता है, उसके साथ मेन्यू, समय और आयोजक की जानकारी भी। 'पास के भंडारे' बटन से 3 कि.मी. के दायरे में filter कीजिए, या किसी भी पिन पर tap करके एक ही क्लिक में रास्ता पाइए।",
    relatedLinks: [
      {
        href: "/",
        labelEn: "Open the city map",
        labelHi: "शहर का map खोलें",
      },
    ],
  },
  {
    id: "food-served",
    questionEn: "What food is served at a Bada Mangal bhandara?",
    questionHi: "बड़े मंगल भंडारे में क्या भोजन परोसा जाता है?",
    answerEn:
      "Typical bhandara prasad includes puri, sabzi (often kala chana or aloo), halwa, kheer or rice-kheer, sometimes pulao, and water or sharbat. Each organiser's menu is listed on their bhandara card on the site, so visitors can plan what to expect.",
    answerHi:
      "आम बहंडारे का प्रसाद होता है: पूरी, सब्ज़ी (अक्सर काला चना या आलू), हलवा, खीर या चावल की खीर, कभी-कभी पुलाव, और पानी या शरबत। हर आयोजक का मेन्यू उनकी भंडारा-कार्ड पर साइट पर दर्ज है, ताकि आगंतुक पहले से अनुमान लगा सकें।",
  },
  {
    id: "is-free",
    questionEn: "Is participating in a Bada Mangal bhandara free?",
    questionHi: "क्या बड़े मंगल भंडारे में हिस्सा लेना मुफ़्त है?",
    answerEn:
      "Yes, every bhandara is free, open to anyone, and serves as long as the prasad lasts. The tradition is rooted in seva (selfless service); organisers cover all costs from their own resources or community donations.",
    answerHi:
      "हाँ, हर भंडारा बिल्कुल मुफ़्त है, सबके लिए खुला है, और जब तक प्रसाद रहता है तब तक चलता है। यह परंपरा सेवा-भाव पर आधारित है; आयोजक सारा ख़र्च अपने संसाधनों से या सामुदायिक सहयोग से उठाते हैं।",
    relatedLinks: [
      {
        href: "/history",
        labelEn: "The seva tradition",
        labelHi: "सेवा परंपरा के बारे में",
      },
    ],
  },
  {
    id: "list-own-bhandara",
    questionEn: "Can I list my own bhandara on BadaMangal.com?",
    questionHi: "क्या मैं अपना भंडारा BadaMangal.com पर list कर सकता/सकती हूँ?",
    answerEn:
      "Yes. Click 'List a bhandara' on the homepage and fill in the location, time, menu, and your contact details. The listing goes live on the city map within seconds; the team calls within 24 hours to phone-verify and add the green Verified badge.",
    answerHi:
      "हाँ। मुख्य पृष्ठ पर 'भंडारा list करें' पर click कीजिए और स्थान, समय, मेन्यू और संपर्क-विवरण भरिए। आपकी listing कुछ ही सेकंडों में शहर के map पर live हो जाएगी; टीम 24 घंटों में फ़ोन-सत्यापन के लिए call करती है और हरा 'Verified' बैज जोड़ देती है।",
    relatedLinks: [
      {
        href: "/list-bhandara",
        labelEn: "List your bhandara",
        labelHi: "अपना भंडारा list करें",
      },
    ],
  },
];
