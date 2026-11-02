"use client";

import { useLocaleFromContext } from "@/lib/locale-context";
import { PageHero, Kicker, Chip, ChipList } from "@/components/v2";

/**
 * Hero for /spot. Lives in its own client component so the page can
 * be statically prerendered (no cookies() on the server) while the
 * hero copy still respects the visitor's bm_lang cookie after mount.
 */
export default function SpotHero() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <PageHero
      kicker={<Kicker live>{isHi ? "स्पॉट करें" : "Spot"}</Kicker>}
      title={{
        en: "Spotted a bhandara nearby?",
        hi: "क्या आपने अभी कोई भंडारा देखा?",
      }}
      lede={
        isHi
          ? "एक फ़ोटो, आपकी लोकेशन, बस। बाक़ी हम संभालेंगे।"
          : "One photo and your location is enough. We'll handle the rest."
      }
      meta={
        // Trust strip, at the top so people see it before doubting.
        <ChipList label={isHi ? "कैसे काम करता है" : "How it works"}>
          {[
            <Chip key="t" icon="clock" tone="muted">{isHi ? "30 सेकंड" : "30 seconds"}</Chip>,
            <Chip key="l" icon="check" tone="muted">{isHi ? "लॉगिन ज़रूरी नहीं" : "No login needed"}</Chip>,
            <Chip key="m" icon="map" tone="muted">{isHi ? "8 घंटे तक लाइव" : "8 hours on the map"}</Chip>,
          ]}
        </ChipList>
      }
    />
  );
}
