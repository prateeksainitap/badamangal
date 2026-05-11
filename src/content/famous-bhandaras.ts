/**
 * Lucknow's most-named Bada Mangal venues.
 *
 * These are the temples, intersections, and neighbourhood hubs that
 * Lucknow consistently calls out year after year as the busiest places
 * to find a bhandara on a Bada Mangal Tuesday. The list is curated from
 * civic-press coverage of the festival; descriptors below are written
 * fresh for BadaMangal.com so we never re-publish another outlet's prose.
 *
 * Add `slug` once a curated bhandara/temple page exists for the venue,
 * and the card will link to it instead of the area-filtered map view.
 */

export type FamousBhandara = {
  /** Display name in Roman script. */
  name: string;
  /** Display name in Devanagari (optional fallback to roman). */
  nameHi: string;
  /** Neighbourhood / area of Lucknow. */
  area: string;
  /** Same area in Hindi. */
  areaHi: string;
  /** One-line descriptor — fresh prose, never copied from a source. */
  note: string;
  noteHi: string;
  /** Loose category, used to colour the card pill. */
  kind: "temple" | "intersection" | "neighbourhood";
  /** Optional internal slug if there's a dedicated page for this venue. */
  slug?: string;
  /** Geo coordinates of the venue. Cards link to a Google Maps view
   *  centred on (lat, lng) when both are present. */
  lat?: number;
  lng?: number;
};

export const FAMOUS_BHANDARAS: FamousBhandara[] = [
  {
    name: "Hanuman Mandir, Aliganj",
    nameHi: "हनुमान मंदिर, अलीगंज",
    area: "Aliganj",
    areaHi: "अलीगंज",
    note: "The historic anchor of the festival; lakhs queue here on every Bada Mangal.",
    noteHi: "बड़े मंगल का ऐतिहासिक केंद्र; हर मंगल को लाखों श्रद्धालु आते हैं।",
    kind: "temple",
    lat: 26.89167,
    lng: 80.93750,
  },
  {
    name: "Hanuman Setu Mandir",
    nameHi: "हनुमान सेतु मंदिर",
    area: "Hazratganj",
    areaHi: "हज़रतगंज",
    note: "Riverside dakshin-mukhi shrine; bhandaras line the approach roads from dawn.",
    noteHi: "गोमती किनारे दक्षिण-मुखी मंदिर; भोर से ही भंडारे लग जाते हैं।",
    kind: "temple",
    lat: 26.86810,
    lng: 80.94120,
  },
  {
    name: "Sankat Mochan Mandir",
    nameHi: "संकट मोचन मंदिर",
    area: "Sankat Mochan, LU side",
    areaHi: "संकट मोचन, लखनऊ विश्वविद्यालय",
    note: "Old-city devotees gather here; community kitchens run all afternoon.",
    noteHi: "पुराने शहर का प्रिय मंदिर; दोपहर भर सामुदायिक रसोइयाँ चलती हैं।",
    kind: "temple",
    lat: 26.86650,
    lng: 80.93920,
  },
  {
    name: "Koneshwar Mahadev Mandir",
    nameHi: "कोणेश्वर महादेव मंदिर",
    area: "Lalbagh",
    areaHi: "लालबाग",
    note: "Heritage Shiva temple where Tuesday bhandaras spill onto Lalbagh's lanes.",
    noteHi: "ऐतिहासिक शिव मंदिर; मंगलवार के भंडारे लालबाग की गलियों में फैल जाते हैं।",
    kind: "temple",
    lat: 26.84890,
    lng: 80.93680,
  },
  {
    name: "Qaiserbagh Chauraha",
    nameHi: "क़ैसरबाग चौराहा",
    area: "Kaiserbagh",
    areaHi: "क़ैसरबाग",
    note: "Central crossing where neighbourhood committees set up the city's biggest pandals.",
    noteHi: "केंद्रीय चौराहा; मोहल्ला समितियाँ शहर के सबसे बड़े पंडाल यहाँ लगाती हैं।",
    kind: "intersection",
    lat: 26.85420,
    lng: 80.93390,
  },
  {
    name: "Parivartan Chowk",
    nameHi: "परिवर्तन चौक",
    area: "Civil Lines",
    areaHi: "सिविल लाइंस",
    note: "Office-goers' favourite stop; thalis served straight through the lunch hour.",
    noteHi: "दफ्तर जाने वालों की पसंदीदा जगह; दोपहर के समय थालियाँ बँटती रहती हैं।",
    kind: "intersection",
    lat: 26.85660,
    lng: 80.94320,
  },
  {
    name: "Engineering College Chauraha",
    nameHi: "इंजीनियरिंग कॉलेज चौराहा",
    area: "Jankipuram",
    areaHi: "जानकीपुरम",
    note: "Northern Lucknow's busiest junction; long pandals on every approach road.",
    noteHi: "उत्तर लखनऊ का व्यस्ततम चौराहा; हर सड़क पर लंबे पंडाल।",
    kind: "intersection",
    lat: 26.90520,
    lng: 80.94690,
  },
  {
    name: "Gole Market",
    nameHi: "गोल मार्केट",
    area: "Mahanagar",
    areaHi: "महानगर",
    note: "Neighbourhood committee hub with dozens of small kitchens around the circle.",
    noteHi: "मोहल्ला समिति का केंद्र; गोल चक्कर के चारों ओर दर्जनों रसोइयाँ।",
    kind: "neighbourhood",
    lat: 26.87930,
    lng: 80.94780,
  },
  {
    name: "HAL Bhandara Belt",
    nameHi: "एचएएल भंडारा क्षेत्र",
    area: "Indira Nagar",
    areaHi: "इंदिरा नगर",
    note: "Industrial-colony bhandaras run by employees; everyone in line is welcome.",
    noteHi: "एचएएल कर्मचारियों द्वारा संचालित भंडारे; हर श्रद्धालु का स्वागत है।",
    kind: "neighbourhood",
    lat: 26.88810,
    lng: 80.99540,
  },
  {
    name: "Chowk & Nakkhas",
    nameHi: "चौक और नक्खास",
    area: "Old Lucknow",
    areaHi: "पुराना लखनऊ",
    note: "Heritage lanes where the city's oldest bhandara traditions still flourish.",
    noteHi: "पुरानी गलियाँ जहाँ शहर की सबसे पुरानी भंडारा परंपराएँ जीवित हैं।",
    kind: "neighbourhood",
    lat: 26.86940,
    lng: 80.90830,
  },
  {
    name: "Damodar Nagar & Sector J",
    nameHi: "दामोदर नगर और सेक्टर जे",
    area: "Alambagh / Ashiana",
    areaHi: "आलमबाग / आशियाना",
    note: "Residents' associations turn entire sectors into open kitchens for the day.",
    noteHi: "रेज़िडेंट्स एसोसिएशन पूरे सेक्टर को दिन भर के लिए खुली रसोई बना देती हैं।",
    kind: "neighbourhood",
    lat: 26.81560,
    lng: 80.89120,
  },
  {
    name: "Kalibari Mandir",
    nameHi: "कालीबाड़ी मंदिर",
    area: "Aminabad",
    areaHi: "अमीनाबाद",
    note: "Bengali-style shrine in busy Aminabad; sweet kheer bhandara is the draw.",
    noteHi: "अमीनाबाद का बंगाली शैली का मंदिर; मीठी खीर के लिए प्रसिद्ध।",
    kind: "temple",
    lat: 26.85100,
    lng: 80.92660,
  },
];
