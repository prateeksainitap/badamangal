"use client";

import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Hero for /spot. Lives in its own client component so the page can
 * be statically prerendered (no cookies() on the server) while the
 * hero copy still respects the visitor's bm_lang cookie after mount.
 */
export default function SpotHero() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <header className="text-center mb-7">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/40 px-3 py-1 text-[0.62rem] font-mukta uppercase tracking-[0.28em] text-saffron-600 font-semibold">
        <span className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
        {isHi ? "स्पॉट करें" : "Spot"}
      </span>
      <h1
        className={`mt-3 text-3xl sm:text-[2.25rem] leading-tight ${
          isHi
            ? "font-tiro text-sindoor-700"
            : "font-fraunces font-semibold text-sindoor-700"
        }`}
      >
        {isHi
          ? "क्या आपने अभी कोई भंडारा देखा?"
          : "Spotted a bhandara nearby?"}
      </h1>
      <p className="mt-2 text-sm text-ink-600 leading-relaxed">
        {isHi
          ? "एक फ़ोटो, आपकी लोकेशन, बस। बाक़ी हम संभालेंगे।"
          : "One photo and your location is enough. We'll handle the rest."}
      </p>

      {/* Trust strip, moved to the top so people see it before doubting */}
      <div className="mt-4 inline-flex items-center gap-2 sm:gap-3 flex-wrap justify-center text-[11px] text-ink-600">
        <span className="inline-flex items-center gap-1">
          <IconClock /> {isHi ? "30 सेकंड" : "30 seconds"}
        </span>
        <span aria-hidden className="text-gold-500/55">·</span>
        <span className="inline-flex items-center gap-1">
          <IconLock /> {isHi ? "लॉगिन ज़रूरी नहीं" : "no login needed"}
        </span>
        <span aria-hidden className="text-gold-500/55">·</span>
        <span className="inline-flex items-center gap-1">
          <IconClockExpire /> {isHi ? "8 घंटे तक लाइव" : "8 hours on the map"}
        </span>
      </div>
    </header>
  );
}

function IconClock() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function IconClockExpire() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 3h6" />
    </svg>
  );
}
