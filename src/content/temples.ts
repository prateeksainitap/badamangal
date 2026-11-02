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
    imagePath: "/illustrations/temples/v2/aliganj-naya-hanuman-wide.webp",
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
    imagePath: "/illustrations/temples/v2/aliganj-purana-hanuman-wide.webp",
    imagePrompt:
      "A wide painterly illustration of the Aliganj Purana Hanuman Mandir, the older companion shrine to the Naya Mandir. Quieter, more intimate composition than the flagship temple: a low, weathered stone temple wall, an old peepal tree throwing dappled shade across a worn courtyard stone, two clay diyas glowing on the threshold, marigold petals scattered on the steps. A solitary devotee with a covered head sits in profile near the doorway. Early-morning light, longer shadows, calm. Style: contemporary Indian gouache, soft ink outlines, visible brushwork, paper texture. Palette: cream, sindoor, Awadhi gold, ink-black outlines, peepal-leaf green for the tree. 16:9 aspect, 2400x1350. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Mood: contemplative, weathered, devotional.",
  },
  {
    slug: "hanuman-setu",
    name: {
      en: "Hanuman Setu Mandir, Daliganj",
      hi: "हनुमान सेतु मंदिर, डालीगंज",
    },
    altName: "Sankat Mochan, the riverside temple",
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
    imagePath: "/illustrations/temples/v2/hanuman-setu-wide.webp",
    imagePrompt:
      "A wide painterly illustration of Hanuman Setu Mandir on the banks of the Gomti river in Lucknow, viewed in long shot at golden hour. The temple's red-and-cream domes rise on a slight rise just before the bridge; a continuous line of bhandara canopies in saffron and white runs along the riverside walk; the steel girders of the Daliganj bridge hint into the upper-right corner. Foreground: clay matkas of cool water on a low wall, a row of shoes left at the temple entrance, a faint reflection of the temple in the river. Style: contemporary Indian gouache, soft ink outlines, visible brushwork. Palette: cream paper background, saffron, sindoor, gold, and a dusty river-blue (not cold cyan) for the Gomti. 16:9 aspect, 2400x1350. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Editorial summer-afternoon mood.",
  },
  {
    // Was "Sankat Mochan Hanuman Mandir, Hazratganj" at a Park Road pin
    // that no map or source could confirm (29 Oct 2026). The famous
    // Hazratganj Hanuman temple is the Dakshinmukhi Hanuman Mandir at the
    // GPO crossing on MG Marg (its own signboard, Google Maps, News18
    // Hindi 3 Mar 2025). The old slug 301s here (next.config.js).
    slug: "dakshinmukhi-hanuman-hazratganj",
    name: {
      en: "Dakshinmukhi Hanuman Mandir, Hazratganj",
      hi: "दक्षिणमुखी हनुमान मंदिर, हज़रतगंज",
    },
    altName: "The south-facing Hanuman",
    area: "Hazratganj",
    address: {
      en: "GPO crossing, Mahatma Gandhi Marg, Hazratganj, Lucknow 226001",
      hi: "जीपीओ चौराहा, महात्मा गांधी मार्ग, हज़रतगंज, लखनऊ 226001",
    },
    // Google Maps listing "Dakshinmukhi Hanuman Temple", RWWW+X63.
    lat: 26.8473972,
    lng: 80.9455313,
    timings: {
      en: "Open daily, with aarti in the morning and the evening",
      hi: "प्रतिदिन खुला, सुबह और शाम आरती",
    },
    badaMangal: {
      en: "Devotees queue for darshan through the day on every Bada Mangal, right at the heart of Hazratganj.",
      hi: "हर बड़े मंगल पर दिनभर दर्शन के लिए कतार लगती है, ठीक हज़रतगंज के बीचोंबीच।",
    },
    tuesdayCrowd: {
      en: "Very heavy on Tuesdays",
      hi: "मंगलवार को बहुत भीड़",
    },
    history: {
      en: "The Dakshinmukhi Hanuman Mandir stands at the GPO crossing on Mahatma Gandhi Marg, in the heart of Hazratganj. Its murti of Hanuman ji faces south, a rare form that devotees believe fulfils every wish, and that belief draws very heavy crowds every Tuesday and through Bada Mangal. Aarti is performed morning and evening. Local accounts of the temple's age differ, so we do not give a founding year here.",
      hi: "दक्षिणमुखी हनुमान मंदिर हज़रतगंज के बीचोंबीच, महात्मा गांधी मार्ग पर जीपीओ चौराहे पर स्थित है। यहाँ हनुमान जी की प्रतिमा दक्षिण की ओर मुख किए है, जो दुर्लभ रूप है, और भक्तों की मान्यता है कि यहाँ हर मनोकामना पूरी होती है। इसी आस्था से हर मंगलवार और बड़े मंगल पर बहुत भीड़ रहती है। सुबह और शाम आरती होती है। मंदिर की आयु को लेकर स्थानीय कथन अलग अलग हैं, इसलिए हम यहाँ स्थापना वर्ष नहीं लिख रहे।",
    },
    imagePath: "/illustrations/temples/v2/hazratganj-hanuman-wide.webp",
    imagePrompt:
      "Painted from real photos of the shrine (see Website redesign (29 Oct 2026)/Temple art (no text)/manifest.md): red pillars, blank fascia board, bells, striped awning, the banyan with flags behind, black and white kerb on MG Marg. Warm realistic gouache, no text.",
  },
  {
    // Replaced "Bada Hanuman Mandir, Khun Khun Ji Road" on 30 Oct 2026: no
    // map listing, photo or outside source used that name. This is the
    // Prachin Hanuman Garhi in the middle of Aminabad market (Google Maps
    // "Shri Hanuman Temple", RWWH+H4; its gate reads "प्राचीन श्री हनुमान
    // गढ़ी"). Facts from News18 Hindi, 5 Apr 2023. Not the small "Hanuman
    // Garhi Temple" shrine in the Latouche Road grain market. Old slug 301s.
    slug: "hanuman-garhi-aminabad",
    name: {
      en: "Prachin Hanuman Garhi, Aminabad",
      hi: "प्राचीन हनुमान गढ़ी, अमीनाबाद",
    },
    altName: "Lucknow's own Hanuman Garhi",
    area: "Aminabad",
    address: {
      en: "Hanuman Mandir Road, opposite Allahabad Bank, Aminabad market, Lucknow 226018",
      hi: "हनुमान मंदिर रोड, इलाहाबाद बैंक के सामने, अमीनाबाद बाज़ार, लखनऊ 226018",
    },
    // Google Maps listing "Shri Hanuman Temple" (श्री हनुमान मंदिर, अमीनाबाद), RWWH+H4.
    lat: 26.8464965,
    lng: 80.9278166,
    timings: {
      en: "Opens 5:00 AM, closes at noon, reopens 3:00 PM. Aarti at 8 AM and 8 PM",
      hi: "सुबह 5 बजे खुलता है, दोपहर 12 बजे बंद, शाम 3 बजे फिर खुलता है। आरती सुबह और शाम 8 बजे",
    },
    badaMangal: {
      en: "Right in the middle of Aminabad market, with open space outside for bhandaras.",
      hi: "अमीनाबाद बाज़ार के ठीक बीच, बाहर भंडारे के लिए खुली जगह।",
    },
    tuesdayCrowd: {
      en: "Busy, being in the heart of the market",
      hi: "बाज़ार के बीच होने से भीड़ रहती है",
    },
    history: {
      en: "Known as Lucknow's own Hanuman Garhi, this temple stands in the middle of Aminabad market. Devotees believe the Hanuman ji of Ayodhya's Hanuman Garhi is present here too, and people who vowed an offering at Ayodhya but cannot travel there offer it here instead. Besides Bajrangbali, it has shrines of Shri Ram, Mata Janaki and Lakshman, Durga and Lakshmi Narayan, and old carved figures on its walls. A stone dated 1910 is set in the temple, and devotees say the temple is older still; local belief holds that the Nawabs too came here for darshan. On Hanuman Jayanti it holds a bhandara, Chalisa and Sundar Kand path.",
      hi: "लखनऊ की अपनी हनुमान गढ़ी कहलाने वाला यह मंदिर अमीनाबाद बाज़ार के बीचोंबीच है। भक्तों की मान्यता है कि अयोध्या की हनुमान गढ़ी के हनुमान जी यहाँ भी विराजमान हैं, और जो लोग अयोध्या में मन्नत मानकर वहाँ नहीं जा पाते, वे यहीं चढ़ावा चढ़ाते हैं। बजरंगबली के साथ यहाँ श्री राम, माता जानकी और लक्ष्मण, भगवती दुर्गा और लक्ष्मी नारायण के भी दर्शन होते हैं, और दीवारों पर पुरानी आकृतियाँ हैं। मंदिर में 1910 का एक पत्थर लगा है, और भक्त बताते हैं कि मंदिर इससे भी पुराना है; मान्यता है कि नवाब भी यहाँ दर्शन को आते थे। हनुमान जयंती पर यहाँ भंडारा, चालीसा और सुंदरकांड पाठ होता है।",
    },
    imagePath: "/illustrations/temples/v2/aminabad-hanuman-garhi-wide.webp",
    imagePrompt:
      "Painted from real photos of the temple's orange gate (see Website redesign (29 Oct 2026)/Temple art (no text)/manifest.md). Warm realistic gouache, no text.",
  },
];

export const TEMPLE_BY_SLUG: Record<string, Temple> = Object.fromEntries(
  TEMPLES.map((t) => [t.slug, t]),
);
