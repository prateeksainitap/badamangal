import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Disclaimers · BadaMangal",
  description:
    "What BadaMangal.com is, what it isn't, and what you should verify on the ground before relying on the information here.",
  alternates: { canonical: "/disclaimers" },
  robots: { index: true, follow: true },
};

export default function DisclaimersPage() {
  return (
    <LegalPage
      kicker={{ en: "Disclaimers", hi: "अस्वीकरण" }}
      title={{ en: "Disclaimers", hi: "अस्वीकरण" }}
      intro={{
        en: "BadaMangal is a community-run directory. The information on this site is offered in good faith but is not guaranteed. Please read the items below before relying on a listing, especially before traveling to one.",
        hi: "BadaMangal एक समुदाय-संचालित निर्देशिका है। यहाँ दी गई जानकारी सद्भाव में प्रस्तुत है, लेकिन इसकी कोई गारंटी नहीं है। किसी भी सूचीबद्ध भंडारे पर निर्भर रहने से पहले, ख़ासकर वहाँ जाने से पहले, नीचे दिए गए बिंदु ज़रूर पढ़ें।",
      }}
      lastUpdated="10 May 2026"
      en={
        <>
          <h2>1. We are not affiliated with any temple or organiser</h2>
          <p>
            BadaMangal.com is an independent, community-run directory. We are not
            affiliated with, endorsed by, or speaking on behalf of any Hanuman
            temple, mandir trust, religious authority, neighbourhood committee,
            sevak group, or government body in Lucknow. Use of any temple name on
            this site is purely for identification of public landmarks; trademarks
            and naming rights remain with their respective owners.
          </p>

          <h2>2. Listings are user-submitted</h2>
          <p>
            Bhandara details, name, location, dates, timings, menu, capacity,
            organiser contact, are submitted by organisers themselves or, in the
            case of &ldquo;spots&rdquo;, by passers-by. We do our best to moderate
            and verify, but we cannot independently confirm every listing. Always
            check the latest details directly with the organiser before traveling,
            especially for evening or out-of-area bhandaras.
          </p>

          <h2>3. Timings and menus may change</h2>
          <p>
            Bhandaras are community-run events. Timings can shift, menus can be
            substituted at short notice, capacity can be reached early, and a
            bhandara can be cancelled altogether due to weather, civic
            restrictions, or organiser circumstances. The information shown on
            BadaMangal reflects what was submitted at the time of listing, it is
            not a real-time confirmation that a bhandara is open right now.
          </p>

          <h2>4. We are not a food-safety authority</h2>
          <p>
            We do not inspect kitchens, taste prasad, verify ingredients, or
            confirm hygiene practices at any listed bhandara. If you have food
            allergies, dietary restrictions (jain food, vegan options, gluten,
            nuts, dairy, onion-garlic), or pre-existing health conditions, ask the
            organiser directly before consuming. Children, elderly attendees, and
            anyone with compromised immunity should take extra care during peak
            hours.
          </p>

          <h2>5. Map locations are best-effort</h2>
          <p>
            Latitude/longitude coordinates and the map embedded on the site are
            provided to help you find a bhandara, not to navigate inside it. Pins
            may be slightly off, especially for &ldquo;neighbourhood&rdquo;
            listings that span multiple blocks (HAL Township, Damodar Nagar, Chowk
            and Nakkhas, etc.) or for new pandals that have not been geocoded
            precisely. Always cross-check with a landmark before driving, and
            prefer parking on the periphery during peak hours.
          </p>

          <h2>6. Devotional content is traditional</h2>
          <p>
            Texts published in our Resources section (Hanuman Chalisa, Hanuman
            Aarti, Sankat Mochan Hanuman Ashtak, Bajrang Baan and similar) are
            traditional, public-domain devotional works. Audio recordings linked
            on those pages are sourced from publicly available recordings; we do
            not claim authorship or ownership of either. If you are the rights
            holder of any specific recording and would like it removed, please
            write to <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            and we&apos;ll act promptly.
          </p>

          <h2>7. News and external links</h2>
          <p>
            Where we link to news articles, social posts, blog coverage, or
            external maps, we do not control those pages and are not responsible
            for their content, accuracy, or how they may change after we link to
            them. Links open in new tabs to make this clear.
          </p>

          <h2>8. Visitor counts and live counters</h2>
          <p>
            The visitor count, &ldquo;X bhandaras spotted live&rdquo;, &ldquo;X of
            8 Tuesdays served&rdquo; and similar numbers shown on the homepage are
            derived from real database events but are presented as friendly
            approximations. They are intended as ambient context, not as audited
            metrics. Tuesdays-served is a calendar-derived number (it counts
            Bada Mangal dates that have already passed in the current season),
            not an attendance count.
          </p>

          <h2>9. Sponsored listings</h2>
          <p>
            Listings marked with a sponsor badge or saffron ring may be promoted
            to the top of relevant lists. Sponsorship affects visibility, but not
            editorial accuracy: a sponsored listing is held to the same content
            standards as any other and can be reported, corrected or removed in
            the same way.
          </p>

          <h2>10. Religious sentiment and respectful conduct</h2>
          <p>
            BadaMangal is a celebration of seva and bhakti. We expect contributors
            and attendees to treat every bhandara, organiser, volunteer and fellow
            attendee with respect, regardless of caste, community, sect or
            background. The site is moderated to remove content that violates this
            spirit (see <a href="/terms">Terms &amp; Conditions</a>). The acts
            of attending, photographing, or commenting on a bhandara are public
            acts; do not photograph or quote people who have not given their
            consent.
          </p>

          <h2>11. No guarantee of fitness for purpose</h2>
          <p>
            BadaMangal is provided <strong>&ldquo;as is&rdquo;</strong> and
            without warranty of any kind. We do not guarantee that the site will
            be available at any specific time, that any listing will match
            on-the-ground reality, or that the directory is exhaustive. Use the
            information at your own discretion.
          </p>

          <h2>12. Reporting problems</h2>
          <p>
            Spotted a wrong address, an outdated timing, a listing that
            misrepresents a bhandara, or content that violates these disclaimers?
            Tell us at <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            or via the <a href="/contact">contact form</a>. We act on credible
            reports quickly, usually within a day during the season.
          </p>

          <h2>13. Related documents</h2>
          <p>
            These Disclaimers should be read together with our{" "}
            <a href="/terms">Terms &amp; Conditions</a> and{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        </>
      }
      hi={
        <>
          <h2>1. हम किसी मंदिर या आयोजक से संबद्ध नहीं हैं</h2>
          <p>
            BadaMangal.com एक स्वतंत्र, समुदाय-संचालित निर्देशिका है। हम लखनऊ के किसी
            हनुमान मंदिर, मंदिर ट्रस्ट, धार्मिक प्राधिकरण, मोहल्ला समिति, सेवक समूह
            या सरकारी निकाय से संबद्ध, द्वारा अनुमोदित, या उनकी ओर से बोलने वाले
            नहीं हैं। इस साइट पर किसी भी मंदिर के नाम का उपयोग केवल सार्वजनिक स्थलों
            की पहचान के लिए है; ट्रेडमार्क और नामकरण अधिकार उनके संबंधित स्वामियों
            के पास हैं।
          </p>

          <h2>2. लिस्टिंग उपयोगकर्ताओं द्वारा प्रस्तुत हैं</h2>
          <p>
            भंडारा विवरण, नाम, स्थान, तिथियाँ, समय, मेन्यू, क्षमता, आयोजक संपर्क,
            आयोजकों द्वारा स्वयं प्रस्तुत किए जाते हैं या &ldquo;स्पॉट&rdquo; के
            मामले में, राहगीरों द्वारा। हम मॉडरेट और सत्यापित करने का पूरा प्रयास
            करते हैं, परंतु हर लिस्टिंग की स्वतंत्र पुष्टि नहीं कर सकते। यात्रा से
            पहले, ख़ासकर शाम के या अपने क्षेत्र से बाहर के भंडारे के लिए, हमेशा
            आयोजक से सीधे ताज़ा विवरण की पुष्टि कर लें।
          </p>

          <h2>3. समय और मेन्यू बदल सकते हैं</h2>
          <p>
            भंडारे समुदाय-संचालित आयोजन होते हैं। समय बदल सकते हैं, मेन्यू अल्प
            सूचना पर बदले जा सकते हैं, क्षमता जल्दी पूरी हो सकती है, और मौसम,
            नागरिक प्रतिबंध या आयोजक की परिस्थितियों के कारण भंडारा रद्द भी हो
            सकता है। BadaMangal पर दिखाई जा रही जानकारी वही है जो लिस्टिंग के समय
            दर्ज की गई थी, यह इस बात की रीयल-टाइम पुष्टि नहीं है कि भंडारा अभी
            खुला है।
          </p>

          <h2>4. हम खाद्य-सुरक्षा प्राधिकरण नहीं हैं</h2>
          <p>
            हम किसी भी सूचीबद्ध भंडारे की रसोई का निरीक्षण नहीं करते, प्रसाद नहीं
            चखते, सामग्री सत्यापित नहीं करते, या स्वच्छता प्रथाओं की पुष्टि नहीं
            करते। यदि आपको खाद्य एलर्जी, आहार संबंधी प्रतिबंध (जैन भोजन, शाकाहारी
            विकल्प, ग्लूटेन, मेवे, डेयरी, प्याज़-लहसुन) या पहले से कोई स्वास्थ्य
            स्थिति है, तो खाने से पहले आयोजक से सीधे पूछें। बच्चे, बुज़ुर्ग और
            कमज़ोर रोग-प्रतिरोधक क्षमता वाले लोग व्यस्ततम समय में विशेष सावधानी
            बरतें।
          </p>

          <h2>5. नक़्शे की स्थान सर्वोत्तम-प्रयास हैं</h2>
          <p>
            साइट पर दिए गए अक्षांश/देशांतर निर्देशांक और एम्बेडेड नक़्शा भंडारा
            खोजने में मदद के लिए हैं, उसके अंदर नेविगेट करने के लिए नहीं। पिन
            थोड़े आगे-पीछे हो सकते हैं, ख़ासकर बहु-ब्लॉक मोहल्ले की लिस्टिंग के लिए
            (HAL टाउनशिप, दामोदर नगर, चौक और नक्खास, आदि) या नए पंडालों के लिए
            जिनका सटीक जियो-कोडिंग नहीं हुआ है। ड्राइविंग से पहले हमेशा किसी
            लैंडमार्क से क्रॉस-चेक करें, और व्यस्ततम समय में परिधि पर पार्किंग
            करना बेहतर है।
          </p>

          <h2>6. आध्यात्मिक सामग्री पारंपरिक है</h2>
          <p>
            हमारे Resources सेक्शन में प्रकाशित पाठ (हनुमान चालीसा, हनुमान आरती,
            संकट मोचन हनुमान अष्टक, बजरंग बाण आदि) पारंपरिक, सार्वजनिक-डोमेन
            भक्ति रचनाएँ हैं। उन पन्नों पर लिंक की गई ऑडियो रिकॉर्डिंग्स
            सार्वजनिक रूप से उपलब्ध स्रोतों से ली गई हैं; हम न तो इनकी कर्तृत्व
            का दावा करते हैं और न ही स्वामित्व का। यदि आप किसी विशेष रिकॉर्डिंग
            के अधिकार-धारक हैं और इसे हटाना चाहते हैं, तो कृपया{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            पर लिखें, हम शीघ्र कार्रवाई करेंगे।
          </p>

          <h2>7. ख़बरें और बाहरी लिंक</h2>
          <p>
            जहाँ हम न्यूज़ लेखों, सोशल पोस्ट्स, ब्लॉग या बाहरी नक़्शों से लिंक
            करते हैं, हम उन पेजों को नियंत्रित नहीं करते और उनकी सामग्री, सटीकता,
            या लिंक करने के बाद उनमें बदलाव के लिए ज़िम्मेदार नहीं हैं। यह स्पष्ट
            करने के लिए लिंक नए टैब में खुलते हैं।
          </p>

          <h2>8. विज़िटर गिनती और लाइव काउंटर</h2>
          <p>
            होमपेज पर दिखाई जा रही विज़िटर गिनती, &ldquo;X भंडारे लाइव स्पॉट किए
            गए&rdquo;, &ldquo;8 में से X मंगलवार सेवा&rdquo; और इसी तरह की संख्याएँ
            असली डेटाबेस घटनाओं से ली गई हैं, परंतु मैत्रीपूर्ण अनुमान के रूप में
            प्रस्तुत की जाती हैं। ये परिवेशीय संदर्भ के लिए हैं, न कि ऑडिटेड
            मेट्रिक्स के रूप में। मंगलवार-सेवा एक कैलेंडर-आधारित संख्या है (यह
            उन बड़े मंगल तिथियों को गिनती है जो वर्तमान सत्र में बीत चुकी हैं),
            उपस्थिति गिनती नहीं।
          </p>

          <h2>9. स्पॉन्सर्ड लिस्टिंग</h2>
          <p>
            जिन लिस्टिंग पर स्पॉन्सर बैज या केसरिया छल्ला है, उन्हें संबंधित
            सूचियों में ऊपर प्रमोट किया जा सकता है। स्पॉन्सरशिप दृश्यता को
            प्रभावित करती है, संपादकीय सटीकता को नहीं: स्पॉन्सर्ड लिस्टिंग को
            भी अन्य लिस्टिंग की तरह ही सामग्री मानकों पर रखा जाता है और उसी
            तरह से रिपोर्ट, सुधार या हटाई जा सकती है।
          </p>

          <h2>10. धार्मिक भावना और सम्मानजनक आचरण</h2>
          <p>
            BadaMangal सेवा और भक्ति का उत्सव है। हम योगदानकर्ताओं और सहभागियों
            से अपेक्षा करते हैं कि वे हर भंडारा, आयोजक, स्वयंसेवक और साथी
            सहभागी के साथ जाति, समुदाय, संप्रदाय या पृष्ठभूमि की परवाह किए
            बिना सम्मान से पेश आएँ। इस भावना का उल्लंघन करने वाली सामग्री हटाने
            के लिए साइट मॉडरेट की जाती है (देखें{" "}
            <a href="/terms">नियम और शर्तें</a>)। भंडारे में जाना, तस्वीर लेना
            या टिप्पणी करना सार्वजनिक कार्य हैं; ऐसे व्यक्तियों की तस्वीर या
            उद्धरण न लें जिन्होंने सहमति नहीं दी है।
          </p>

          <h2>11. किसी विशिष्ट उपयोग की कोई गारंटी नहीं</h2>
          <p>
            BadaMangal को <strong>&ldquo;जैसा है&rdquo;</strong> के आधार पर
            उपलब्ध कराया गया है, बिना किसी प्रकार की वारंटी के। हम इसकी गारंटी
            नहीं देते कि साइट हर समय उपलब्ध होगी, कि कोई लिस्टिंग ज़मीनी
            हक़ीक़त से मेल खाएगी, या निर्देशिका सम्पूर्ण है। जानकारी का उपयोग
            अपने विवेक से करें।
          </p>

          <h2>12. समस्या की रिपोर्ट करना</h2>
          <p>
            ग़लत पता, पुराना समय, किसी भंडारे को ग़लत तरीक़े से दर्शाने वाली
            लिस्टिंग, या इन अस्वीकरणों का उल्लंघन करने वाली सामग्री देखी?{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a> पर
            लिखें या <a href="/contact">कॉन्टैक्ट फ़ॉर्म</a> भरें। हम विश्वसनीय
            रिपोर्ट पर शीघ्र कार्रवाई करते हैं, मौसम के दौरान आमतौर पर एक दिन
            के भीतर।
          </p>

          <h2>13. संबंधित दस्तावेज़</h2>
          <p>
            ये अस्वीकरण हमारे <a href="/terms">नियम और शर्तें</a> और{" "}
            <a href="/privacy">गोपनीयता नीति</a> के साथ पढ़े जाने चाहिए।
          </p>
        </>
      }
    />
  );
}
