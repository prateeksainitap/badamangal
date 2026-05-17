import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions · BadaMangal",
  description:
    "The terms that govern your use of BadaMangal.com, listing, spotting, browsing, and contributing to Lucknow's Bada Mangal directory.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      kicker={{ en: "Terms & Conditions", hi: "नियम और शर्तें" }}
      title={{ en: "Terms of Use", hi: "उपयोग की शर्तें" }}
      intro={{
        en: "By using BadaMangal.com you agree to the terms below. They are written in plain English so you can actually read them, but they are legally binding once you continue past this page.",
        hi: "BadaMangal.com का उपयोग करके आप नीचे दी गई शर्तों से सहमत होते हैं। इन्हें सरल भाषा में लिखा गया है ताकि आप वास्तव में पढ़ सकें, परंतु इस पेज के आगे बढ़ने पर ये कानूनी रूप से बाध्यकारी हैं।",
      }}
      lastUpdated="10 May 2026"
      en={
        <>
          <h2>1. Who we are</h2>
          <p>
            BadaMangal.com (&ldquo;BadaMangal&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a community-run
            directory of Bada Mangal bhandaras in Lucknow, India, operated as a free
            public-information service. We are not a temple, a religious authority,
            a travel agency, or a food-service provider. We index information
            contributed by organisers and the public so that anyone in the city can
            find a bhandara to attend, sponsor, or report.
          </p>

          <h2>2. Acceptance of these terms</h2>
          <p>
            By accessing the site, listing a bhandara, spotting one, posting in the
            live feed, sending us a contact message, or otherwise interacting with
            BadaMangal you agree to these Terms, our{" "}
            <a href="/privacy">Privacy Policy</a>, and our{" "}
            <a href="/disclaimers">Disclaimers</a>. If you do not agree with any
            part of them, please stop using the site.
          </p>

          <h2>3. Eligibility</h2>
          <p>
            You must be at least 18 years old to submit a listing, photograph,
            comment, or any other contribution. By contributing you confirm that
            you meet this age requirement and that you have the right to publish
            whatever you submit.
          </p>

          <h2>4. Listings, spots, and posts (user-generated content)</h2>
          <p>
            BadaMangal lets you contribute three kinds of content:
          </p>
          <ul>
            <li>
              <strong>Listings</strong>, full bhandara entries, submitted by
              organisers, including the venue, schedule, menu, capacity, organiser
              name and contact, and photographs.
            </li>
            <li>
              <strong>Spots</strong>, quick &ldquo;I just walked past this
              bhandara&rdquo; reports, with a location pin and an optional photo
              and caption.
            </li>
            <li>
              <strong>Posts</strong>, short text and photo updates left under a
              listed bhandara&apos;s page or in the live feed.
            </li>
          </ul>
          <p>
            You retain ownership of everything you submit. By submitting it you
            grant BadaMangal a worldwide, royalty-free, non-exclusive, perpetual
            licence to host, display, reformat, translate, moderate, and
            redistribute that content as part of the BadaMangal service and in any
            public coverage of it (press, social, search snippets). You may ask us
            to take down your contribution at any time by writing to{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>;
            once removed, the licence ends.
          </p>

          <h2>5. What you must not submit</h2>
          <ul>
            <li>
              Photos or text that are not yours and that you do not have permission
              to publish.
            </li>
            <li>
              Photographs of identifiable people without their consent, or any
              photograph of a child without their parent&apos;s consent.
            </li>
            <li>
              False, misleading, or commercially deceptive information about a
              bhandara, fake locations, fake organiser names, inflated plate
              counts, made-up addresses.
            </li>
            <li>
              Hateful, casteist, communal, abusive, or harassing content; content
              that incites violence; content that targets any individual,
              community, organisation or temple.
            </li>
            <li>
              Spam, unrelated promotion, paid links, or any attempt to use a
              listing as a vehicle for unrelated marketing.
            </li>
            <li>
              Content that infringes anyone&apos;s intellectual-property,
              publicity, or privacy rights.
            </li>
            <li>
              Personal information of third parties (their phone numbers, home
              addresses, photographs taken without consent, etc.).
            </li>
          </ul>

          <h2>6. Listing organisers, your responsibilities</h2>
          <p>
            If you list a bhandara on BadaMangal, you are publicly representing
            yourself as the organiser of that bhandara. By submitting a listing
            you confirm that:
          </p>
          <ul>
            <li>You are authorised by the organising group to publish its details.</li>
            <li>The address, dates, timings, menu, and capacity are accurate at the time of submission.</li>
            <li>The contact phone number you provide is yours, you have access to it, and we may verify it via OTP.</li>
            <li>You will keep the listing reasonably up to date if details change before the relevant Tuesday.</li>
            <li>You will respond, within reason, to attendees who reach you via the contact information you provide.</li>
          </ul>

          <h2>7. Moderation</h2>
          <p>
            BadaMangal reserves the right, but accepts no obligation, to review,
            edit, refuse, blur, anonymise, or remove any contribution at any time
            for any reason, including (without limit) suspected violation of
            these Terms, complaints from third parties, requests from temple
            authorities or civic bodies, or our own editorial judgement. Decisions
            are made by humans assisted by automated tools; both make mistakes.
          </p>

          <h2>8. Verification badges</h2>
          <p>
            A &ldquo;Verified&rdquo; badge means the BadaMangal team has spoken to
            the listed organiser by phone and confirmed the basic details. It is
            not a guarantee of food safety, hygiene, capacity, or the conduct of
            the bhandara on the day. The absence of a badge does not imply that a
            listing is unverified or unsafe, it usually just means the team
            hasn&apos;t reached the organiser yet.
          </p>

          <h2>9. Sponsored listings</h2>
          <p>
            Sponsored listings, when present, are visually marked with a sponsor
            ring or badge. Sponsorship affects ordering and prominence on some
            surfaces but does not change the editorial accuracy expectations
            above. We will never accept sponsorship in exchange for hiding
            legitimate complaints or competing bhandaras.
          </p>

          <h2>10. Intellectual property</h2>
          <p>
            The BadaMangal name, brand mark, illustrations, written copy, code,
            and overall design are © BadaMangal and its contributors. All rights
            reserved. You may share screenshots and link to pages freely; you may
            not republish substantial portions of the editorial copy or
            illustrations without prior written permission.
          </p>
          <p>
            Devotional texts (Chalisa, Aarti, Hanuman Ashtak, Bajrang Baan, etc.)
            published on BadaMangal are traditional public-domain works.
          </p>

          <h2>11. Third-party links</h2>
          <p>
            BadaMangal links to Google Maps, WhatsApp, news sources, and other
            third-party services. We do not control these services and are not
            responsible for their content, terms, or behaviour. Following a link
            means you accept the third party&apos;s own terms.
          </p>

          <h2>12. Disclaimers and limitation of liability</h2>
          <p>
            BadaMangal is provided <strong>&ldquo;as is&rdquo;</strong>, without
            warranties of any kind. We don&apos;t guarantee that any bhandara
            listed will run on the day or time advertised, that the food described
            will be served, or that travel directions will lead to the right
            place. Bhandaras are organised independently by community groups. See
            our <a href="/disclaimers">Disclaimers page</a> for the full list.
          </p>
          <p>
            To the maximum extent permitted by law, BadaMangal and its operators
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages arising from your use of, or
            inability to use, the site, including (without limit) any loss
            related to attending, missing, or being affected by a bhandara listed
            here.
          </p>

          <h2>13. Indemnity</h2>
          <p>
            You agree to indemnify and hold BadaMangal harmless from any claim,
            loss, or expense arising from content you submit, your violation of
            these Terms, or your violation of any third party&apos;s rights.
          </p>

          <h2>14. Termination</h2>
          <p>
            We may suspend or terminate your access to specific features (e.g.
            ability to post, list, or spot) at any time and without notice if we
            believe you have violated these Terms or applicable law. Where
            practical we will tell you why.
          </p>

          <h2>15. Governing law</h2>
          <p>
            These Terms are governed by the laws of India. The courts of Lucknow,
            Uttar Pradesh, shall have exclusive jurisdiction over any dispute
            arising out of or relating to your use of BadaMangal.
          </p>

          <h2>16. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. We will change the
            &ldquo;Last updated&rdquo; date at the top of this page when we do.
            Continued use of the site after a change means you accept the
            revised Terms.
          </p>

          <h2>17. Contact</h2>
          <p>
            Questions about these Terms? Write to us at{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            or via the <a href="/contact">contact form</a>.
          </p>
        </>
      }
      hi={
        <>
          <h2>1. हम कौन हैं</h2>
          <p>
            BadaMangal.com (&ldquo;BadaMangal&rdquo;, &ldquo;हम&rdquo;,
            &ldquo;हमारा&rdquo;) लखनऊ, भारत में बड़ा मंगल भंडारों की एक
            समुदाय-संचालित निर्देशिका है, जो एक मुफ़्त सार्वजनिक-सूचना सेवा के
            रूप में संचालित होती है। हम कोई मंदिर, धार्मिक प्राधिकरण, ट्रैवल
            एजेंसी या खाद्य-सेवा प्रदाता नहीं हैं। हम आयोजकों और जनता द्वारा
            दी गई जानकारी को अनुक्रमित करते हैं ताकि शहर में कोई भी व्यक्ति
            उपस्थित होने, सहयोग देने, या रिपोर्ट करने के लिए भंडारा खोज सके।
          </p>

          <h2>2. इन शर्तों की स्वीकृति</h2>
          <p>
            साइट तक पहुँचकर, भंडारा सूचीबद्ध करके, स्पॉट करके, लाइव फ़ीड में
            पोस्ट करके, हमें कॉन्टैक्ट संदेश भेजकर, या BadaMangal के साथ किसी
            भी अन्य प्रकार से बातचीत करके आप इन शर्तों, हमारी{" "}
            <a href="/privacy">गोपनीयता नीति</a>, और हमारे{" "}
            <a href="/disclaimers">अस्वीकरणों</a> से सहमत होते हैं। यदि आप
            इनके किसी भी हिस्से से सहमत नहीं हैं, तो कृपया साइट का उपयोग बंद
            कर दें।
          </p>

          <h2>3. पात्रता</h2>
          <p>
            कोई लिस्टिंग, तस्वीर, टिप्पणी, या कोई भी अन्य योगदान सबमिट करने
            के लिए आपकी आयु कम-से-कम 18 वर्ष होनी चाहिए। योगदान देकर आप पुष्टि
            करते हैं कि आप इस आयु-आवश्यकता को पूरा करते हैं और जो भी आप सबमिट
            कर रहे हैं उसे प्रकाशित करने का आपको अधिकार है।
          </p>

          <h2>4. लिस्टिंग, स्पॉट और पोस्ट (उपयोगकर्ता-निर्मित सामग्री)</h2>
          <p>
            BadaMangal आपको तीन प्रकार की सामग्री में योगदान देने देता है:
          </p>
          <ul>
            <li>
              <strong>लिस्टिंग</strong>, पूर्ण भंडारा प्रविष्टियाँ, आयोजकों
              द्वारा सबमिट की जाती हैं, जिनमें स्थान, समय-सारणी, मेन्यू, क्षमता,
              आयोजक का नाम और संपर्क, और तस्वीरें शामिल हैं।
            </li>
            <li>
              <strong>स्पॉट</strong>, त्वरित &ldquo;मैं अभी इस भंडारे के पास से
              गुज़रा&rdquo; रिपोर्ट, जिसमें लोकेशन पिन और वैकल्पिक फ़ोटो व
              कैप्शन होते हैं।
            </li>
            <li>
              <strong>पोस्ट</strong>, सूचीबद्ध भंडारे के पेज पर या लाइव फ़ीड
              में छोड़े गए संक्षिप्त टेक्स्ट और फ़ोटो अपडेट।
            </li>
          </ul>
          <p>
            आप जो भी सबमिट करते हैं उसका स्वामित्व आपके पास रहता है। इसे सबमिट
            करके आप BadaMangal को विश्वव्यापी, रॉयल्टी-मुक्त, ग़ैर-अनन्य,
            सतत लाइसेंस देते हैं कि वह उस सामग्री को BadaMangal सेवा के हिस्से
            के रूप में और इसके किसी भी सार्वजनिक कवरेज (प्रेस, सोशल, सर्च
            स्निपेट) में होस्ट, प्रदर्शित, पुनः-स्वरूपित, अनुवादित, मॉडरेट और
            पुनर्वितरित कर सके। आप किसी भी समय{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            पर लिखकर अपना योगदान हटाने के लिए कह सकते हैं; हटाए जाने के बाद,
            लाइसेंस समाप्त हो जाता है।
          </p>

          <h2>5. आपको क्या सबमिट नहीं करना चाहिए</h2>
          <ul>
            <li>
              ऐसी तस्वीरें या टेक्स्ट जो आपके नहीं हैं और जिन्हें प्रकाशित
              करने की आपको अनुमति नहीं है।
            </li>
            <li>
              पहचाने-जाने योग्य व्यक्तियों की बिना उनकी सहमति के तस्वीरें, या
              किसी बच्चे की उसके माता-पिता की सहमति के बिना कोई तस्वीर।
            </li>
            <li>
              किसी भंडारे के बारे में झूठी, भ्रामक, या व्यावसायिक रूप से
              धोखेबाज़ जानकारी, फ़र्ज़ी स्थान, फ़र्ज़ी आयोजक नाम, बढ़ा-चढ़ाकर
              बताए गए प्लेट काउंट, मनगढ़ंत पते।
            </li>
            <li>
              नफ़रत-भरी, जातिवादी, साम्प्रदायिक, अपमानजनक, या उत्पीड़न करने
              वाली सामग्री; हिंसा भड़काने वाली सामग्री; किसी व्यक्ति, समुदाय,
              संगठन या मंदिर को निशाना बनाने वाली सामग्री।
            </li>
            <li>
              स्पैम, असंबद्ध प्रचार, भुगतान-वाले लिंक, या लिस्टिंग को
              असंबद्ध मार्केटिंग के माध्यम के रूप में उपयोग करने का कोई भी
              प्रयास।
            </li>
            <li>
              ऐसी सामग्री जो किसी के बौद्धिक-संपदा, प्रचार, या गोपनीयता
              अधिकारों का उल्लंघन करती है।
            </li>
            <li>
              तीसरे पक्षों की निजी जानकारी (उनके फ़ोन नंबर, घर के पते,
              बिना सहमति के ली गई तस्वीरें, आदि)।
            </li>
          </ul>

          <h2>6. लिस्टिंग आयोजक, आपकी ज़िम्मेदारियाँ</h2>
          <p>
            यदि आप BadaMangal पर कोई भंडारा सूचीबद्ध करते हैं, तो आप सार्वजनिक
            रूप से स्वयं को उस भंडारे का आयोजक प्रस्तुत कर रहे हैं। लिस्टिंग
            सबमिट करके आप पुष्टि करते हैं कि:
          </p>
          <ul>
            <li>आप आयोजक समूह द्वारा इसके विवरण प्रकाशित करने के लिए अधिकृत हैं।</li>
            <li>सबमिशन के समय पता, तिथियाँ, समय, मेन्यू और क्षमता सटीक हैं।</li>
            <li>आपके द्वारा दिया गया संपर्क फ़ोन नंबर आपका है, आपकी उस तक पहुँच है, और हम इसे OTP के माध्यम से सत्यापित कर सकते हैं।</li>
            <li>संबंधित मंगलवार से पहले विवरण बदलने पर आप लिस्टिंग को उचित रूप से अद्यतन रखेंगे।</li>
            <li>आप उन उपस्थितियों के साथ उचित सीमा में संवाद करेंगे जो आपके द्वारा दी गई संपर्क जानकारी से आप तक पहुँचेंगे।</li>
          </ul>

          <h2>7. मॉडरेशन</h2>
          <p>
            BadaMangal किसी भी कारण से किसी भी समय किसी भी योगदान को समीक्षित,
            संपादित, अस्वीकार, धुंधला, गुमनाम, या हटाने का अधिकार रखता है,
            परंतु इसके लिए कोई दायित्व स्वीकार नहीं करता, जिसमें (बिना सीमा के)
            इन शर्तों के उल्लंघन का संदेह, तीसरे पक्षों से शिकायतें, मंदिर
            प्राधिकरणों या नागरिक निकायों के अनुरोध, या हमारा अपना संपादकीय
            निर्णय शामिल है। निर्णय स्वचालित उपकरणों से सहायता-प्राप्त मनुष्यों
            द्वारा लिए जाते हैं; दोनों ग़लतियाँ करते हैं।
          </p>

          <h2>8. सत्यापन बैज</h2>
          <p>
            एक &ldquo;सत्यापित&rdquo; बैज का मतलब है कि BadaMangal टीम ने
            सूचीबद्ध आयोजक से फ़ोन पर बात की है और बुनियादी विवरणों की पुष्टि
            की है। यह खाद्य सुरक्षा, स्वच्छता, क्षमता, या उस दिन के भंडारे के
            आचरण की गारंटी नहीं है। बैज की अनुपस्थिति का यह अर्थ नहीं है कि
            लिस्टिंग असत्यापित या असुरक्षित है, इसका आमतौर पर इतना ही मतलब
            होता है कि टीम अभी तक आयोजक तक नहीं पहुँची है।
          </p>

          <h2>9. स्पॉन्सर्ड लिस्टिंग</h2>
          <p>
            स्पॉन्सर्ड लिस्टिंग, जब मौजूद हों, स्पॉन्सर रिंग या बैज से नेत्र-दृष्टि
            से चिह्नित होती हैं। स्पॉन्सरशिप कुछ सतहों पर क्रम और प्रमुखता को
            प्रभावित करती है परंतु ऊपर बताई गई संपादकीय सटीकता की अपेक्षाओं को
            नहीं बदलती। हम वैध शिकायतों या प्रतिस्पर्धी भंडारों को छिपाने के
            बदले में कभी स्पॉन्सरशिप स्वीकार नहीं करेंगे।
          </p>

          <h2>10. बौद्धिक संपदा</h2>
          <p>
            BadaMangal का नाम, ब्रांड मार्क, चित्रण, लिखित कॉपी, कोड और समग्र
            डिज़ाइन © BadaMangal और इसके योगदानकर्ताओं का है। सर्वाधिकार
            सुरक्षित। आप स्क्रीनशॉट साझा कर सकते हैं और पेज से स्वतंत्र रूप से
            लिंक कर सकते हैं; आप पूर्व लिखित अनुमति के बिना संपादकीय कॉपी या
            चित्रण के बड़े हिस्सों को पुनः प्रकाशित नहीं कर सकते।
          </p>
          <p>
            BadaMangal पर प्रकाशित भक्ति-पाठ (चालीसा, आरती, हनुमान अष्टक,
            बजरंग बाण, आदि) पारंपरिक सार्वजनिक-डोमेन रचनाएँ हैं।
          </p>

          <h2>11. थर्ड-पार्टी लिंक</h2>
          <p>
            BadaMangal Google Maps, WhatsApp, समाचार स्रोतों और अन्य
            थर्ड-पार्टी सेवाओं से लिंक करता है। हम इन सेवाओं को नियंत्रित
            नहीं करते और उनकी सामग्री, शर्तों, या व्यवहार के लिए ज़िम्मेदार
            नहीं हैं। किसी लिंक पर जाने का अर्थ है कि आप तीसरे पक्ष की अपनी
            शर्तें स्वीकार करते हैं।
          </p>

          <h2>12. अस्वीकरण और देयता की सीमा</h2>
          <p>
            BadaMangal को <strong>&ldquo;जैसा है&rdquo;</strong> के रूप में
            उपलब्ध कराया गया है, बिना किसी प्रकार की वारंटी के। हम यह गारंटी
            नहीं देते कि कोई भी सूचीबद्ध भंडारा विज्ञापित दिन या समय पर चलेगा,
            कि वर्णित भोजन परोसा जाएगा, या यात्रा निर्देश सही जगह तक ले
            जाएँगे। भंडारे समुदाय समूहों द्वारा स्वतंत्र रूप से आयोजित किए
            जाते हैं। पूरी सूची के लिए हमारा{" "}
            <a href="/disclaimers">अस्वीकरण पेज</a> देखें।
          </p>
          <p>
            कानून द्वारा अनुमत अधिकतम सीमा तक, BadaMangal और इसके संचालक
            साइट के आपके उपयोग या उपयोग में असमर्थता से उत्पन्न होने वाली
            किसी भी अप्रत्यक्ष, आकस्मिक, विशेष, परिणामी, या दंडात्मक क्षति
            के लिए ज़िम्मेदार नहीं होंगे, जिसमें (बिना सीमा के) यहाँ
            सूचीबद्ध किसी भंडारे में भाग लेने, छूट जाने, या प्रभावित होने
            से संबंधित कोई हानि शामिल है।
          </p>

          <h2>13. क्षतिपूर्ति</h2>
          <p>
            आप BadaMangal को आपकी सबमिट की गई सामग्री, इन शर्तों के आपके
            उल्लंघन, या किसी तीसरे पक्ष के अधिकारों के आपके उल्लंघन से
            उत्पन्न होने वाले किसी भी दावे, हानि, या व्यय से क्षतिपूर्ति
            करने और हानिरहित रखने के लिए सहमत हैं।
          </p>

          <h2>14. समाप्ति</h2>
          <p>
            यदि हमें लगता है कि आपने इन शर्तों या लागू कानून का उल्लंघन किया
            है, तो हम किसी भी समय और बिना सूचना के विशिष्ट सुविधाओं (जैसे
            पोस्ट करने, सूचीबद्ध करने, या स्पॉट करने की क्षमता) तक आपकी पहुँच
            निलंबित या समाप्त कर सकते हैं। जहाँ व्यावहारिक हो, हम आपको कारण
            बताएँगे।
          </p>

          <h2>15. लागू कानून</h2>
          <p>
            ये शर्तें भारत के कानूनों द्वारा शासित हैं। लखनऊ, उत्तर प्रदेश
            के न्यायालयों को BadaMangal के आपके उपयोग से उत्पन्न होने वाले
            या उससे संबंधित किसी भी विवाद पर अनन्य क्षेत्राधिकार होगा।
          </p>

          <h2>16. इन शर्तों में बदलाव</h2>
          <p>
            हम समय-समय पर इन शर्तों को अपडेट कर सकते हैं। ऐसा करने पर हम
            इस पेज के ऊपर &ldquo;अंतिम अपडेट&rdquo; तारीख बदल देंगे।
            बदलाव के बाद साइट का निरंतर उपयोग करने का अर्थ है कि आप संशोधित
            शर्तें स्वीकार करते हैं।
          </p>

          <h2>17. संपर्क</h2>
          <p>
            इन शर्तों के बारे में प्रश्न?{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            पर हमें लिखें या <a href="/contact">कॉन्टैक्ट फ़ॉर्म</a> के
            माध्यम से।
          </p>
        </>
      }
    />
  );
}
