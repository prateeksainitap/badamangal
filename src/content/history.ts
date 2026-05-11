// /history, long-form editorial content. Bilingual: each text field has
// `hi` and `en` variants and the page renders the active locale.

import type { Locale } from "@/content/strings";

export type Bilingual = { hi: string; en: string };
export type BilingualParas = { hi: string[]; en: string[] };

export function pickText(b: Bilingual, locale: Locale): string {
  return b[locale];
}
export function pickParas(b: BilingualParas, locale: Locale): string[] {
  return b[locale];
}

export type Hero = {
  kicker: Bilingual;
  hindiHeadline: string; // shown verbatim in both locales
  englishSubline: Bilingual;
};

export type SectionBlock = {
  kind: "section";
  id: string;
  number: number;
  heading: Bilingual;
  paragraphs: BilingualParas;
};

export type OpeningBlock = {
  kind: "opening";
  paragraphs: BilingualParas;
};

export type ClosingBlock = {
  kind: "closing";
  paragraphs: BilingualParas;
  benediction: string;
};

export type PullQuoteBlock = {
  kind: "pull-quote";
  text: Bilingual;
};

export type BannerBlock = {
  kind: "banner";
  src: string;
  alt: Bilingual;
  caption?: Bilingual;
};

export type TimelineMarker = {
  year: string;
  body: Bilingual;
  highlight?: boolean;
};

export type TimelineBlock = {
  kind: "timeline";
  kicker: Bilingual;
  markers: TimelineMarker[];
};

export type Block =
  | OpeningBlock
  | SectionBlock
  | PullQuoteBlock
  | BannerBlock
  | TimelineBlock
  | ClosingBlock;

export type HistoryDoc = {
  hero: Hero;
  chapterLabel: Bilingual;
  outroCard: {
    findCta: Bilingual;
    findBody: Bilingual;
    listCta: Bilingual;
    listBody: Bilingual;
  };
  blocks: Block[];
};

export const HISTORY: HistoryDoc = {
  hero: {
    kicker: {
      hi: "लखनऊ की चार सौ साल पुरानी परंपरा",
      en: "A 400-year-old Lucknow tradition",
    },
    hindiHeadline: "चार सौ साल से लखनऊ हर मंगलवार को थाली परोसता है।",
    englishSubline: {
      hi: "ज्येष्ठ के हर मंगलवार को लखनऊ चार सौ बरसों से अपनी थाली सजाता आ रहा है।",
      en: "Lucknow has been setting its table every Tuesday of Jyeshtha for four hundred summers.",
    },
  },

  chapterLabel: { hi: "अध्याय", en: "Chapter" },

  outroCard: {
    findCta: { hi: "पास का भंडारा", en: "Find a bhandara" },
    findBody: {
      hi: "नक़्शे पर शहर भर के भंडारे देखें →",
      en: "See every bhandara on the map →",
    },
    listCta: { hi: "भंडारा जोड़ें", en: "Add a bhandara" },
    listBody: {
      hi: "अपना भंडारा सूची में जोड़ें →",
      en: "Add yours to the listing →",
    },
  },

  blocks: [
    // ── OPENING (drop cap on the first letter) ───────────────────────────
    {
      kind: "opening",
      paragraphs: {
        en: [
          "Lucknow does not feel small in the month of Jyeshtha. Streets that usually thin out by mid-afternoon stay loud well past dusk; canopies bloom on footpaths in saffron and white; the air carries puris frying in three different mohallas at once. Tuesday, Mangalwar, becomes a city-wide kitchen, a city-wide langar, a city-wide remembrance. Strangers are fed. Families pool their stoves. Police chowkis pause to accept a plate. For one day a week, in the hottest month of the Hindu calendar, this old Awadhi capital insists that nobody who walks past should walk past hungry.",
          "This is Bada Mangal. The bigger Tuesday. And it is older than most people guess.",
        ],
        hi: [
          "ज्येष्ठ के महीने में लखनऊ छोटा नहीं लगता। जो सड़कें दोपहर बाद सूनी हो जाती थीं, वे शाम ढले तक भी गुलज़ार रहती हैं; पैदल पटरियों पर भगवा और सफ़ेद के पंडाल खिल उठते हैं; हवा में तीन अलग-अलग मोहल्लों की पूड़ियों की महक एक साथ तैरती है। मंगलवार पूरे शहर की रसोई बन जाता है, पूरे शहर का लंगर बन जाता है, पूरे शहर की याद बन जाता है। अजनबी पेट भरते हैं। परिवार अपने चूल्हे साझा करते हैं। थाने के सिपाही भी एक थाली रोक कर लेते हैं। हफ़्ते में एक दिन, साल के सबसे तपते महीने में, यह पुरानी अवधी राजधानी ज़िद कर बैठती है: कोई भी जो यहाँ से गुज़रे, वह भूखा न जाए।",
          "यह बड़ा मंगल है। बड़ा मंगलवार। और यह उतना ही पुराना है जितना ज़्यादातर लोग अंदाज़ा भी नहीं लगाते।",
        ],
      },
    },

    // ── 1, The Tuesday ─────────────────────────────────────────────────
    {
      kind: "section",
      id: "the-tuesday",
      number: 1,
      heading: { en: "The Tuesday", hi: "मंगलवार" },
      paragraphs: {
        en: [
          "Mangalwar (the day named for the planet Mars) has been associated with Hanuman Ji for as long as anyone has written about him. It is on a Tuesday in the month of Jyeshtha, the local tradition holds, that Hanuman first met Lord Rama in the forests of Kishkindha. Every Tuesday in this month therefore carries the imprint of that first meeting; every such Tuesday becomes Bada, the bigger one, the more auspicious one, a day on which devotion is not only personal but communal.",
          "In most of north India, this stays a quiet personal observance: a fast, a Chalisa, a visit to the local Hanuman temple. In Lucknow, somewhere between the eighteenth century and the present, it became something larger. It became civic.",
        ],
        hi: [
          "मंगलवार (मंगल ग्रह के नाम पर रखा गया दिन) हनुमान जी से उतना ही पुराना नाता रखता है जितना उन पर कुछ भी लिखा गया है। स्थानीय परंपरा कहती है कि ज्येष्ठ के एक मंगलवार को ही हनुमान जी की पहली भेंट किष्किंधा के वनों में श्री राम से हुई थी। इसीलिए इस महीने का हर मंगलवार उस पहली भेंट की छाप रखता है; हर ऐसा मंगल ‘बड़ा’ बन जाता है, अधिक शुभ, ऐसा दिन जब भक्ति केवल व्यक्तिगत नहीं रहती, सामुदायिक हो जाती है।",
          "उत्तर भारत के अधिकांश हिस्सों में यह व्रत व्यक्तिगत बना रहता है: एक उपवास, एक चालीसा, स्थानीय हनुमान मंदिर का दर्शन। पर लखनऊ में, कहीं अठारहवीं सदी और आज के बीच, यह कुछ बड़ा बन गया। यह नागरिक बन गया।",
        ],
      },
    },

    // ── 2, The Nawab and the Begum ─────────────────────────────────────
    {
      kind: "section",
      id: "nawab-and-begum",
      number: 2,
      heading: { en: "The Nawab and the Begum", hi: "नवाब और बेगम" },
      paragraphs: {
        en: [
          "The story almost everyone in Lucknow tells begins with the Nawab Saadat Ali Khan II, who ruled Awadh between 1798 and 1814. The Nawab's young son was gravely ill. His Begum (the local versions differ on her name, with several pointing to a woman remembered as Janaab-e-Aliya) vowed that if the boy recovered, she would build a Hanuman temple in his honour.",
          "The boy recovered. The Begum kept her word.",
          "A new Hanuman temple rose in what was then the open ground north of the old city, on land near a small village called Aliganj. It was inaugurated, by most accounts, on a Tuesday in Jyeshtha. To mark the day, food was distributed (a bhandara) to anyone who had walked there. The crowd was larger than expected. The food held out. The next year more people came, and more bhandaras were laid. The pattern set.",
        ],
        hi: [
          "लखनऊ में लगभग हर कोई जो कहानी सुनाता है, वह नवाब सआदत अली ख़ान (द्वितीय) से शुरू होती है, जिन्होंने 1798 से 1814 तक अवध पर शासन किया। नवाब का बेटा गंभीर रूप से बीमार था। उनकी बेगम (स्थानीय कथाओं में नाम अलग-अलग मिलता है, कुछ में जनाब-ए-आलिया कहा गया है) ने मनौती मानी कि बेटा ठीक हुआ तो वे उसके नाम पर हनुमान मंदिर बनवाएँगी।",
          "बेटा ठीक हुआ। बेगम ने वचन निभाया।",
          "पुराने शहर के उत्तर की खुली ज़मीन पर, अलीगंज नामक एक छोटे गाँव के पास, एक नया हनुमान मंदिर खड़ा हुआ। अधिकांश कथाओं के अनुसार उद्घाटन ज्येष्ठ के एक मंगलवार को हुआ। उस दिन की याद में पैदल पहुँचने वालों को भोजन बाँटा गया (एक भंडारा)। भीड़ अनुमान से बड़ी थी। भोजन कम नहीं पड़ा। अगले साल और लोग आए, और और भंडारे लगे। यह क्रम बैठ गया।",
        ],
      },
    },

    // ── 3, The first Aliganj temple ────────────────────────────────────
    {
      kind: "section",
      id: "first-aliganj-temple",
      number: 3,
      heading: { en: "The first Aliganj temple", hi: "पहला अलीगंज मंदिर" },
      paragraphs: {
        en: [
          'The Aliganj Hanuman Mandir, sometimes called the Naya Hanuman Mandir ("the new" Hanuman temple, to distinguish it from the older one nearby), became the geographic heart of Bada Mangal. Its arched gateway, its painted murti, its cool stone floor in the worst summer heat: these are the textures the festival carries forward. To this day, the streets around Aliganj swell into a mela on every Bada Mangal, with bhandara canopies running unbroken from the temple gate down toward the police chowki and beyond.',
          "The temple is not architecturally the largest in the city. It is religiously the centre of gravity.",
        ],
        hi: [
          "अलीगंज हनुमान मंदिर, जिसे कभी-कभी नया हनुमान मंदिर भी कहा जाता है (पास के पुराने मंदिर से अलग पहचान के लिए), बड़े मंगल का भौगोलिक हृदय बन गया। उसका मेहराबदार द्वार, उसकी रंगी हुई मूर्ति, सबसे भीषण गर्मी में भी ठंडा पत्थर का फ़र्श: ये वे बनावटें हैं जिन्हें यह त्यौहार आज भी अपने साथ लिए चलता है। आज भी हर बड़े मंगल को अलीगंज की गलियाँ मेले की तरह उमड़ती हैं, मंदिर के द्वार से शुरू होकर थाने तक भंडारों के पंडाल बिना रुके चलते हैं।",
          "यह मंदिर वास्तुकला के लिहाज़ से शहर का सबसे बड़ा नहीं है। पर धार्मिक रूप से यह लखनऊ का गुरुत्व-केंद्र है।",
        ],
      },
    },

    // ── BANNER A ────────────────────────────────────────────────────────
    {
      kind: "banner",
      src: "/illustrations/aliganj-dusk.png",
      alt: {
        en: "A painterly view of the Aliganj Hanuman Mandir courtyard at dusk in summer, with devotees walking toward the arched gateway and clay diyas glowing on the temple steps.",
        hi: "गर्मियों की शाम में अलीगंज हनुमान मंदिर के प्रांगण का चित्रात्मक दृश्य, मेहराबदार द्वार की ओर जाते भक्त और सीढ़ियों पर जलते हुए मिट्टी के दीये।",
      },
      caption: {
        en: "Aliganj at dusk",
        hi: "गोधूलि का अलीगंज",
      },
    },

    // ── 4, Bhandara as community ───────────────────────────────────────
    {
      kind: "section",
      id: "bhandara-as-community",
      number: 4,
      heading: { en: "Bhandara as community", hi: "भंडारा: सामूहिक रसोई" },
      paragraphs: {
        en: [
          "A bhandara is a community kitchen: at its simplest, a stove and a stack of plates and the conviction that you do not eat alone. In Sanatan Dharma, the act of feeding others is a form of seva, a service that elevates the giver as much as the receiver. In Lucknow, the bhandara grew from a single ritual at a single temple into a city-wide reflex.",
          "By the early twentieth century, families had begun setting up their own canopies on neighborhood corners. Shopkeepers did the same. Mohalla committees pooled funds for week-long arrangements. The food simplified into a few staples (puri, sabzi, halwa, sometimes biryani for the larger pandals, always sharbat and water for the heat), but the scale grew without limit.",
          "Today a typical Bada Mangal in Lucknow sees more than twenty thousand bhandaras across the city. More than forty lakh meals are served on a single day. There is no central organizer. There is no choreography. The city simply remembers.",
        ],
        hi: [
          "भंडारा एक सामूहिक रसोई है: सबसे सरल रूप में एक चूल्हा, थालियों का एक ढेर, और यह विश्वास कि आप अकेले नहीं खाते। सनातन धर्म में दूसरों को खिलाना सेवा है, ऐसी सेवा जो देने वाले को उतना ही ऊँचा उठाती है जितना पाने वाले को। लखनऊ में भंडारा एक मंदिर के एक अनुष्ठान से शुरू होकर पूरे शहर का सहज प्रतिवर्त बन गया।",
          "बीसवीं सदी की शुरुआत तक परिवारों ने मोहल्ले के नुक्कड़ों पर अपने पंडाल लगाने शुरू कर दिए थे। दुकानदार भी यही करने लगे। मोहल्ला समितियाँ सप्ताह भर के इंतज़ाम के लिए चंदा जोड़ने लगीं। भोजन कुछ मूल चीज़ों तक सिमट गया (पूड़ी, सब्ज़ी, हलवा, बड़े पंडालों में कभी-कभी बिरयानी, और गर्मी के लिए हमेशा शरबत और पानी), पर पैमाना बिना सीमा के बढ़ता रहा।",
          "आज एक सामान्य बड़े मंगल पर लखनऊ में बीस हज़ार से अधिक भंडारे लगते हैं। एक ही दिन में चालीस लाख से अधिक थालियाँ बँटती हैं। कोई केंद्रीय आयोजक नहीं है। कोई कोरियोग्राफ़ी नहीं है। शहर बस याद रखता है।",
        ],
      },
    },

    // ── 5, A festival of all faiths ────────────────────────────────────
    {
      kind: "section",
      id: "festival-of-all-faiths",
      number: 5,
      heading: { en: "A festival of all faiths", hi: "सबका त्यौहार" },
      paragraphs: {
        en: [
          "Bada Mangal is, in its origin and in its practice, an inclusive festival. The very building of the Aliganj temple, by a Begum's vow, sits at a crossroads of Awadh's pluralism. It is not lost on anyone who walks Lucknow's streets on a Tuesday in Jyeshtha that some of the most generous bhandaras are laid out by Muslim shopkeepers, who set up canopies offering chilled water and sharbat to anyone passing in the heat. Sikh families bring out langars. Christian neighbors arrive with cold lassi. The Lucknow Bada Mangal has, for two centuries, refused to be only one thing.",
          "It is one of the few large public Hindu festivals in India that visibly carries the city's older Ganga–Jamuni tradition forward. The Nawab Wajid Ali Shah, in the mid-nineteenth century, is recorded to have personally encouraged the Bada Mangal festivities at Aliganj. That gesture, a Shia Muslim ruler patronizing a Hanuman shrine, is the spine of the festival's modern character.",
        ],
        hi: [
          "बड़ा मंगल, अपनी उत्पत्ति में और अपने व्यवहार में, एक समावेशी त्यौहार है। एक बेगम की मनौती पर अलीगंज मंदिर का बनना ही अवध की बहुलवादी संस्कृति के चौराहे पर बैठा है। ज्येष्ठ के मंगलवार लखनऊ की सड़कों पर चलने वाले से छुपा नहीं रह पाता कि सबसे उदार भंडारों में कुछ मुसलमान दुकानदारों के लगाए हुए होते हैं, जो गर्मी में राहगीरों को ठंडा पानी और शरबत बाँटते हैं। सिख परिवार लंगर खोलते हैं। ईसाई पड़ोसी ठंडी लस्सी लेकर आते हैं। लखनऊ का बड़ा मंगल दो सदियों से ‘सिर्फ़ एक चीज़’ बने रहने से इनकार करता आया है।",
          "यह भारत के उन गिने-चुने बड़े सार्वजनिक हिंदू त्यौहारों में से है जो शहर की पुरानी गंगा-जमुनी परंपरा को आज भी ज़ाहिर तौर पर आगे ले जाते हैं। अभिलेखों में मिलता है कि नवाब वाजिद अली शाह ने उन्नीसवीं सदी के मध्य में अलीगंज के बड़े मंगल आयोजनों को व्यक्तिगत प्रोत्साहन दिया था। वह इशारा, एक शिया मुस्लिम शासक का हनुमान मंदिर को संरक्षण देना, इस त्यौहार के आधुनिक चरित्र की रीढ़ है।",
        ],
      },
    },

    // ── PULL QUOTE ───────────────────────────────────────────────────────
    {
      kind: "pull-quote",
      text: {
        en: "Lucknow's Bada Mangal is not a religion's festival. It is a city's promise.",
        hi: "लखनऊ का बड़ा मंगल किसी धर्म का त्यौहार नहीं; यह शहर का वचन है।",
      },
    },

    // ── BANNER B ────────────────────────────────────────────────────────
    {
      kind: "banner",
      src: "/illustrations/bhandara-line.png",
      alt: {
        en: "A long row of saffron and white bhandara canopies on a Lucknow street, hands of volunteers passing plates and cups of sharbat, marigold strings overhead, painterly summer light.",
        hi: "लखनऊ की एक सड़क पर भगवा और सफ़ेद भंडारा पंडालों की लंबी कतार, थाली और शरबत के प्याले बढ़ाते स्वयंसेवकों के हाथ, ऊपर गेंदे की लड़ियाँ, चित्रात्मक गर्मी की रोशनी।",
      },
      caption: {
        en: "The bhandara line",
        hi: "भंडारे की कतार",
      },
    },

    // ── 6, The summer's role ───────────────────────────────────────────
    {
      kind: "section",
      id: "summers-role",
      number: 6,
      heading: { en: "The summer's role", hi: "गर्मी की भूमिका" },
      paragraphs: {
        en: [
          "Jyeshtha falls in the worst stretch of the north Indian summer. Temperatures cross 42°C; the loo blows from the west; the city slows. Into this heat, the Bada Mangal pours its water. Free chilled sharbat, in tetra packs and steel glasses. Earthen matkas of cool water, refilled hourly. ORS, sometimes; a quiet modernization. Watermelons. Cucumber slices.",
          "The festival's deepest unwritten rule is that no one is turned away. A passer-by who stops at a sharbat stall is not asked who they are or where they come from. The cup is poured. The cup is drunk. The cup is handed back. That is the whole exchange. In the punishing heat of a Lucknow June, this is more than ritual: it is a practical kindness scaled across a city of three million people.",
        ],
        hi: [
          "ज्येष्ठ उत्तर भारत की गर्मी के सबसे कठिन हफ़्तों में पड़ता है। तापमान 42°C पार कर जाता है; पश्चिम से लू बहती है; शहर की गति धीमी पड़ जाती है। इसी गर्मी में बड़ा मंगल अपना पानी उँडेलता है। टेट्रा-पैक और स्टील के गिलासों में मुफ़्त ठंडा शरबत। मिट्टी के मटकों में ठंडा पानी, हर घंटे भरा हुआ। कभी-कभी ORS, एक चुपचाप किया गया आधुनिकीकरण। तरबूज़। खीरे की फाँकें।",
          "इस त्यौहार का सबसे गहरा अनकहा नियम यह है कि किसी को लौटाया नहीं जाता। शरबत के स्टॉल पर रुकने वाले राहगीर से नहीं पूछा जाता कि वह कौन है या कहाँ से आया है। प्याला भरा जाता है। प्याला पिया जाता है। प्याला लौटाया जाता है। यही पूरा लेन-देन है। लखनऊ की जून की मार में यह केवल अनुष्ठान नहीं रह जाता: यह तीस लाख लोगों के शहर भर में फैली एक व्यावहारिक करुणा है।",
        ],
      },
    },

    // ── 7, The modern day ──────────────────────────────────────────────
    {
      kind: "section",
      id: "the-modern-day",
      number: 7,
      heading: { en: "The modern day", hi: "आज का बड़ा मंगल" },
      paragraphs: {
        en: [
          "The contemporary Bada Mangal is an extraordinary act of distributed organization. Twenty thousand bhandaras do not coordinate themselves on paper. They coordinate by habit. Families pull funds. Local shopkeepers donate atta and oil. RWAs reserve street corners. Police arrange traffic. Corporate houses sponsor pandals. The Lucknow Municipal Corporation now provides a registration line, sweeps the streets after, and enables a baseline of order over what is otherwise a beautifully unruly civic event.",
          "The food has industrialized. The spirit has not. A child still walks home with a tilak on the forehead, holding a paper plate of halwa-puri.",
        ],
        hi: [
          "आज का बड़ा मंगल वितरित संगठन का असाधारण उदाहरण है। बीस हज़ार भंडारे काग़ज़ पर समन्वय नहीं करते। वे आदत से समन्वय करते हैं। परिवार पैसे जुटाते हैं। स्थानीय दुकानदार आटा-तेल दान करते हैं। RWA सड़क के कोने सुरक्षित रखती हैं। पुलिस यातायात संभालती है। कॉर्पोरेट घराने पंडाल प्रायोजित करते हैं। लखनऊ नगर निगम अब पंजीकरण की एक पंक्ति देता है, बाद में सड़कें साफ़ करता है, और जो वैसे एक सुंदर अराजक नागरिक आयोजन है, उसमें एक न्यूनतम व्यवस्था बना देता है।",
          "भोजन औद्योगिक हो गया है। भावना नहीं हुई है। आज भी एक बच्चा माथे पर तिलक लगाए, हलवा-पूड़ी की काग़ज़ की प्लेट हाथ में लिए घर लौटता है।",
        ],
      },
    },

    // ── TIMELINE ─────────────────────────────────────────────────────────
    {
      kind: "timeline",
      kicker: {
        en: "Two centuries, five turns",
        hi: "दो सदियाँ, पाँच मोड़",
      },
      markers: [
        {
          year: "1798–1814",
          body: {
            en: "Nawab Saadat Ali Khan and the founding vow.",
            hi: "नवाब सआदत अली ख़ान का काल और मनौती की शुरुआत।",
          },
        },
        {
          year: "~1854",
          body: {
            en: "Wajid Ali Shah's patronage of Aliganj.",
            hi: "वाजिद अली शाह का अलीगंज को संरक्षण।",
          },
        },
        {
          year: "1947",
          body: {
            en: "Independence; the festival absorbs new families displaced into Lucknow.",
            hi: "स्वाधीनता; त्यौहार लखनऊ में विस्थापित नए परिवारों को समाहित करता है।",
          },
        },
        {
          year: "2007",
          body: {
            en: "Lucknow Municipal Corporation begins formal coordination.",
            hi: "लखनऊ नगर निगम औपचारिक समन्वय शुरू करता है।",
          },
        },
        {
          year: "2026",
          body: {
            en: "The rare 8-Tuesday cycle, due to Adhik Maas in Jyeshtha.",
            hi: "ज्येष्ठ के अधिक मास के कारण आठ मंगलों का दुर्लभ चक्र।",
          },
          highlight: true,
        },
      ],
    },

    // ── 8, Why 2026 is rare ────────────────────────────────────────────
    {
      kind: "section",
      id: "why-2026-is-rare",
      number: 8,
      heading: { en: "Why 2026 is rare", hi: "2026 क्यों दुर्लभ है" },
      paragraphs: {
        en: [
          "The Hindu calendar is luni-solar. Roughly every nineteen years, the lunar month of Jyeshtha overlaps an additional intercalary month (Adhik Maas), and the count of Tuesdays inside it rises from the usual four or five to eight. 2026 is one of those years. Eight Bada Mangals. Eight times the city sets its table. Eight Tuesdays of remembrance for an event that began with a Begum's vow and has refused, across two centuries, to end.",
          "The dates: May 5, May 12, May 19, May 26, June 2, June 9, June 16, June 23.",
        ],
        hi: [
          "हिंदू पंचांग चांद्र-सौर है। लगभग हर उन्नीस वर्षों में ज्येष्ठ का चांद्र मास एक अतिरिक्त इंटरकलरी मास (अधिक मास) से जुड़ जाता है, और इसके अंदर मंगलवारों की संख्या सामान्य चार-पाँच से बढ़कर आठ हो जाती है। 2026 ऐसा ही एक वर्ष है। आठ बड़े मंगल। आठ बार शहर अपनी थाली सजाता है। आठ मंगलवार उस घटना की याद में, जो एक बेगम की मनौती से शुरू हुई और दो सदियों से रुकने से इनकार करती आई है।",
          "तिथियाँ: 5 मई, 12 मई, 19 मई, 26 मई, 2 जून, 9 जून, 16 जून, 23 जून।",
        ],
      },
    },

    // ── BANNER C ────────────────────────────────────────────────────────
    {
      kind: "banner",
      src: "/illustrations/eight-mandala.png",
      alt: {
        en: "An eight-pointed mandala composition: temple bell, clay diya, kadhai, marigold, glass of sharbat, open palm with a plate, Hanuman gada, and an open Chalisa, around a central saffron sun.",
        hi: "आठ कोनों वाला मंडल: मंदिर की घंटी, मिट्टी का दीया, कढ़ाई, गेंदा, शरबत का गिलास, थाली थामे हाथ, हनुमान गदा, खुली चालीसा, बीच में एक भगवा सूर्य।",
      },
      caption: {
        en: "Eight Tuesdays, one mandala",
        hi: "आठ मंगल, एक मंडल",
      },
    },

    // ── CLOSING ──────────────────────────────────────────────────────────
    {
      kind: "closing",
      paragraphs: {
        en: [
          "You do not need to be from Lucknow to walk into a Bada Mangal bhandara. You do not need to bring anything. You do not need to know the song the speaker is playing. You only need to be hungry, or thirsty, or in the heat, or simply curious. The plate will be handed to you. The water will be cool. Hanuman Ji will be on the wall, or on the speaker, or in the conversation around the next stove.",
          "Find a bhandara near you on the map. Or, if you have laid one yourself, tell the city where to find you.",
          "That is the whole platform. That is the whole tradition.",
        ],
        hi: [
          "बड़े मंगल भंडारे में चलने के लिए लखनऊ का होना ज़रूरी नहीं। कुछ साथ लाना ज़रूरी नहीं। यह जानना भी ज़रूरी नहीं कि स्पीकर पर कौन सा भजन बज रहा है। बस भूख होनी चाहिए, या प्यास, या गर्मी, या केवल जिज्ञासा। थाली आपके हाथ में होगी। पानी ठंडा होगा। हनुमान जी दीवार पर होंगे, या स्पीकर में, या अगले चूल्हे के पास हो रही बातचीत में।",
          "नक़्शे पर अपने पास का भंडारा खोजिए। और यदि आपने ख़ुद कोई लगाया है, तो शहर को बताइए कि आप कहाँ हैं।",
          "यही है पूरा प्लेटफ़ॉर्म। यही है पूरी परंपरा।",
        ],
      },
      benediction: "॥ जय श्री राम  ।  जय हनुमान ॥",
    },
  ],
};
