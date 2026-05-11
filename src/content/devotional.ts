/**
 * Devotional content for /resources/chalisa, /aarti, /ashtak, /bajrang-baan.
 *
 * Each verse object has 4 slots — the page renders the Devanagari only,
 * but `roman` and `en` remain in the schema for future expansion:
 *   - num:   verse number
 *   - deva:  Devanagari text
 *   - roman: Roman transliteration (currently unused on the page)
 *   - en:    English meaning (currently unused on the page)
 *
 * To paste in canonical verse text, edit the `verses[]` arrays below.
 * The page automatically switches from the "Listen along" panel to the
 * full verse list as soon as `verses.every(v => v.deva === ",")` is
 * false (i.e. any one verse has real Devanagari text).
 */

export type DevotionalVerse = {
  num: string; // "1", "2", "Doha", "Doha 1", etc.
  deva: string;
  roman: string;
  en: string;
};

export type DevotionalSlug =
  | "chalisa"
  | "aarti"
  | "ashtak"
  | "bajrang-baan"
  | "ram-stuti";

export type DevotionalText = {
  /** URL slug. */
  slug: DevotionalSlug;
  /** Display titles. */
  titleHi: string;
  titleEn: string;
  /** Author / tradition. */
  author: string;
  /** Approximate composition era. */
  era: string;
  /** Source attribution (set when canonical text is added). */
  sourceAttribution: string;
  /** YouTube embed video ID for verified audio/video, set when chosen.
   *  Kept for back-compat; prefer `audioUrl` for self-hosted clean
   *  recordings without YouTube branding. */
  audioVideoId: string | null;
  /** Path to a self-hosted MP3 inside /public/audio/. When set, the
   *  page renders a minimal native <audio> player instead of an
   *  embedded video. */
  audioUrl: string | null;
  /** Notes the editor wants on the page. */
  editorialNotes: string;
  /** Verse list. Empty while text is being verified. */
  verses: DevotionalVerse[];
};

export const CHALISA: DevotionalText = {
  slug: "chalisa",
  titleHi: "हनुमान चालीसा",
  titleEn: "Hanuman Chalisa",
  author: "Goswami Tulsidas",
  era: "16th century CE (Ramcharitmanas era, Awadhi)",
  sourceAttribution:
    "Traditional devotional text",
  audioVideoId: null,
  audioUrl: "/audio/hanuman-chalisa.mp3",
  editorialNotes:
    "The Hanuman Chalisa is forty quatrains preceded by two introductory dohas, composed by Goswami Tulsidas in the 16th century. Press play above to listen along.",
  // Canonical Hanuman Chalisa: two opening dohas, 40 chaupais, one
  // closing doha. Devanagari is the standard Gita Press / Wikisource
  // text — public domain (Tulsidas, 16th c.). Roman + English fields
  // are intentionally empty; the page renders Devanagari only.
  verses: [
    {
      num: "दोहा १",
      deva:
        "श्रीगुरु चरन सरोज रज, निज मनु मुकुरु सुधारि।\n" +
        "बरनउँ रघुबर बिमल जसु, जो दायकु फल चारि॥",
      roman: "",
      en: "",
    },
    {
      num: "दोहा २",
      deva:
        "बुद्धिहीन तनु जानिके, सुमिरौं पवन-कुमार।\n" +
        "बल बुद्धि बिद्या देहु मोहिं, हरहु कलेश बिकार॥",
      roman: "",
      en: "",
    },
    { num: "१", deva: "जय हनुमान ज्ञान गुन सागर।\nजय कपीस तिहुँ लोक उजागर॥१॥", roman: "", en: "" },
    { num: "२", deva: "रामदूत अतुलित बल धामा।\nअंजनि-पुत्र पवनसुत नामा॥२॥", roman: "", en: "" },
    { num: "३", deva: "महाबीर बिक्रम बजरंगी।\nकुमति निवार सुमति के संगी॥३॥", roman: "", en: "" },
    { num: "४", deva: "कंचन बरन बिराज सुबेसा।\nकानन कुंडल कुंचित केसा॥४॥", roman: "", en: "" },
    { num: "५", deva: "हाथ बज्र औ ध्वजा बिराजै।\nकाँधे मूँज जनेऊ साजै॥५॥", roman: "", en: "" },
    { num: "६", deva: "शंकर सुवन केसरी नंदन।\nतेज प्रताप महा जग बंदन॥६॥", roman: "", en: "" },
    { num: "७", deva: "विद्यावान गुनी अति चातुर।\nराम काज करिबे को आतुर॥७॥", roman: "", en: "" },
    { num: "८", deva: "प्रभु चरित्र सुनिबे को रसिया।\nराम लखन सीता मन बसिया॥८॥", roman: "", en: "" },
    { num: "९", deva: "सूक्ष्म रूप धरि सियहिं दिखावा।\nबिकट रूप धरि लंक जरावा॥९॥", roman: "", en: "" },
    { num: "१०", deva: "भीम रूप धरि असुर सँहारे।\nरामचन्द्र के काज सँवारे॥१०॥", roman: "", en: "" },
    { num: "११", deva: "लाय सजीवन लखन जियाए।\nश्रीरघुबीर हरषि उर लाए॥११॥", roman: "", en: "" },
    { num: "१२", deva: "रघुपति कीन्ही बहुत बड़ाई।\nतुम मम प्रिय भरतहि सम भाई॥१२॥", roman: "", en: "" },
    { num: "१३", deva: "सहस बदन तुम्हरो जस गावैं।\nअस कहि श्रीपति कंठ लगावैं॥१३॥", roman: "", en: "" },
    { num: "१४", deva: "सनकादिक ब्रह्मादि मुनीसा।\nनारद सारद सहित अहीसा॥१४॥", roman: "", en: "" },
    { num: "१५", deva: "जम कुबेर दिगपाल जहाँ ते।\nकबि कोबिद कहि सकैं कहाँ ते॥१५॥", roman: "", en: "" },
    { num: "१६", deva: "तुम उपकार सुग्रीवहिं कीन्हा।\nराम मिलाय राज पद दीन्हा॥१६॥", roman: "", en: "" },
    { num: "१७", deva: "तुम्हरो मन्त्र बिभीषन माना।\nलंकेस्वर भए सब जग जाना॥१७॥", roman: "", en: "" },
    { num: "१८", deva: "जुग सहस्र जोजन पर भानू।\nलील्यो ताहि मधुर फल जानू॥१८॥", roman: "", en: "" },
    { num: "१९", deva: "प्रभु मुद्रिका मेलि मुख माहीं।\nजलधि लाँघि गये अचरज नाहीं॥१९॥", roman: "", en: "" },
    { num: "२०", deva: "दुर्गम काज जगत के जेते।\nसुगम अनुग्रह तुम्हरे तेते॥२०॥", roman: "", en: "" },
    { num: "२१", deva: "राम दुआरे तुम रखवारे।\nहोत न आज्ञा बिनु पैसारे॥२१॥", roman: "", en: "" },
    { num: "२२", deva: "सब सुख लहै तुम्हारी सरना।\nतुम रच्छक काहू को डर ना॥२२॥", roman: "", en: "" },
    { num: "२३", deva: "आपन तेज सम्हारो आपै।\nतीनों लोक हाँक तें काँपै॥२३॥", roman: "", en: "" },
    { num: "२४", deva: "भूत पिशाच निकट नहिं आवै।\nमहाबीर जब नाम सुनावै॥२४॥", roman: "", en: "" },
    { num: "२५", deva: "नासै रोग हरै सब पीरा।\nजपत निरंतर हनुमत बीरा॥२५॥", roman: "", en: "" },
    { num: "२६", deva: "संकट तें हनुमान छुड़ावै।\nमन क्रम बचन ध्यान जो लावै॥२६॥", roman: "", en: "" },
    { num: "२७", deva: "सब पर राम तपस्वी राजा।\nतिन के काज सकल तुम साजा॥२७॥", roman: "", en: "" },
    { num: "२८", deva: "और मनोरथ जो कोई लावै।\nसोई अमित जीवन फल पावै॥२८॥", roman: "", en: "" },
    { num: "२९", deva: "चारों जुग परताप तुम्हारा।\nहै परसिद्ध जगत उजियारा॥२९॥", roman: "", en: "" },
    { num: "३०", deva: "साधु सन्त के तुम रखवारे।\nअसुर निकंदन राम दुलारे॥३०॥", roman: "", en: "" },
    { num: "३१", deva: "अष्ट सिद्धि नौ निधि के दाता।\nअस बर दीन्ह जानकी माता॥३१॥", roman: "", en: "" },
    { num: "३२", deva: "राम रसायन तुम्हरे पासा।\nसदा रहो रघुपति के दासा॥३२॥", roman: "", en: "" },
    { num: "३३", deva: "तुम्हरे भजन राम को पावै।\nजनम जनम के दुख बिसरावै॥३३॥", roman: "", en: "" },
    { num: "३४", deva: "अन्त काल रघुबर पुर जाई।\nजहाँ जन्म हरि-भक्त कहाई॥३४॥", roman: "", en: "" },
    { num: "३५", deva: "और देवता चित्त न धरई।\nहनुमत सेइ सर्व सुख करई॥३५॥", roman: "", en: "" },
    { num: "३६", deva: "संकट कटै मिटै सब पीरा।\nजो सुमिरै हनुमत बलबीरा॥३६॥", roman: "", en: "" },
    { num: "३७", deva: "जै जै जै हनुमान गोसाईं।\nकृपा करहु गुरुदेव की नाईं॥३७॥", roman: "", en: "" },
    { num: "३८", deva: "जो शत बार पाठ कर कोई।\nछूटहि बंदि महा सुख होई॥३८॥", roman: "", en: "" },
    { num: "३९", deva: "जो यह पढ़ै हनुमान चालीसा।\nहोय सिद्धि साखी गौरीसा॥३९॥", roman: "", en: "" },
    { num: "४०", deva: "तुलसीदास सदा हरि चेरा।\nकीजै नाथ हृदय महँ डेरा॥४०॥", roman: "", en: "" },
    {
      num: "दोहा",
      deva:
        "पवनतनय संकट हरन, मंगल मूरति रूप।\n" +
        "राम लखन सीता सहित, हृदय बसहु सुर भूप॥",
      roman: "",
      en: "",
    },
  ],
};

export const AARTI: DevotionalText = {
  slug: "aarti",
  titleHi: "हनुमान आरती",
  titleEn: "Hanuman Aarti",
  author: "Traditional",
  era: "Traditional devotional",
  sourceAttribution:
    "Traditional devotional text",
  audioVideoId: null,
  audioUrl: "/audio/hanuman-aarti.mp3",
  editorialNotes:
    "“Aarti Kije Hanuman Lala Ki”, the aarti sung at most Lucknow Hanuman temples on Tuesday evenings. Press play above to listen along.",
  // Canonical "Aarti Kije Hanuman Lala Ki" — traditional, public domain.
  verses: [
    {
      num: "१",
      deva:
        "आरती कीजै हनुमान लला की।\n" +
        "दुष्ट दलन रघुनाथ कला की॥",
      roman: "",
      en: "",
    },
    {
      num: "२",
      deva:
        "जाके बल से गिरिवर काँपे।\n" +
        "रोग दोष जाके निकट न झाँके॥\n" +
        "अंजनि पुत्र महा बलदाई।\n" +
        "सन्तन के प्रभु सदा सहाई॥",
      roman: "",
      en: "",
    },
    {
      num: "३",
      deva:
        "दे बीरा रघुनाथ पठाए।\n" +
        "लंका जारि सिया सुधि लाए॥\n" +
        "लंका सो कोट समुद्र-सी खाई।\n" +
        "जात पवनसुत बार न लाई॥",
      roman: "",
      en: "",
    },
    {
      num: "४",
      deva:
        "लंका जारि असुर संहारे।\n" +
        "सियाराम जी के काज सँवारे॥\n" +
        "लक्ष्मण मूर्छित पड़े सकारे।\n" +
        "आनि सजीवन प्रान उबारे॥",
      roman: "",
      en: "",
    },
    {
      num: "५",
      deva:
        "पैठि पताल तोरि जम-कारे।\n" +
        "अहिरावन की भुजा उखारे॥\n" +
        "बाएँ भुजा असुर दल मारे।\n" +
        "दाहिने भुजा सन्तजन तारे॥",
      roman: "",
      en: "",
    },
    {
      num: "६",
      deva:
        "सुर नर मुनि आरती उतारें।\n" +
        "जय जय जय हनुमान उचारें॥\n" +
        "कंचन थार कपूर लौ छाई।\n" +
        "आरती करत अंजना माई॥",
      roman: "",
      en: "",
    },
    {
      num: "७",
      deva:
        "जो हनुमान जी की आरती गावै।\n" +
        "बसि बैकुंठ परम पद पावै॥",
      roman: "",
      en: "",
    },
  ],
};

/**
 * Sankat Mochan Hanuman Ashtak — eight stanzas Tulsidas composed in
 * distress, recited when an obstacle feels immovable. Audio is fully
 * wired; verses can be filled in by editing the array below.
 */
export const ASHTAK: DevotionalText = {
  slug: "ashtak",
  titleHi: "संकट मोचन हनुमान अष्टक",
  titleEn: "Sankat Mochan Hanuman Ashtak",
  author: "Goswami Tulsidas",
  era: "16th century CE (Awadhi)",
  sourceAttribution:
    "Traditional devotional text",
  audioVideoId: null,
  audioUrl: "/audio/hanuman-ashtak.mp3",
  editorialNotes:
    "Eight stanzas of equal weight, each ending with the refrain to Hanuman Ji as the remover of distress, followed by a closing doha. Press play above to listen along.",
  // Sankat Mochan Hanuman Ashtak — Tulsidas, 8 ashtakas + closing doha.
  // Each stanza ends with the refrain "को नहिं जानत है जग में कपि,
  // संकटमोचन नाम तिहारो".
  verses: [
    {
      num: "१",
      deva:
        "बाल समय रवि भक्षि लियो तब, तीनहुँ लोक भयो अँधियारो।\n" +
        "ताहि सों त्रास भयो जग को, यह संकट काहु सों जात न टारो॥\n" +
        "देवन आनि करी बिनती तब, छाँड़ि दियो रवि कष्ट निवारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "२",
      deva:
        "बालि की त्रास कपीस बसैं गिरि, जात महाप्रभु पंथ निहारो।\n" +
        "चौंकि महामुनि शाप दियो तब, चाहिय कौन बिचार बिचारो॥\n" +
        "कै द्विज रूप लिवाय महाप्रभु, सो तुम दास के सोक निवारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "३",
      deva:
        "अंगद के सँग लेन गये सिय, खोज कपीस यह बैन उचारो।\n" +
        "जीवत ना बचिहौ हम सो जु, बिना सुधि लाये इहाँ पगु धारो॥\n" +
        "हेरि थके तट सिन्धु सबै तब, लाय सिया-सुधि प्रान उबारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "४",
      deva:
        "रावन त्रास दई सिय को सब, राक्षसि सों कहि सोक निवारो।\n" +
        "ताहि समय हनुमान महाप्रभु, जाय महा रजनीचर मारो॥\n" +
        "चाहत सीय अशोक सों आगि सु, दै प्रभु मुद्रिका सोक निवारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "५",
      deva:
        "बान लग्यो उर लछिमन के तब, प्रान तजे सुत रावन मारो।\n" +
        "लै गृह बैद्य सुषेन समेत, तबै गिरि द्रोण सु बीर उपारो॥\n" +
        "आनि सजीवन हाथ दई तब, लछिमन के तुम प्रान उबारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "६",
      deva:
        "रावन जुद्ध अजान कियो तब, नाग कि फाँस सबै सिर डारो।\n" +
        "श्रीरघुनाथ समेत सबै दल, मोह भयो यह संकट भारो॥\n" +
        "आनि खगेस तबै हनुमान जु, बंधन काटि सुत्रास निवारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "७",
      deva:
        "बंधु समेत जबै अहिरावन, लै रघुनाथ पताल सिधारो।\n" +
        "देबिहिं पूजि भली बिधि सों बलि, देउ सबै मिलि मन्त्र विचारो॥\n" +
        "जाय सहाय भयो तब ही, अहिरावन सैन्य समेत सँहारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "८",
      deva:
        "काज किये बड़ देवन के तुम, बीर महाप्रभु देखि बिचारो।\n" +
        "कौन सो संकट मोर गरीब को, जो तुमसों नहिं जात है टारो॥\n" +
        "बेगि हरो हनुमान महाप्रभु, जो कछु संकट होय हमारो।\n" +
        "को नहिं जानत है जग में कपि, संकटमोचन नाम तिहारो॥",
      roman: "",
      en: "",
    },
    {
      num: "दोहा",
      deva:
        "लाल देह लाली लसे, अरु धरि लाल लँगूर।\n" +
        "बज्र देह दानव दलन, जय जय जय कपि सूर॥",
      roman: "",
      en: "",
    },
  ],
};

/**
 * Bajrang Baan — a fierce, protective recitation invoking Hanuman Ji's
 * force in moments of fear or threat. Audio is fully wired.
 */
export const BAJRANG_BAAN: DevotionalText = {
  slug: "bajrang-baan",
  titleHi: "बजरंग बाण",
  titleEn: "Bajrang Baan",
  author: "Traditional",
  era: "Traditional devotional",
  sourceAttribution:
    "Traditional devotional text",
  audioVideoId: null,
  audioUrl: "/audio/bajrang-baan.mp3",
  editorialNotes:
    "Opens with a doha, moves through a chain of chaupais invoking Hanuman Ji's protection, closes with a doha. Press play above to listen along.",
  // Bajrang Baan — traditional, public domain. Opening doha + chain of
  // chaupais invoking Hanuman Ji's protection + closing doha.
  verses: [
    {
      num: "दोहा",
      deva:
        "निश्चय प्रेम प्रतीति ते, बिनय करैं सनमान।\n" +
        "तेहि के कारज सकल शुभ, सिद्ध करैं हनुमान॥",
      roman: "",
      en: "",
    },
    { num: "१", deva: "जय हनुमन्त सन्त हितकारी।\nसुनि लीजै प्रभु अरज हमारी॥", roman: "", en: "" },
    { num: "२", deva: "जन के काज विलम्ब न कीजै।\nआतुर दौरि महा सुख दीजै॥", roman: "", en: "" },
    { num: "३", deva: "जैसे कूदि सिन्धु महि पारा।\nसुरसा बदन पैठि बिस्तारा॥", roman: "", en: "" },
    { num: "४", deva: "आगे जाइ लंकिनी रोका।\nमारेहु लात गई सुर लोका॥", roman: "", en: "" },
    { num: "५", deva: "जाय विभीषण को सुख दीन्हा।\nसीता निरखि परम पद लीन्हा॥", roman: "", en: "" },
    { num: "६", deva: "बाग उजारि सिन्धु महँ बोरा।\nअति आतुर जमकातर तोरा॥", roman: "", en: "" },
    { num: "७", deva: "अक्षय कुमार मारि संहारा।\nलूम लपेटि लंक को जारा॥", roman: "", en: "" },
    { num: "८", deva: "लाह समान लंक जरि गई।\nजय जय धुनि सुरपुर महँ भई॥", roman: "", en: "" },
    { num: "९", deva: "अब विलम्ब केहि कारन स्वामी।\nकृपा करहु उर अन्तर्यामी॥", roman: "", en: "" },
    { num: "१०", deva: "जय जय लखन प्राण के दाता।\nआतुर ह्वै दुख हरहु निपाता॥", roman: "", en: "" },
    { num: "११", deva: "जै गिरिधर जै जै सुख सागर।\nसुर समूह समरथ भट नागर॥", roman: "", en: "" },
    { num: "१२", deva: "ॐ हनु हनु हनु हनु हनुमन्त हठीले।\nबैरिहिं मारु बज्र की कीले॥", roman: "", en: "" },
    { num: "१३", deva: "गदा बज्र लै बैरिहिं मारो।\nमहाराज प्रभु दास उबारो॥", roman: "", en: "" },
    { num: "१४", deva: "ॐ कार हुंकार महाप्रभु धावो।\nबज्र गदा हनु बिलम्ब न लावो॥", roman: "", en: "" },
    { num: "१५", deva: "ॐ ह्रीं ह्रीं ह्रीं हनुमन्त कपीसा।\nॐ हुं हुं हुं हनु अरि उर शीशा॥", roman: "", en: "" },
    { num: "१६", deva: "सत्य होहु हरि शपथ पाय कै।\nरामदूत धरु मारु धाय कै॥", roman: "", en: "" },
    { num: "१७", deva: "जय जय जय हनुमन्त अगाधा।\nदुख पावत जन केहि अपराधा॥", roman: "", en: "" },
    { num: "१८", deva: "पूजा जप तप नेम अचारा।\nनहिं जानत कछु दास तुम्हारा॥", roman: "", en: "" },
    { num: "१९", deva: "वन उपवन मग गिरि गृह माहीं।\nतुम्हरे बल हम डरपत नाहीं॥", roman: "", en: "" },
    { num: "२०", deva: "पाँय परौं कर जोरि मनावौं।\nयहि अवसर अब केहि गोहरावौं॥", roman: "", en: "" },
    { num: "२१", deva: "जय अंजनि कुमार बलवन्ता।\nशंकर सुवन वीर हनुमन्ता॥", roman: "", en: "" },
    { num: "२२", deva: "बदन कराल काल कुल घालक।\nराम सहाय सदा प्रतिपालक॥", roman: "", en: "" },
    { num: "२३", deva: "भूत प्रेत पिशाच निशाचर।\nअग्नि बेताल काल मारी मर॥", roman: "", en: "" },
    { num: "२४", deva: "इन्हें मारु तोहि शपथ राम की।\nराखु नाथ मरजाद नाम की॥", roman: "", en: "" },
    { num: "२५", deva: "जनक सुता हरि दास कहावौ।\nताकी शपथ विलम्ब न लावौ॥", roman: "", en: "" },
    { num: "२६", deva: "जय जय जय धुनि होत अकाशा।\nसुमिरत होय दुसह दुख नाशा॥", roman: "", en: "" },
    { num: "२७", deva: "चरण शरण कर जोरि मनावौं।\nयहि अवसर अब केहि गोहरावौं॥", roman: "", en: "" },
    { num: "२८", deva: "उठु उठु चलु तोहि राम दुहाई।\nपाँय परौं कर जोरि मनाई॥", roman: "", en: "" },
    { num: "२९", deva: "ॐ चं चं चं चं चं चपल चलन्ता।\nॐ हनु हनु हनु हनु हनुमन्ता॥", roman: "", en: "" },
    { num: "३०", deva: "ॐ हं हं हाँक देत कपि चंचल।\nॐ सं सं सहमि पराने खल दल॥", roman: "", en: "" },
    { num: "३१", deva: "अपने जन को तुरत उबारो।\nसुमिरत होय आनन्द हमारो॥", roman: "", en: "" },
    { num: "३२", deva: "यह बजरंग बाण जेहि मारै।\nताहि कहो फिर कौन उबारै॥", roman: "", en: "" },
    { num: "३३", deva: "पाठ करै बजरंग बाण की।\nहनुमत रक्षा करैं प्रान की॥", roman: "", en: "" },
    { num: "३४", deva: "यह बजरंग बाण जो जापै।\nतेहि ते भूत प्रेत सब काँपै॥", roman: "", en: "" },
    { num: "३५", deva: "धूप देय अरु जपै हमेशा।\nताके तन नहिं रहै कलेशा॥", roman: "", en: "" },
    {
      num: "दोहा",
      deva:
        "प्रेम प्रतीतिहिं कपि भजै, सदा धरैं उर ध्यान।\n" +
        "तेहि के कारज सकल शुभ, सिद्ध करैं हनुमान॥",
      roman: "",
      en: "",
    },
  ],
};

/**
 * Shri Ram Stuti — "श्रीरामचन्द्र कृपालु भजुमन" — five-stanza prayer
 * to Shri Ram from Ramcharitmanas (Bal Kand) by Goswami Tulsidas, 16th
 * century. Sung at most Lucknow Hanuman temples alongside the Aarti.
 */
export const RAM_STUTI: DevotionalText = {
  slug: "ram-stuti",
  titleHi: "श्री राम स्तुति",
  titleEn: "Shri Ram Stuti",
  author: "Goswami Tulsidas",
  era: "16th century CE (Ramcharitmanas, Awadhi)",
  sourceAttribution: "Traditional devotional text",
  audioVideoId: null,
  audioUrl: "/audio/ram-stuti.mp3",
  editorialNotes:
    "“Shri Ramachandra Kripalu Bhajamana”, five stanzas from the Bal Kand of the Ramcharitmanas, sung at most Lucknow Hanuman temples alongside the Aarti on Tuesdays. Press play above to listen along.",
  verses: [
    {
      num: "१",
      deva:
        "श्रीरामचन्द्र कृपालु भजुमन हरण भवभय दारुणं।\n" +
        "नवकञ्ज लोचन कञ्ज मुख कर कञ्ज पद कञ्जारुणं॥",
      roman: "",
      en: "",
    },
    {
      num: "२",
      deva:
        "कन्दर्प अगणित अमित छवि नव नील नीरद सुन्दरं।\n" +
        "पटपीत मानहुँ तड़ित रुचि शुचि नौमि जनक सुतावरं॥",
      roman: "",
      en: "",
    },
    {
      num: "३",
      deva:
        "भजु दीनबन्धु दिनेश दानव दैत्य वंश निकन्दनं।\n" +
        "रघुनन्द आनन्दकन्द कोशल चन्द दशरथ नन्दनं॥",
      roman: "",
      en: "",
    },
    {
      num: "४",
      deva:
        "सिर मुकुट कुण्डल तिलक चारु उदारु अंग विभूषणं।\n" +
        "आजानु भुज शर चाप धर सङ्ग्राम जित खर दूषणं॥",
      roman: "",
      en: "",
    },
    {
      num: "५",
      deva:
        "इति वदति तुलसीदास शंकर शेष मुनि मन रञ्जनं।\n" +
        "मम हृदय कञ्ज निवास कुरु कामादि खल दल गञ्जनं॥",
      roman: "",
      en: "",
    },
    {
      num: "दोहा",
      deva:
        "मनु जाहिं राचेउ मिलिहि सो बरु सहज सुन्दर साँवरो।\n" +
        "करुणा निधान सुजान शील सनेहु जानत रावरो॥",
      roman: "",
      en: "",
    },
  ],
};

export const DEVOTIONAL_TEXTS: Record<DevotionalSlug, DevotionalText> = {
  chalisa: CHALISA,
  aarti: AARTI,
  ashtak: ASHTAK,
  "bajrang-baan": BAJRANG_BAAN,
  "ram-stuti": RAM_STUTI,
};
