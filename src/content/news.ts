/**
 * Editor's-pick news for /resources/news.
 *
 * Manually curated. Each entry must be sourced and link out, never
 * reproduce article body. Excerpts are 1-2 lines we write in our own
 * voice, paraphrasing the source's main point.
 *
 * Every entry carries a real, topical `image`. The page renders thumbnails
 * through the weserv.nl image proxy (see /resources/news page) so hot-link
 * blocks and Referer policies don't kill the visual. If a source's own
 * lead image is a default placeholder, we substitute a related, source-
 * appropriate image (e.g. Wajid Ali Shah's Wikipedia portrait for an
 * article about him).
 */

export type NewsEntry = {
  /** Stable slug for keys/anchors. */
  id: string;
  /** ISO date (YYYY-MM-DD) the story ran. */
  date: string;
  /** Our headline (we may rewrite for clarity, never copy verbatim). */
  headline: string;
  /** Hindi headline if we have one, optional. */
  headlineHi?: string;
  /** 1-2 line excerpt in our voice. Never paste from the source. */
  excerpt: string;
  excerptHi?: string;
  /** Source publication name. */
  source: string;
  /** Public link to the original article. */
  url: string;
  /** Thumbnail URL, required so every card has visual context. */
  image: string;
  imageAlt?: string;
  /** Mark a single weekly lead. */
  featured?: boolean;
  /** Optional: tag to filter by. */
  tag?: "bhandara" | "temple" | "civic" | "weather" | "tradition";
};

export const NEWS: NewsEntry[] = [
  // ── FEATURED ─────────────────────────────────────────────────────────────
  {
    id: "2026-04-24-knocksense-8-mangals-after-19-years",
    date: "2026-04-24",
    headline:
      "8 Bada Mangals after 19 years: why Lucknow celebrates it like no other",
    excerpt:
      "Knocksense's deep dive into the rare Adhik Maas cycle that gives Lucknow eight Tuesdays of Jyeshtha in 2026, and why the city's Hanuman bhakti turns into a civic festival.",
    excerptHi:
      "नॉकसेंस की विस्तृत रिपोर्ट: 19 वर्षों में लौटते अधिक मास के दुर्लभ चक्र के कारण 2026 में लखनऊ को मिल रहे हैं ज्येष्ठ के आठ मंगल, और शहर की हनुमान भक्ति एक नागरिक त्यौहार बन जाती है।",
    source: "Knocksense",
    url:
      "https://www.knocksense.com/lucknow/8-bada-mangals-after-19-years-heres-why-lucknow-celebrates-it-like-no-other/",
    image:
      "https://www.knocksense.com/wp-content/uploads/2026/04/bada-mangal-1140x570.png",
    imageAlt: "Lucknow Bada Mangal, saffron banners and Hanuman silhouette",
    featured: true,
    tag: "tradition",
  },

  // ── SECONDARY (right column, top fold) ───────────────────────────────────
  {
    id: "2026-05-02-patrika-jyeshtha-begins",
    date: "2026-05-02",
    headline:
      "Jyeshtha begins: a city gears up for eight Bada Mangals",
    headlineHi:
      "ज्येष्ठ शुरू: 8 बड़े मंगल की तैयारी में जुटा लखनऊ",
    excerpt:
      "Patrika reports the first weekend of pandal-building across Aliganj, Hanuman Setu and Hazratganj as Lucknow prepares for its rare 8-Tuesday season.",
    excerptHi:
      "पत्रिका की रिपोर्ट: अलीगंज, हनुमान सेतु और हज़रतगंज में पंडालों का निर्माण आरंभ, दुर्लभ 8-मंगल सत्र की तैयारी।",
    source: "Patrika",
    url:
      "https://www.patrika.com/lucknow-news/jyeshtha-month-begins-8-big-mangals-spark-devotion-wave-lucknow-gears-up-with-grand-preparations-20546029",
    image:
      "https://cms.patrika.com/wp-content/uploads/2026/05/2may01.webp",
    imageAlt: "Devotees inside a Lucknow Hanuman temple",
    tag: "bhandara",
  },
  {
    id: "2026-05-05-indiamix-gas-shortage",
    date: "2026-05-05",
    headline:
      "Gas-cylinder shortage dims the rauq of Lucknow's first Bada Mangal",
    headlineHi:
      "गैस सिलेंडर की किल्लत ने पहले बड़े मंगल भंडारों की रौनक फीकी की",
    excerpt:
      "IndiaMix reports that rising LPG prices and supply gaps forced several pandals to swap puri-sabzi for simpler, less-fuel-hungry prasad on the season's opening Tuesday.",
    excerptHi:
      "इंडियामिक्स की रिपोर्ट: एलपीजी की क़ीमतें और आपूर्ति में कमी के चलते कई पंडालों ने इस मंगल पूड़ी-सब्ज़ी की जगह कम ईंधन वाला सादा प्रसाद बाँटा।",
    source: "IndiaMix",
    url:
      "https://www.indiamix.in/state-news/uttar-pradesh/lucknow-news/gas-shortage-at-bada-mangal-bhandaras-dims-the-festivities-of-lucknows-grand-celebration/",
    image:
      "https://www.indiamix.in/wp-content/uploads/2026/05/1003731982-1024x683.avif",
    imageAlt: "A row of community-feast tents in Lucknow",
    tag: "bhandara",
  },
  {
    id: "2026-05-06-tv9hindi-jyeshtha-heat",
    date: "2026-05-06",
    headline:
      "Why Bada Mangal sits in the hottest month of the calendar",
    headlineHi:
      "आसमान से बरसती 'आग' के बीच क्यों पड़ते हैं बड़े मंगल",
    excerpt:
      "TV9 Hindi explains why Jyeshtha, north India's hottest stretch, is precisely when Hanuman seva matters most: water, sharbat and shade are the bhandara.",
    excerptHi:
      "टीवी9 हिंदी की व्याख्या: ज्येष्ठ की भीषण गर्मी में ही बड़े मंगल की सेवा सबसे कठिन और सबसे पुण्यदायी है, पानी, शरबत और छाया ही असली भंडारा हैं।",
    source: "TV9 Hindi",
    url:
      "https://www.tv9hindi.com/religion/jyeshtha-bada-mangal-2026-significance-of-hanuman-puja-in-jyeshtha-heat-and-8-auspicious-tuesdays-3776188.html",
    image:
      "https://images.tv9hindi.com/wp-content/uploads/2026/05/whatsapp-image-2026-05-06-at-9.52.25-am.jpeg?w=1280",
    imageAlt: "Devotees offering prayers at a Lucknow Hanuman temple",
    tag: "weather",
  },
  {
    id: "2026-05-05-panchjanya-bada-sandesh",
    date: "2026-05-05",
    headline:
      "The bigger message of Bada Mangal: devotion and cleanliness, hand in hand",
    headlineHi: "'बड़ा मंगल' का बड़ा संदेश",
    excerpt:
      "Panchjanya argues that Lucknow's centuries-old bhandara tradition increasingly pairs Hanuman bhakti with cleanliness drives and eco-friendly prasad.",
    excerptHi:
      "पंचजन्य का संपादकीय: लखनऊ की सदियों पुरानी भंडारा परंपरा अब हनुमान भक्ति के साथ-साथ स्वच्छता और पर्यावरण-अनुकूल प्रसाद को जोड़ती जा रही है।",
    source: "Panchjanya",
    url:
      "https://panchjanya.com/2026/05/05/468918/bharat/uttar-pradesh/the-grand-message-of-bada-mangal/",
    image:
      "https://panchjanya.com/wp-content/uploads/2026/05/rajpal-rawat1-9.webp",
    tag: "bhandara",
  },
  {
    id: "2025-05-13-devdiscourse-festivities-unite",
    date: "2025-05-13",
    headline:
      "Bada Mangal festivities unite devotees across Lucknow",
    excerpt:
      "DevDiscourse reports more than 400 community feasts across Lucknow on a single Bada Mangal, interfaith participation woven through the city's biggest meal.",
    source: "DevDiscourse",
    url:
      "https://www.devdiscourse.com/article/entertainment/3379705-bada-mangal-festivities-unite-devotees-across-lucknow",
    // DevDiscourse hosts on a private Azure blob (403 to non-CDN clients).
    // Substituted with the Lucknow district government's Aliganj Hanuman
    // Mandir photo, Aliganj is the geographic heart of Bada Mangal, so
    // this stays topical for the article.
    image:
      "https://cdn.s3waas.gov.in/s3310dcbbf4cce62f762a2aaa148d556bd/uploads/bfi_thumb/2024100815-scaled-qv937b0jxydutgju08757gsene5fo29tfvmc9ezhqi.jpg",
    imageAlt:
      "The Aliganj Hanuman Mandir, Lucknow, heart of the Bada Mangal corridor (photo: lucknow.nic.in)",
    tag: "tradition",
  },

  // ── TERTIARY (grid below) ────────────────────────────────────────────────
  {
    id: "2026-05-09-webdunia-why-bada-mangal",
    date: "2026-05-09",
    headline:
      "Why is Jyeshtha Tuesday called Bada Mangal? The two stories",
    headlineHi:
      "ज्येष्ठ मंगल को 'बड़ा मंगल' क्यों कहते हैं? जानें दो प्रसंग",
    excerpt:
      "Webdunia walks through the two scriptural anchors: Hanuman's first meeting with Rama at Rishyamuk, and his lesson in humility to Bhima, both placed on a Jyeshtha Tuesday.",
    excerptHi:
      "वेबदुनिया की कथा-व्याख्या: ऋष्यमूक पर्वत पर हनुमान-राम भेंट और भीम के अहंकार-भंजन की दोनों कथाएँ ज्येष्ठ मंगलवार से जुड़ी हैं।",
    source: "Webdunia",
    url:
      "https://hindi.webdunia.com/astrology-articles/bada-mangal-puja-shubh-muhurat-2026-126050400021_1.html",
    image:
      "https://wd-image.webdunia.com/processimg/720x/webp/_media/hi/img/article/2026-04/27/full/1777285038-8233.jpg",
    tag: "tradition",
  },
  {
    id: "2026-05-04-aajtak-wajid-ali-shah",
    date: "2026-05-04",
    headline:
      "The Muslim ruler behind Lucknow's Bada Mangal bhandara tradition",
    headlineHi:
      "कहानी उस मुस्लिम शासक की, जिसकी वजह से आज भी बड़े मंगल पर होते हैं भंडारे",
    excerpt:
      "AajTak retells the founding story: a Nawab's son, a vow at the Aliganj Hanuman temple, and a community-feast tradition the city has kept for two centuries.",
    excerptHi:
      "आजतक की कहानी: नवाब के पुत्र की बीमारी, अलीगंज हनुमान मंदिर में मनौती, और दो सदी से चली आ रही भंडारा परंपरा।",
    source: "AajTak",
    url:
      "https://www.aajtak.in/religion/news/story/bada-mangal-2026-nawab-wajid-ali-shah-lucknow-bhandara-hanuman-mandir-tvisu-dskc-2542123-2026-05-04",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Vajid_Ali_Shah.jpg/640px-Vajid_Ali_Shah.jpg",
    imageAlt: "A 19th-century portrait of Nawab Wajid Ali Shah of Awadh",
    tag: "tradition",
  },
  {
    id: "2026-05-05-amarujala-five-temples",
    date: "2026-05-05",
    headline: "Five Lucknow Hanuman temples to visit on Bada Mangal",
    headlineHi:
      "लखनऊ के पाँच हनुमान मंदिर, जहाँ बड़े मंगल पर दर्शन शुभ माने जाते हैं",
    excerpt:
      "Amar Ujala's traveller's guide to Aliganj's old and new Hanuman mandirs, Hanuman Setu at Daliganj, Sankat Mochan in Hazratganj, and the Khun Khun Ji Road temple in the old city.",
    excerptHi:
      "अमर उजाला की यात्रा-गाइड: अलीगंज के पुराने-नए हनुमान मंदिर, डालीगंज का हनुमान सेतु, हज़रतगंज का संकट मोचन और पुराने शहर का खुनखुन जी रोड मंदिर।",
    source: "Amar Ujala",
    url:
      "https://www.amarujala.com/lifestyle/travel/lucknow-bada-mangal-2026-visit-hanuman-mandir-in-lucknow-famous-temples-2026-05-05",
    image:
      "https://staticimg.amarujala.com/assets/images/2018/03/30/hanuman-ji_1522396989.jpeg",
    imageAlt: "A Hanuman idol garlanded with marigolds",
    tag: "temple",
  },
  {
    id: "2026-06-23-amarujala-eighth-mangal",
    date: "2026-06-23",
    headline:
      "A court of devotion on the eighth and final Bada Mangal",
    headlineHi: "आठवें और आख़िरी बड़े मंगल पर सजेगा भक्ति का दरबार",
    excerpt:
      "Amar Ujala on Lucknow's eighth and final Bada Mangal of this rare eight-Tuesday season, the temples, the bhandaras and the devotion filling the city today.",
    excerptHi:
      "इस दुर्लभ आठ-मंगल वर्ष का आख़िरी बड़ा मंगल, शहर के मंदिरों, भंडारों और भक्ति पर अमर उजाला की रिपोर्ट।",
    source: "Amar Ujala",
    url: "https://www.amarujala.com/lucknow/a-court-of-devotion-will-be-set-up-on-the-eighth-and-final-bada-mangal-lucknow-news-c-13-1-lko1028-1795956-2026-06-23",
    image:
      "https://staticimg.amarujala.com/assets/images/4cplus/2026/06/23/aathava-oura-aakhara-bugdha-magal-para-sajaga-bhakata-ka-tharabra_4b3c0a35c6b5e5df210efe7af205f30e.jpeg",
    imageAlt:
      "Decorated Hanuman temple on Lucknow's eighth and final Bada Mangal",
    tag: "tradition",
  },
  {
    id: "2025-05-22-lucknow-pulse-overview",
    date: "2025-05-22",
    headline: "Bada Mangal celebrations in Lucknow: a community-feast guide",
    excerpt:
      "Lucknow Pulse's overview of why the city's Tuesday-of-Jyeshtha festival is one of the country's clearest expressions of Ganga-Jamuni tehzeeb.",
    source: "Lucknow Pulse",
    url: "https://lucknowpulse.com/bada-mangal-lucknow/",
    image:
      "https://lucknowpulse.com/wp-content/uploads/2023/05/featured-image-400x340-1-1.jpg",
    tag: "tradition",
  },
  {
    id: "2019-06-08-amarujala-nawabs-tradition",
    date: "2019-06-08",
    headline:
      "How the Nawabs of Lucknow started the Bada Mangal bhandara tradition",
    headlineHi:
      "लखनऊ के नवाबों ने शुरू की थी बड़े मंगल पर भंडारे की प्रथा",
    excerpt:
      "Amar Ujala's photo essay on the two Aliganj Hanuman temples and the Nawabi-era origins of the city's Tuesday-feast tradition.",
    excerptHi:
      "अमर उजाला का फ़ोटो-निबंध: अलीगंज के दोनों हनुमान मंदिर और नवाबी काल में शुरू हुई शहर की मंगल-भंडारा परंपरा।",
    source: "Amar Ujala",
    url:
      "https://www.amarujala.com/photo-gallery/lucknow/nawabs-of-lucknow-had-started-tradition-of-bhandara-on-bada-mangal",
    image:
      "https://staticimg.amarujala.com/assets/images/2018/03/30/hanuman-ji_1522396989.jpeg",
    imageAlt: "Hanuman idol photographed inside an Aliganj temple",
    tag: "tradition",
  },
];
