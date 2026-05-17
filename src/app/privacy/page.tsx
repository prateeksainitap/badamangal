import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · BadaMangal",
  description:
    "What BadaMangal.com collects, why we collect it, where it lives, and the rights you have over your data.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker={{ en: "Privacy Policy", hi: "गोपनीयता नीति" }}
      title={{ en: "Privacy Policy", hi: "गोपनीयता नीति" }}
      intro={{
        en: "We collect the smallest amount of data that lets BadaMangal stay useful and safe to use. This page explains exactly what we collect, why, where it sits, and how to ask us to delete it.",
        hi: "हम केवल उतना ही डेटा एकत्र करते हैं जितना BadaMangal को उपयोगी और सुरक्षित रखने के लिए ज़रूरी है। यह पेज ठीक-ठीक बताता है कि हम क्या एकत्र करते हैं, क्यों करते हैं, वह कहाँ रहता है, और हमसे उसे हटाने के लिए कैसे कहें।",
      }}
      lastUpdated="10 May 2026"
      en={
        <>
          <h2>1. The short version</h2>
          <ul>
            <li>We do not sell your data, ever.</li>
            <li>We do not run third-party advertising trackers.</li>
            <li>Phone numbers are stored only as one-way salted hashes, we cannot read them back.</li>
            <li>Photos you upload are converted to WebP, EXIF stripped, and stored on Supabase Storage.</li>
            <li>You can ask us to delete your contributions at any time by emailing namaste@badamangal.com.</li>
          </ul>

          <h2>2. What we collect</h2>
          <h3>2.1 When you list a bhandara</h3>
          <ul>
            <li>The bhandara details you submit (name, address, area, dates, menu, capacity, organiser name).</li>
            <li>An organiser phone number, used solely for OTP verification at submission time and to let the BadaMangal team reach out privately if a listing needs clarification. The raw number is never shown publicly on the site; only a salted, one-way hash of it is kept in our database for verification lookups.</li>
            <li>Optional UPI ID, used to receive sponsorship contributions. Not displayed publicly unless you explicitly opt in to a public sponsorship card.</li>
            <li>Optional photograph(s) of the bhandara.</li>
          </ul>

          <h3>2.2 When you spot a bhandara</h3>
          <ul>
            <li>The location pin you drop or share via your browser&apos;s geolocation.</li>
            <li>An optional reporter name (first name only is fine), optional caption, and optional photo.</li>
            <li>If you choose to verify by phone, a salted hash of your number; the raw number is never stored.</li>
          </ul>

          <h3>2.3 When you post in the live feed</h3>
          <ul>
            <li>Your chosen display name and optional photo.</li>
            <li>The text of your post.</li>
            <li>A salted hash of your phone number (used for moderation and rate-limiting).</li>
          </ul>

          <h3>2.4 When you fill the contact form</h3>
          <ul>
            <li>Your name, email, optional phone, optional subject, and the message you send us.</li>
          </ul>

          <h3>2.5 Automatic technical data (every visit)</h3>
          <ul>
            <li>A salted hash of your IP address (used to rate-limit submissions and detect abuse). The raw IP is never stored.</li>
            <li>The first ~240 characters of your browser&apos;s user-agent string (used to debug submission issues).</li>
            <li>Standard server logs handled by our hosting provider; these are short-lived and used for operational purposes.</li>
          </ul>

          <h2>3. Cookies and local storage</h2>
          <p>BadaMangal uses very few client-side storage items:</p>
          <ul>
            <li>
              <strong>Language preference</strong> (cookie), remembers whether you
              chose Hindi or English so we can show the right copy on your next
              visit. No tracking value.
            </li>
            <li>
              <strong>Phone-verification token</strong> (cookie, signed), set after
              you complete OTP verification on the listing or post flows so you don&apos;t
              have to re-verify on every submission. Contains only the hash, an
              expiry, and a signature; no raw phone number.
            </li>
            <li>
              <strong>Session-storage flags</strong> (browser-only, never sent to us)
              , small UI state like &ldquo;you dismissed the activity ticker&rdquo;
              so it doesn&apos;t come back during the same browser session.
            </li>
          </ul>

          <h2>4. Analytics</h2>
          <p>
            We use Google Analytics 4 to understand how the site is used in
            aggregate (page views, country, device class, which CTAs are clicked).
            GA4 sets its own first-party cookies and processes data per Google&apos;s
            privacy terms. We do not enable advertising features, remarketing, or
            Google Signals on this property. If you would prefer not to be counted,
            any modern browser&apos;s tracking-protection or an ad-blocker will
            prevent the GA4 script from loading.
          </p>

          <h2>5. Where your data lives</h2>
          <ul>
            <li>
              <strong>Database</strong>, Supabase (managed Postgres, currently in
              the Asia-Pacific Singapore region).
            </li>
            <li>
              <strong>Photo storage</strong>, Supabase Storage in the same region.
              Photos are served via a public CDN URL because the listings page is
              public.
            </li>
            <li>
              <strong>Hosting</strong>, Netlify, edge-cached globally; only
              static assets and pre-rendered pages travel through their network.
              Server-rendered pages and API routes execute as serverless functions
              in the closest available region.
            </li>
            <li>
              <strong>Email</strong>, Contact-form messages are stored in our
              Supabase database; we may also receive a copy by email at
              namaste@badamangal.com.
            </li>
          </ul>

          <h2>6. How long we keep things</h2>
          <ul>
            <li>
              <strong>Bhandara listings</strong>, kept for the lifetime of the
              season they refer to, plus one year for archival reference. After
              that, they are either anonymised (organiser name + phone hash
              removed) or deleted.
            </li>
            <li>
              <strong>Spots</strong>, auto-expire after 8 hours from a public
              surface. The underlying record is kept for up to 30 days for abuse
              analysis, then deleted.
            </li>
            <li>
              <strong>Posts in the live feed</strong>, kept while moderation
              status is &ldquo;approved&rdquo;; rejected or shadowed posts are
              purged after 90 days.
            </li>
            <li>
              <strong>Contact-form messages</strong>, kept for 12 months from
              the date sent so we can refer back during a long conversation.
            </li>
            <li>
              <strong>Phone-verification cookies</strong>, expire after 30 days.
            </li>
          </ul>

          <h2>7. Your rights</h2>
          <p>You may, at any time, ask us to:</p>
          <ul>
            <li>Show you what data of yours we hold.</li>
            <li>Correct anything that is wrong.</li>
            <li>Delete a specific listing, spot, post, or contact-form message you submitted.</li>
            <li>Delete every record we associate with a particular phone-number hash you can prove control of (e.g. by completing an OTP from that number).</li>
            <li>Stop receiving any further email from us.</li>
          </ul>
          <p>
            Email <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            with the subject line &ldquo;Privacy request&rdquo; and tell us what
            you&apos;d like done. We aim to respond within 14 days.
          </p>

          <h2>8. Children</h2>
          <p>
            BadaMangal is not directed at users under the age of 18 and we do not
            knowingly collect data from minors. If you believe a child has
            submitted information to us, please contact us so we can remove it.
          </p>

          <h2>9. Security</h2>
          <p>
            We use industry-standard precautions: TLS in transit, salted hashes for
            identifiers, server-side validation on every submission, and per-IP
            rate limits on write APIs. No system is perfectly secure; if you spot a
            vulnerability, please write to{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            before disclosing it publicly so we can fix it.
          </p>

          <h2>10. International transfers</h2>
          <p>
            Our hosting providers may move data across borders for operational
            reasons (caching, backups, fail-over). All such transfers are governed
            by the providers&apos; standard contractual clauses, which we accept on
            your behalf when you contribute.
          </p>

          <h2>11. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy as the site evolves. The
            &ldquo;Last updated&rdquo; date at the top of the page reflects the
            most recent change. Material changes will be flagged on the homepage
            for at least seven days.
          </p>

          <h2>12. Contact</h2>
          <p>
            Questions about your privacy on BadaMangal? Reach the team at{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            or via the <a href="/contact">contact form</a>.
          </p>
        </>
      }
      hi={
        <>
          <h2>1. संक्षिप्त सार</h2>
          <ul>
            <li>हम आपका डेटा कभी नहीं बेचते।</li>
            <li>हम कोई थर्ड-पार्टी विज्ञापन ट्रैकर्स नहीं चलाते।</li>
            <li>फ़ोन नंबर केवल वन-वे साल्टेड हैश के रूप में संग्रहीत होते हैं, हम उन्हें वापस पढ़ नहीं सकते।</li>
            <li>आपकी अपलोड की गई तस्वीरें WebP में बदलकर, EXIF हटाकर, Supabase Storage पर रखी जाती हैं।</li>
            <li>आप namaste@badamangal.com पर ईमेल भेजकर किसी भी समय अपने योगदान हटाने के लिए कह सकते हैं।</li>
          </ul>

          <h2>2. हम क्या एकत्र करते हैं</h2>
          <h3>2.1 जब आप भंडारा लिस्ट करते हैं</h3>
          <ul>
            <li>आपके द्वारा प्रस्तुत भंडारा विवरण (नाम, पता, क्षेत्र, तिथियाँ, मेन्यू, क्षमता, आयोजक का नाम)।</li>
            <li>आयोजक का फ़ोन नंबर, केवल जमा करते समय OTP सत्यापन के लिए और लिस्टिंग स्पष्टीकरण की ज़रूरत होने पर BadaMangal टीम द्वारा निजी संपर्क के लिए उपयोग होता है। कच्चा नंबर साइट पर कभी सार्वजनिक नहीं दिखाया जाता; सत्यापन लुकअप के लिए हमारे डेटाबेस में केवल साल्टेड वन-वे हैश रखा जाता है।</li>
            <li>वैकल्पिक UPI ID, स्पॉन्सरशिप योगदान प्राप्त करने के लिए। तब तक सार्वजनिक रूप से प्रदर्शित नहीं होता जब तक आप सार्वजनिक स्पॉन्सरशिप कार्ड के लिए स्पष्ट रूप से ऑप्ट-इन न करें।</li>
            <li>भंडारे की वैकल्पिक तस्वीर(रें)।</li>
          </ul>

          <h3>2.2 जब आप भंडारा स्पॉट करते हैं</h3>
          <ul>
            <li>आपके द्वारा डाला गया या ब्राउज़र की जियो-लोकेशन से साझा किया गया स्थान पिन।</li>
            <li>वैकल्पिक रिपोर्टर नाम (केवल पहला नाम भी ठीक है), वैकल्पिक कैप्शन और वैकल्पिक फ़ोटो।</li>
            <li>यदि आप फ़ोन से सत्यापित करना चुनते हैं, तो आपके नंबर का साल्टेड हैश; कच्चा नंबर कभी संग्रहीत नहीं होता।</li>
          </ul>

          <h3>2.3 जब आप लाइव फ़ीड में पोस्ट करते हैं</h3>
          <ul>
            <li>आपका चुना हुआ प्रदर्शन नाम और वैकल्पिक फ़ोटो।</li>
            <li>आपकी पोस्ट का टेक्स्ट।</li>
            <li>आपके फ़ोन नंबर का साल्टेड हैश (मॉडरेशन और दर-सीमित करने के लिए उपयोग)।</li>
          </ul>

          <h3>2.4 जब आप कॉन्टैक्ट फ़ॉर्म भरते हैं</h3>
          <ul>
            <li>आपका नाम, ईमेल, वैकल्पिक फ़ोन, वैकल्पिक विषय और आपका संदेश।</li>
          </ul>

          <h3>2.5 स्वचालित तकनीकी डेटा (हर विज़िट)</h3>
          <ul>
            <li>आपके IP पते का साल्टेड हैश (सबमिशन को दर-सीमित करने और दुरुपयोग का पता लगाने के लिए)। कच्चा IP कभी संग्रहीत नहीं होता।</li>
            <li>आपके ब्राउज़र के यूज़र-एजेंट स्ट्रिंग के पहले ~240 अक्षर (सबमिशन समस्याओं को डीबग करने के लिए)।</li>
            <li>हमारे होस्टिंग प्रदाता द्वारा संभाले गए मानक सर्वर लॉग; ये अल्पकालिक होते हैं और परिचालन उद्देश्यों के लिए उपयोग होते हैं।</li>
          </ul>

          <h2>3. कुकीज़ और लोकल स्टोरेज</h2>
          <p>BadaMangal बहुत कम क्लाइंट-साइड स्टोरेज आइटम का उपयोग करता है:</p>
          <ul>
            <li>
              <strong>भाषा प्राथमिकता</strong> (कुकी), याद रखती है कि आपने हिंदी
              चुनी थी या English, ताकि अगली विज़िट पर हम सही कॉपी दिखा सकें। कोई
              ट्रैकिंग मूल्य नहीं।
            </li>
            <li>
              <strong>फ़ोन-सत्यापन टोकन</strong> (कुकी, साइन्ड), लिस्टिंग या पोस्ट
              फ़्लो में OTP सत्यापन पूरा करने के बाद सेट होता है ताकि आपको हर बार
              दोबारा सत्यापन न करना पड़े। केवल हैश, समय-सीमा और हस्ताक्षर होते हैं;
              कोई कच्चा फ़ोन नंबर नहीं।
            </li>
            <li>
              <strong>सेशन-स्टोरेज फ़्लैग</strong> (केवल ब्राउज़र में, हमें कभी
              नहीं भेजे जाते), छोटे UI स्टेट जैसे &ldquo;आपने एक्टिविटी टिकर बंद
              कर दिया&rdquo;, ताकि वही ब्राउज़र सेशन में दोबारा न दिखे।
            </li>
          </ul>

          <h2>4. एनालिटिक्स</h2>
          <p>
            हम साइट का उपयोग कुल मिलाकर (पेज व्यू, देश, डिवाइस वर्ग, कौन से CTA
            क्लिक होते हैं) समझने के लिए Google Analytics 4 का उपयोग करते हैं।
            GA4 अपनी फ़र्स्ट-पार्टी कुकीज़ सेट करता है और डेटा को Google की
            गोपनीयता शर्तों के अनुसार प्रोसेस करता है। हम इस प्रॉपर्टी पर
            विज्ञापन सुविधाएँ, रीमार्केटिंग या Google Signals सक्षम नहीं करते।
            यदि आप गिने जाना नहीं चाहते, तो किसी भी आधुनिक ब्राउज़र की
            ट्रैकिंग-प्रोटेक्शन या ऐड-ब्लॉकर GA4 स्क्रिप्ट को लोड होने से रोक
            देगा।
          </p>

          <h2>5. आपका डेटा कहाँ रहता है</h2>
          <ul>
            <li>
              <strong>डेटाबेस</strong>, Supabase (मैनेज्ड Postgres, वर्तमान में
              एशिया-प्रशांत सिंगापुर क्षेत्र में)।
            </li>
            <li>
              <strong>फ़ोटो स्टोरेज</strong>, उसी क्षेत्र में Supabase Storage।
              तस्वीरें सार्वजनिक CDN URL के माध्यम से दी जाती हैं क्योंकि
              लिस्टिंग पेज सार्वजनिक है।
            </li>
            <li>
              <strong>होस्टिंग</strong>, Netlify, विश्व स्तर पर एज-कैश्ड; उनके
              नेटवर्क से केवल स्टैटिक एसेट्स और प्री-रेंडर्ड पेज जाते हैं।
              सर्वर-रेंडर्ड पेज और API रूट्स निकटतम उपलब्ध क्षेत्र में सर्वरलेस
              फ़ंक्शन के रूप में चलते हैं।
            </li>
            <li>
              <strong>ईमेल</strong>, कॉन्टैक्ट-फ़ॉर्म संदेश हमारे Supabase
              डेटाबेस में संग्रहीत होते हैं; हमें namaste@badamangal.com पर एक
              प्रति ईमेल भी मिल सकती है।
            </li>
          </ul>

          <h2>6. हम चीज़ें कितने समय तक रखते हैं</h2>
          <ul>
            <li>
              <strong>भंडारा लिस्टिंग</strong>, जिस सत्र के लिए हैं उसके पूरे
              जीवनकाल और संग्रह संदर्भ के लिए एक वर्ष अधिक तक रखी जाती हैं। उसके
              बाद, उन्हें या तो गुमनाम कर दिया जाता है (आयोजक नाम + फ़ोन हैश हटा
              दिए जाते हैं) या मिटा दिया जाता है।
            </li>
            <li>
              <strong>स्पॉट्स</strong>, सार्वजनिक सतह से 8 घंटों के बाद स्वतः
              समाप्त हो जाते हैं। अंतर्निहित रिकॉर्ड दुरुपयोग विश्लेषण के लिए
              30 दिनों तक रखा जाता है, फिर मिटा दिया जाता है।
            </li>
            <li>
              <strong>लाइव फ़ीड में पोस्ट</strong>, मॉडरेशन स्थिति
              &ldquo;अनुमोदित&rdquo; होने पर रखी जाती हैं; अस्वीकृत या छिपाई
              गई पोस्ट 90 दिनों बाद हटा दी जाती हैं।
            </li>
            <li>
              <strong>कॉन्टैक्ट-फ़ॉर्म संदेश</strong>, भेजे जाने की तारीख से
              12 महीने तक रखे जाते हैं ताकि लंबी बातचीत में संदर्भ दिया जा सके।
            </li>
            <li>
              <strong>फ़ोन-सत्यापन कुकीज़</strong>, 30 दिनों बाद समाप्त हो जाती हैं।
            </li>
          </ul>

          <h2>7. आपके अधिकार</h2>
          <p>आप किसी भी समय हमसे यह कह सकते हैं:</p>
          <ul>
            <li>आपका कौन-सा डेटा हमारे पास है, वह दिखाएँ।</li>
            <li>जो ग़लत है उसे सुधारें।</li>
            <li>आपके द्वारा सबमिट की गई किसी विशिष्ट लिस्टिंग, स्पॉट, पोस्ट या कॉन्टैक्ट-फ़ॉर्म संदेश को हटाएँ।</li>
            <li>किसी विशेष फ़ोन-नंबर हैश से जुड़ा हर रिकॉर्ड हटाएँ जिसका नियंत्रण आप प्रमाणित कर सकें (जैसे उस नंबर से OTP पूरा करके)।</li>
            <li>हमसे कोई और ईमेल प्राप्त करना बंद करें।</li>
          </ul>
          <p>
            विषय &ldquo;Privacy request&rdquo; के साथ{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a> पर
            ईमेल भेजें और बताएँ कि आप क्या करवाना चाहते हैं। हम 14 दिनों के भीतर
            जवाब देने का प्रयास करते हैं।
          </p>

          <h2>8. बच्चे</h2>
          <p>
            BadaMangal 18 वर्ष से कम आयु के उपयोगकर्ताओं के लिए निर्देशित नहीं है
            और हम जानबूझकर नाबालिगों से डेटा एकत्र नहीं करते। यदि आपको लगता है कि
            किसी बच्चे ने हमें जानकारी सबमिट की है, तो कृपया हमसे संपर्क करें
            ताकि हम उसे हटा सकें।
          </p>

          <h2>9. सुरक्षा</h2>
          <p>
            हम उद्योग-मानक एहतियात बरतते हैं: ट्रांज़िट में TLS, पहचानकर्ताओं
            के लिए साल्टेड हैश, हर सबमिशन पर सर्वर-साइड वैलिडेशन, और राइट APIs
            पर प्रति-IP दर सीमाएँ। कोई सिस्टम पूर्ण रूप से सुरक्षित नहीं होता;
            यदि आपको कोई कमज़ोरी मिले, तो कृपया सार्वजनिक रूप से बताने से पहले{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            पर लिखें ताकि हम उसे ठीक कर सकें।
          </p>

          <h2>10. अंतरराष्ट्रीय स्थानांतरण</h2>
          <p>
            हमारे होस्टिंग प्रदाता परिचालन कारणों (कैशिंग, बैकअप, फ़ेल-ओवर) से
            डेटा को सीमाओं के पार ले जा सकते हैं। ऐसे सभी स्थानांतरण प्रदाताओं
            की मानक संविदात्मक शर्तों द्वारा शासित होते हैं, जिन्हें हम आपके
            योगदान के समय आपकी ओर से स्वीकार करते हैं।
          </p>

          <h2>11. इस नीति में बदलाव</h2>
          <p>
            जैसे-जैसे साइट विकसित होती है, हम इस गोपनीयता नीति को अपडेट कर
            सकते हैं। पेज के ऊपर &ldquo;अंतिम अपडेट&rdquo; तारीख सबसे हाल के
            बदलाव को दर्शाती है। महत्वपूर्ण बदलाव होमपेज पर कम-से-कम सात दिनों
            तक चिह्नित किए जाएँगे।
          </p>

          <h2>12. संपर्क</h2>
          <p>
            BadaMangal पर आपकी गोपनीयता के बारे में प्रश्न? टीम से{" "}
            <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
            पर या <a href="/contact">कॉन्टैक्ट फ़ॉर्म</a> के माध्यम से संपर्क
            करें।
          </p>
        </>
      }
    />
  );
}
