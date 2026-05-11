/**
 * Tuesday vrat / puja vidhi guide for /resources/rituals.
 *
 * Plain factual tone. No proselytizing. No invented mantras.
 * Where a mantra is referenced (e.g., the simple seed-mantras),
 * we use only the most widely-attested forms; if you want to
 * publish a longer mantra, source it from a verified text first.
 */

export type RitualSection = {
  heading: { hi: string; en: string };
  body: { hi: string[]; en: string[] };
};

export const RITUALS: RitualSection[] = [
  {
    heading: {
      en: "Why Tuesday in Jyeshtha?",
      hi: "ज्येष्ठ का मंगलवार क्यों?",
    },
    body: {
      en: [
        "Mangalwar, the day named for the planet Mars, has long been associated with Hanuman Ji. Local tradition holds that Hanuman first met Lord Rama on a Tuesday in the month of Jyeshtha, in the forests of Kishkindha. Every Tuesday in this month therefore carries the imprint of that first meeting.",
        "In Lucknow, the practice grew into a city-wide community feast, Bada Mangal, at the Aliganj Hanuman temple in the late 18th century. The summer's heat, the temple's pull, and the city's habit of plural generosity together made the day what it is.",
      ],
      hi: [
        "मंगलवार, जिसका नाम मंगल ग्रह से जुड़ा है, पुराने समय से ही हनुमान जी से जुड़ा रहा है। मान्यता है कि हनुमान जी का राम जी से प्रथम मिलन ज्येष्ठ के एक मंगलवार को किष्किंधा के वनों में हुआ था। इसलिए ज्येष्ठ का हर मंगल विशेष माना जाता है।",
        "लखनऊ में यह परंपरा 18वीं शताब्दी के अंत में अलीगंज हनुमान मंदिर से बड़े पैमाने पर भंडारे का रूप ले बैठी। ज्येष्ठ की गर्मी, मंदिर की निकटता और शहर की उदार परंपरा, सब ने मिलकर बड़ा मंगल बनाया।",
      ],
    },
  },
  {
    heading: {
      en: "On a Bada Mangal, what to do",
      hi: "बड़े मंगल को क्या करें",
    },
    body: {
      en: [
        "Wake before sunrise and bathe. Wear clean clothes; many devotees prefer red or saffron.",
        "Visit a Hanuman temple, Aliganj, Hanuman Setu, Sankat Mochan, or your local one. Touch the threshold, ring the bell once gently, and offer your namaskar.",
        "Recite the Hanuman Chalisa, even softly. Reading along from text is fine. There is no penalty for mispronunciation, sincerity is what matters.",
        "Make a small offering: red flowers (gudhal / hibiscus), a piece of sindoor, boondi laddoo or besan laddoo, a few tulsi leaves. Do not insist on elaborate offerings; simple is traditional.",
        "Eat at, or organize, a bhandara. Both giving and receiving are forms of seva.",
        "Help where you can: serve plates, refill water, clean up after. The festival runs on volunteers.",
      ],
      hi: [
        "सूर्योदय से पहले उठें और स्नान करें। साफ़ कपड़े पहनें, लाल या केसरी रंग शुभ माना जाता है।",
        "किसी हनुमान मंदिर जाएँ, अलीगंज, हनुमान सेतु, संकट मोचन, या अपने मोहल्ले का मंदिर। दहलीज को छुएँ, घंटी एक बार धीमे से बजाएँ, और प्रणाम करें।",
        "हनुमान चालीसा का पाठ करें, धीमे स्वर में भी हो सकता है। पाठ-पुस्तिका से पढ़ना उचित है। उच्चारण की त्रुटि का कोई दोष नहीं, श्रद्धा प्रधान है।",
        "एक छोटा सा अर्पण करें: लाल फूल (गुड़हल / जपा), थोड़ा सिंदूर, बूँदी या बेसन का लड्डू, तुलसी की कुछ पत्तियाँ। भव्य अर्पण की आवश्यकता नहीं, सादगी ही परंपरा है।",
        "किसी भंडारे में भोजन करें या स्वयं भंडारा आयोजित करें। देना और लेना, दोनों सेवा हैं।",
        "जहाँ संभव हो सहायता करें: थाली परोसें, पानी भरें, सफ़ाई में हाथ बँटाएँ। यह उत्सव स्वयंसेवकों से चलता है।",
      ],
    },
  },
  {
    heading: {
      en: "What to avoid",
      hi: "किन बातों से बचें",
    },
    body: {
      en: [
        "Avoid non-vegetarian food and alcohol on the day, by tradition.",
        "Avoid harsh speech and unnecessary arguments, it is a day of generosity.",
        "If fasting (vrat), most observers eat one sattvik meal in the day; salt-free is common but not required.",
        "Avoid stepping on prasad, plates, or water spilled at a bhandara, small attentions matter to the elders around you.",
      ],
      hi: [
        "इस दिन परंपरा से मांसाहार और मद्यपान से बचा जाता है।",
        "कठोर वचन और अनावश्यक विवाद से बचें, यह उदारता का दिन है।",
        "व्रत रखते हैं तो प्रायः दिन में एक सात्त्विक भोजन लिया जाता है; नमक-रहित परंपरा प्रचलित है, अनिवार्य नहीं।",
        "भंडारे में गिरे प्रसाद, थाली या पानी पर पैर न पड़ने दें, आस-पास के बुज़ुर्गों को इसका बहुत ध्यान रहता है।",
      ],
    },
  },
  {
    heading: {
      en: "Simple mantras",
      hi: "सरल मंत्र",
    },
    body: {
      en: [
        "ॐ हं हनुमते नमः, the simplest seed mantra, traditional.",
        "ॐ हनुमते नमः, even shorter, equally accepted.",
        "If you know the Hanuman Chalisa, that is itself the most popular daily recitation. We will publish the verified canonical text on /resources/chalisa.",
        "Source longer mantras (Bajrang Baan, Hanuman Ashtak) from a verified scholarly text, Gita Press editions are widely trusted.",
      ],
      hi: [
        "ॐ हं हनुमते नमः, सबसे सरल बीज-मंत्र, पारंपरिक।",
        "ॐ हनुमते नमः, और भी संक्षिप्त, उतना ही स्वीकार्य।",
        "हनुमान चालीसा का पाठ ही सबसे लोकप्रिय नित्य पाठ है। मानक पाठ शीघ्र /resources/chalisa पर प्रकाशित होगा।",
        "बजरंग बाण या हनुमान अष्टक जैसे लंबे पाठ किसी सत्यापित शास्त्रीय स्रोत, जैसे गीता प्रेस, से ही लें।",
      ],
    },
  },
  {
    heading: {
      en: "If you are organizing a bhandara",
      hi: "यदि आप भंडारा आयोजित कर रहे हैं",
    },
    body: {
      en: [
        "Register your pandal with the Lucknow Municipal Corporation, call 1533 or use the Lucknow One app. Cleaning is included free.",
        "List the bhandara on BadaMangal.com so devotees can find you on the map.",
        "Plan plate counts realistically. A street-corner stall typically serves 200–500 plates; a mid-size pandal 1,000–3,000; a flagship pandal 5,000–10,000.",
        "Keep cold water and ORS sachets visible, Jyeshtha heat is the real danger of the day.",
        "Identify two volunteers as crowd captains. Politely manage the line. Children get plates first.",
        "Keep a first-aid kit on hand. Have the local police and ambulance numbers written on a card.",
      ],
      hi: [
        "अपने पंडाल को लखनऊ नगर निगम में पंजीकृत कराएँ, 1533 पर कॉल करें या लखनऊ वन ऐप का उपयोग करें। सफ़ाई निःशुल्क है।",
        "अपने भंडारे को BadaMangal.com पर सूचीबद्ध कराएँ ताकि श्रद्धालु नक़्शे पर आपको पा सकें।",
        "थाली की संख्या व्यवहारिक रूप से तय करें। गली का एक छोटा स्टॉल 200–500 थाली, मध्यम पंडाल 1,000–3,000, बड़ा पंडाल 5,000–10,000 तक परोसता है।",
        "ठंडा पानी और ORS पैकेट सदा सामने रखें, ज्येष्ठ की गर्मी सबसे बड़ी चिंता है।",
        "दो स्वयंसेवकों को क्राउड कप्तान बनाएँ। पंक्ति को विनम्रता से व्यवस्थित रखें। बच्चों को पहले परोसें।",
        "प्राथमिक चिकित्सा किट साथ रखें। पुलिस और एम्बुलेंस के नंबर एक कार्ड पर लिख कर रखें।",
      ],
    },
  },
];
