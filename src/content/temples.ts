/**
 * Temple directory content for /resources/temples and /resources/temples/[slug].
 *
 * History blurbs are factual, sourced from widely-attested local accounts.
 * Timings are approximate, flag any discrepancies via the report link.
 */

export type Temple = {
  /** URL slug. */
  slug: string;
  /** Display names. */
  name: { en: string; hi: string };
  /** Short tag (e.g., "Naya Hanuman Mandir"). */
  altName?: string;
  /** Mapped to the AREAS list in src/lib/lucknow.ts when possible. */
  area: string;
  address: { en: string; hi: string };
  lat: number;
  lng: number;
  /** Daily timings in human form. */
  timings: { en: string; hi: string };
  /** What it's like specifically on a Bada Mangal. */
  badaMangal: { en: string; hi: string };
  /** Approximate Tuesday crowd estimate. */
  tuesdayCrowd: { en: string; hi: string };
  /** ~120-180 word factual history. */
  history: { en: string; hi: string };
  /** Phone numbers if known. */
  phone?: string;
  /** Optional notes. */
  notes?: { en: string; hi: string };
  /**
   * Path under /public the temple hero will eventually live at. The page
   * shows a styled placeholder until the file appears on disk; once the
   * asset lands at this path, the placeholder is replaced.
   */
  imagePath?: string;
  /**
   * Generation prompt used to produce the placeholder hero. Co-located so
   * a designer can lift the prompt next to the temple they're generating
   * for. Full master prompt set + tool tweaks live at
   * `upgrade/content/ai-image-prompts.md` §5b.
   */
  imagePrompt?: string;
};

export const TEMPLES: Temple[] = [
  {
    slug: "aliganj-naya-hanuman",
    name: {
      en: "Aliganj Naya Hanuman Mandir",
      hi: "अलीगंज नया हनुमान मंदिर",
    },
    altName: "The Begum's temple",
    area: "Aliganj",
    address: {
      en: "Sector A, Aliganj, near Mahanagar Extension, Lucknow 226024",
      hi: "सेक्टर A, अलीगंज, महानगर एक्सटेंशन के पास, लखनऊ 226024",
    },
    // Coords geocoded against Ola Maps, matches "Naya Hanuman Mandir,
    // Kursi Rd, Mahanagar Extension, Shadab Colony, Lucknow 226024".
    lat: 26.8838,
    lng: 80.9497,
    timings: {
      en: "Daily darshan 5:00 AM – 12:00 PM, 4:00 PM – 10:30 PM",
      hi: "नित्य दर्शन प्रातः 5:00 – दोपहर 12:00, सायं 4:00 – रात्रि 10:30",
    },
    badaMangal: {
      en: "The flagship of the city. Lines extend past the police chowki by mid-morning. Bhandaras run unbroken along the approach roads. Parking near the stadium gate.",
      hi: "शहर का प्रमुख स्थल। प्रातः से ही पंक्ति पुलिस चौकी तक पहुँच जाती है। पहुँच मार्ग पर भंडारा सतत चलता है। पार्किंग स्टेडियम गेट के पास।",
    },
    tuesdayCrowd: {
      en: "Lakhs of devotees across the day; peak between 10am and 6pm",
      hi: "दिनभर लाखों श्रद्धालु; भीड़ प्रातः 10 से सायं 6 के बीच चरम पर",
    },
    history: {
      en: "Built at the turn of the 19th century by the Begum of Nawab Saadat Ali Khan II in fulfilment of a vow taken when their young son fell gravely ill. Local oral tradition records that the boy recovered, and the Begum commissioned the temple in gratitude. Inaugurated, by the most-cited accounts, on a Tuesday in Jyeshtha, and a bhandara was held that day for everyone who walked there. The crowd was larger than expected, the food held out, and the next year more bhandaras came. Often called the Naya Hanuman Mandir to distinguish it from the older Hanuman shrine nearby.",
      hi: "19वीं शताब्दी के आरंभ में नवाब सआदत अली ख़ान द्वितीय की बेगम द्वारा निर्मित। मान्यता है कि उनके पुत्र की गंभीर बीमारी से स्वस्थ होने पर बेगम ने मनौती के रूप में यह मंदिर बनवाया था। उद्घाटन ज्येष्ठ के एक मंगलवार को हुआ और उसी दिन सभी आगंतुकों के लिए भंडारा किया गया। भीड़ अनुमान से कहीं अधिक रही, भोजन सब के लिए पर्याप्त रहा, और अगले वर्ष और भंडारे जुड़े। पास के पुराने हनुमान मंदिर से अलग पहचान के लिए इसे ‘नया हनुमान मंदिर’ कहा जाता है।",
    },
    notes: {
      en: "On Bada Mangal, traffic is restricted on the approach road. Cycle, walk, or use the stadium gate parking.",
      hi: "बड़े मंगल पर पहुँच मार्ग पर यातायात सीमित रहता है। साइकिल / पैदल जाना ठीक रहता है, या स्टेडियम गेट पार्किंग का प्रयोग करें।",
    },
    imagePath: "/illustrations/temples/aliganj-naya-hanuman.webp",
    imagePrompt:
      "A wide painterly illustration of the Aliganj Naya Hanuman Mandir in Lucknow on a Bada Mangal afternoon. Centred on the temple's distinctive arched saffron-and-cream gateway with a single tall white spire crowned by a saffron flag rising behind it. Foreground: an unbroken line of marigold-strung canopies receding down the approach road, the silhouettes of devotees walking toward the gate carrying small clay diyas. A gentle haze of incense and warm summer light drifts across the scene. Style: contemporary Indian gouache, visible brushwork, soft ink outlines. Palette: cream paper background, saffron orange, sindoor red, Awadhi gold, with a single accent of peepal-leaf green in the marigolds' leaves. 16:9 aspect, 2400x1350. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Editorial heritage feel.",
  },
  {
    slug: "aliganj-purana-hanuman",
    name: {
      en: "Aliganj Purana Hanuman Mandir",
      hi: "अलीगंज पुराना हनुमान मंदिर",
    },
    altName: "The older shrine",
    area: "Aliganj",
    address: {
      en: "Old Aliganj, Lucknow 226024",
      hi: "पुराना अलीगंज, लखनऊ 226024",
    },
    // Coords geocoded against Ola Maps, matches "Purana Hanuman Mandir,
    // Purani Khadra Chungi, Sector L, Aliganj, Lucknow 226024".
    lat: 26.8906,
    lng: 80.952,
    timings: {
      en: "Daily darshan 5:30 AM – 12:00 PM, 4:00 PM – 10:00 PM",
      hi: "नित्य दर्शन प्रातः 5:30 – दोपहर 12:00, सायं 4:00 – रात्रि 10:00",
    },
    badaMangal: {
      en: "Quieter than the Naya Mandir but no less beloved. Many older devotees prefer this temple for its calm and its associations with the original Bada Mangal observance.",
      hi: "नया मंदिर की तुलना में कम भीड़, परंतु उतना ही प्रिय। कई पुराने श्रद्धालु इसकी शांति और मूल बड़ा मंगल परंपरा से जुड़ाव के कारण यहीं आते हैं।",
    },
    tuesdayCrowd: {
      en: "Tens of thousands across the day",
      hi: "दिनभर हज़ारों की संख्या में श्रद्धालु",
    },
    history: {
      en: "The older Hanuman shrine of Aliganj, predating the 19th-century Begum-era temple. Local tradition associates it with sadhus and travellers who used the area as a resting point on the road north out of Lucknow. After the new temple was inaugurated, the older shrine continued, and continues, its quieter daily observance. The two together anchor the Aliganj corridor of Bada Mangal.",
      hi: "अलीगंज का पुराना हनुमान स्थल, बेगम-कालीन (19वीं सदी) नए मंदिर से भी पहले का। स्थानीय परंपरा के अनुसार यहाँ साधुओं और यात्रियों का विश्राम-स्थल था जो लखनऊ के उत्तर की ओर के मार्ग पर रहते थे। नए मंदिर के उद्घाटन के बाद भी यह शांत, नित्य पूजा-स्थल बना रहा। दोनों मिलकर अलीगंज के बड़ा मंगल गलियारे की धुरी हैं।",
    },
    imagePath: "/illustrations/temples/aliganj-purana-hanuman.webp",
    imagePrompt:
      "A wide painterly illustration of the Aliganj Purana Hanuman Mandir, the older companion shrine to the Naya Mandir. Quieter, more intimate composition than the flagship temple: a low, weathered stone temple wall, an old peepal tree throwing dappled shade across a worn courtyard stone, two clay diyas glowing on the threshold, marigold petals scattered on the steps. A solitary devotee with a covered head sits in profile near the doorway. Early-morning light, longer shadows, calm. Style: contemporary Indian gouache, soft ink outlines, visible brushwork, paper texture. Palette: cream, sindoor, Awadhi gold, ink-black outlines, peepal-leaf green for the tree. 16:9 aspect, 2400x1350. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Mood: contemplative, weathered, devotional.",
  },
  {
    slug: "hanuman-setu",
    name: {
      en: "Hanuman Setu Mandir, Daliganj",
      hi: "हनुमान सेतु मंदिर, डालीगंज",
    },
    altName: "The riverside temple",
    area: "Hanuman Setu",
    address: {
      en: "Hanuman Setu Marg, near Gomti riverbank, Daliganj, Lucknow 226020",
      hi: "हनुमान सेतु मार्ग, गोमती तट के पास, डालीगंज, लखनऊ 226020",
    },
    // Coords geocoded against Ola Maps, matches "Hanuman Setu Mandir,
    // Purana Haidarabad, Hasanganj, Lucknow 226007".
    lat: 26.8605,
    lng: 80.9376,
    timings: {
      en: "Daily darshan 5:00 AM – 12:30 PM, 3:30 PM – 10:30 PM",
      hi: "नित्य दर्शन प्रातः 5:00 – दोपहर 12:30, सायं 3:30 – रात्रि 10:30",
    },
    badaMangal: {
      en: "The riverside corridor leading to the temple becomes a continuous bhandara line. The bridge over the Gomti is closed to private vehicles for the day.",
      hi: "मंदिर तक जाने वाला नदी-तटीय गलियारा सतत भंडारा बन जाता है। गोमती पर के पुल पर निजी वाहनों का प्रवेश दिनभर बंद रहता है।",
    },
    tuesdayCrowd: {
      en: "Lakhs across the day; peak after sunset",
      hi: "दिनभर लाखों श्रद्धालु; सूर्यास्त के बाद अधिक भीड़",
    },
    history: {
      en: "Established in the 1960s by Neem Karoli Baba and his close devotees, the Hanuman Setu Mandir sits on the southern bank of the Gomti and grew into one of Lucknow's most visited Hanuman temples. The Tuesday and Saturday crowds are famously calm, owing to the temple's well-organized queue management. The site is associated with Neem Karoli Baba's emphasis on simple, repeated remembrance, a quality the temple's evening aarti carries to this day.",
      hi: "1960 के दशक में नीम करोली बाबा और उनके निकट भक्तों द्वारा स्थापित, हनुमान सेतु मंदिर गोमती के दक्षिण तट पर है और लखनऊ के सर्वाधिक दर्शनीय हनुमान मंदिरों में से एक बन चुका है। मंगलवार और शनिवार की भीड़ अपनी व्यवस्थित पंक्ति व्यवस्था के लिए जानी जाती है। यह स्थान नीम करोली बाबा की सरल, बारंबार स्मरण की परंपरा से जुड़ा है, जिसकी झलक आज भी संध्या आरती में दिखाई देती है।",
    },
    imagePath: "/illustrations/temples/hanuman-setu.webp",
    imagePrompt:
      "A wide painterly illustration of Hanuman Setu Mandir on the banks of the Gomti river in Lucknow, viewed in long shot at golden hour. The temple's red-and-cream domes rise on a slight rise just before the bridge; a continuous line of bhandara canopies in saffron and white runs along the riverside walk; the steel girders of the Daliganj bridge hint into the upper-right corner. Foreground: clay matkas of cool water on a low wall, a row of shoes left at the temple entrance, a faint reflection of the temple in the river. Style: contemporary Indian gouache, soft ink outlines, visible brushwork. Palette: cream paper background, saffron, sindoor, gold, and a dusty river-blue (not cold cyan) for the Gomti. 16:9 aspect, 2400x1350. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Editorial summer-afternoon mood.",
  },
  {
    slug: "sankat-mochan-hazratganj",
    name: {
      en: "Sankat Mochan Hanuman Mandir, Hazratganj",
      hi: "संकट मोचन हनुमान मंदिर, हज़रतगंज",
    },
    area: "Hazratganj",
    address: {
      en: "Off Vidhan Sabha Marg, Hazratganj, Lucknow 226001",
      hi: "विधान सभा मार्ग के पास, हज़रतगंज, लखनऊ 226001",
    },
    // Coords geocoded against Ola Maps, matches "Sankat Mochan Balaji
    // Maharaj Hanuman Mandir, Park Road, Hazratganj, Lucknow 226001".
    lat: 26.843946,
    lng: 80.94926,
    timings: {
      en: "Daily darshan 5:30 AM – 12:00 PM, 4:00 PM – 10:00 PM",
      hi: "नित्य दर्शन प्रातः 5:30 – दोपहर 12:00, सायं 4:00 – रात्रि 10:00",
    },
    badaMangal: {
      en: "The central-Lucknow gathering point. Walkable from Hazratganj market, with bhandaras lining the approach lanes and along Vidhan Sabha Marg.",
      hi: "लखनऊ के मध्य का संगम स्थल। हज़रतगंज बाज़ार से पैदल पहुँच सकते हैं; पहुँच गलियों और विधान सभा मार्ग पर भंडारे लगते हैं।",
    },
    tuesdayCrowd: {
      en: "High footfall through the day; office-hour devotees common",
      hi: "दिनभर अच्छी आवाजाही; ऑफ़िस-समय के श्रद्धालु अधिक",
    },
    history: {
      en: "A long-standing Hanuman shrine in central Lucknow, popular among office-going devotees and Hazratganj's daily visitors. The Sankat Mochan invocation, to the remover of difficulties, has made this temple a steady fixture of Tuesday and Saturday observance for generations of central-Lucknow residents. Restored several times across the 20th century without losing its compact, neighbourhood character.",
      hi: "लखनऊ के मध्य में स्थित यह प्राचीन हनुमान मंदिर ऑफ़िस-कामकाजी श्रद्धालुओं और हज़रतगंज के नित्य आगंतुकों में लोकप्रिय है। ‘संकट मोचन’, विघ्नहारी, के स्मरण ने इसे पीढ़ियों से मध्य-लखनऊ का मंगल और शनि का निश्चित स्थल बनाया है। 20वीं शताब्दी में कई बार जीर्णोद्धार हुआ, परंतु इसका मोहल्ला-चरित्र अक्षुण्ण रहा है।",
    },
    imagePath: "/illustrations/temples/sankat-mochan-hazratganj.webp",
    imagePrompt:
      "A wide painterly illustration of Sankat Mochan Hanuman Mandir in Hazratganj, Lucknow's central commercial heart, on a Bada Mangal afternoon. Composition: the temple's modest cream gateway sandwiched between Hazratganj's distinctive colonnaded shopfronts; a Bada Mangal bhandara line in saffron canopies running along the footpath; a 1950s-style storefront sign in painted Devanagari is suggested but not specifically readable; rickshaws and pedestrians fill the lane. Style: contemporary Indian gouache, urban-illustration sensibility, soft ink outlines, visible brushwork. Palette: cream, saffron, sindoor, Awadhi gold, with a hint of café-brown for the colonnade arches. 16:9 aspect, 2400x1350. No text legible enough to read, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Mood: dense, civic, warm.",
  },
  {
    slug: "bada-hanuman-khun-khun-ji",
    name: {
      en: "Bada Hanuman Mandir, Khun Khun Ji Road",
      hi: "बड़ा हनुमान मंदिर, खुनखुन जी रोड",
    },
    altName: "The old-city Hanuman",
    area: "Chowk",
    address: {
      en: "Khun Khun Ji Road, Chowk, Lucknow 226003",
      hi: "खुनखुन जी रोड, चौक, लखनऊ 226003",
    },
    // Coords geocoded against Ola Maps, matches the Khun-Khun Ji Road
    // corridor in Chowk; venue itself isn't separately indexed so the
    // pin lands on the same lane within ~150 m of the temple.
    lat: 26.8655,
    lng: 80.9107,
    timings: {
      en: "Daily darshan 5:30 AM – 12:00 PM, 4:00 PM – 9:30 PM",
      hi: "नित्य दर्शन प्रातः 5:30 – दोपहर 12:00, सायं 4:00 – रात्रि 9:30",
    },
    badaMangal: {
      en: "The old-city flavour of Bada Mangal, narrow lanes, corner sharbat stalls, gulab jamun in copper kadhais, mosque and mandir within a few hundred metres of each other.",
      hi: "पुराने शहर का बड़ा मंगल, सँकरी गलियाँ, मोड़ पर शरबत के स्टॉल, ताम्बे की कढ़ाई में गुलाब जामुन, और कुछ सौ क़दम पर ही मस्जिद और मंदिर, सब कुछ एक साथ।",
    },
    tuesdayCrowd: {
      en: "Tens of thousands; deeply local crowd",
      hi: "हज़ारों श्रद्धालु; गहरा स्थानीय जुड़ाव",
    },
    history: {
      en: "An old-city Hanuman shrine in the Chowk-Khun Khun Ji corridor, beloved of Lucknow's traditional shopkeeping families. The neighbourhood's pluralistic character, Hindu, Muslim, Sikh, Khatri-Punjabi families living within a few lanes of each other, shapes the bhandara culture here every Bada Mangal. The temple itself is unassuming, sized for the lane it sits on, and is revered for the continuity of practice across generations rather than any architectural showpiece.",
      hi: "पुराने शहर के चौक-खुनखुन जी गलियारे में स्थित यह हनुमान मंदिर लखनऊ के पारंपरिक व्यापारी परिवारों का प्रिय स्थल है। मोहल्ले का बहुलवादी चरित्र, हिंदू, मुस्लिम, सिख, खत्री-पंजाबी परिवार पास-पास की गलियों में बसे, यहाँ की बड़ा मंगल भंडारा संस्कृति को आकार देता है। मंदिर स्वयं सादगी भरा है, गली के अनुरूप, और पीढ़ियों से जारी पूजा-परंपरा के लिए श्रद्धेय है, किसी भव्य स्थापत्य के लिए नहीं।",
    },
    imagePath: "/illustrations/temples/bada-hanuman-khun-khun-ji.webp",
    imagePrompt:
      "A wide painterly illustration of the Bada Hanuman Mandir on Khun Khun Ji Road in old-city Chowk, Lucknow. Composition: a narrow bazaar gali at midday, jharokhas and ornamented Awadhi balconies leaning over the lane, the small temple's saffron arched entrance set into the row of shopfronts, a string of marigold lights overhead, a small bhandara stove with a kadhai of puris steaming on the temple step. Two children dart past in the foreground. Style: contemporary Indian gouache, visible brushwork, soft ink outlines, paper texture. Palette: cream paper, saffron, sindoor, Awadhi gold, ink-black, with a sandstone-rose accent for the old-city walls. 16:9 aspect, 2400x1350. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Mood: tight, nostalgic, lived-in.",
  },
];

export const TEMPLE_BY_SLUG: Record<string, Temple> = Object.fromEntries(
  TEMPLES.map((t) => [t.slug, t]),
);
