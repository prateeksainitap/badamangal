"use client";

import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * "On air across Lucknow" press band, shown right below the hero.
 *
 * Deliberately the most produced section on the page: a radio motif
 * (pulsing ON AIR pill + animated equalizer + concentric broadcast
 * rings) over a warm radial glow, with the station logos in elevated
 * cards. Logos live in /public/press/radio. Bilingual via the shared
 * locale context like the rest of the homepage.
 */

const STATIONS: { name: string; src: string }[] = [
  { name: "Radio Mirchi", src: "/press/radio/radio-mirchi.jpg" },
  { name: "Big FM", src: "/press/radio/big-fm.png" },
  { name: "Fever FM", src: "/press/radio/fever-fm.jpg" },
];

export default function RadioCoverage() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-cream-50 via-saffron-50/60 to-cream-50 py-16 sm:py-20">
      {/* Warm radial glow at the top, the section's light source. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
        style={{
          background:
            "radial-gradient(820px 320px at 50% -8%, rgba(242,148,76,0.22), transparent 70%)",
        }}
      />
      {/* Concentric broadcast rings radiating from the ON AIR pill. */}
      <BroadcastRings />

      <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
        {/* ON AIR pill + live equalizer */}
        <div className="flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-sindoor-700/25 bg-white/85 px-3.5 py-1.5 shadow-warm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-sindoor-600 opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sindoor-600" />
            </span>
            <span className="font-mukta text-[0.6rem] font-bold uppercase tracking-[0.32em] text-sindoor-700">
              On Air
            </span>
          </span>
          <Equalizer />
        </div>

        <p className="mt-6 font-mukta text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-saffron-600">
          {isHi ? "लखनऊ के रेडियो पर" : "As heard across Lucknow"}
        </p>
        <h2
          className={`mt-3 ${
            isHi ? "font-deva" : "font-fraunces"
          } text-3xl font-semibold leading-tight text-sindoor-700 [text-wrap:balance] sm:text-4xl md:text-[2.75rem]`}
        >
          {isHi
            ? "लखनऊ की हवाओं में बड़ामंगल"
            : "Lucknow's airwaves are talking about us"}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-ink-600 sm:text-base">
          {isHi
            ? "शहर के सबसे बड़े रेडियो स्टेशनों पर बड़ामंगल की कहानी।"
            : "BadaMangal, featured on the city's biggest radio stations."}
        </p>

        {/* Station logo cards */}
        <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {STATIONS.map((s) => (
            <li key={s.name} className="min-w-0">
              <div className="group flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-gold-500/40 bg-white px-6 py-8 shadow-warm transition-all duration-300 hover:-translate-y-1 hover:border-saffron-500 hover:shadow-lg">
                <div className="flex h-20 w-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.src}
                    alt={`${s.name} logo`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-20 w-auto max-w-[82%] rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                </div>
                <p className="font-mukta text-[0.62rem] font-bold uppercase tracking-[0.26em] text-ink-600/70">
                  {s.name}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        @keyframes bmEqPulse { 0%, 100% { transform: scaleY(0.32); } 50% { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .bm-eq-bar { animation: none !important; transform: scaleY(0.7); } }
      `}</style>
    </section>
  );
}

/** Five gradient bars bouncing like a live audio meter. */
function Equalizer() {
  const bars = [0, 0.22, 0.45, 0.12, 0.33];
  return (
    <span aria-hidden className="flex h-5 items-end gap-[3px]">
      {bars.map((delay, i) => (
        <span
          key={i}
          className="bm-eq-bar h-full w-[3px] rounded-full bg-gradient-to-t from-saffron-600 to-gold-500"
          style={{
            transformOrigin: "bottom",
            animation: `bmEqPulse ${0.85 + (i % 3) * 0.22}s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Concentric gold rings radiating downward from the ON AIR pill. */
function BroadcastRings() {
  const rings = [
    { r: 90, o: 0.2 },
    { r: 165, o: 0.15 },
    { r: 245, o: 0.1 },
    { r: 330, o: 0.06 },
  ];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 -z-10 -translate-x-1/2"
    >
      <svg width="960" height="440" viewBox="0 0 960 440" fill="none">
        {rings.map((ring) => (
          <circle
            key={ring.r}
            cx="480"
            cy="44"
            r={ring.r}
            stroke="#C9A24A"
            strokeOpacity={ring.o}
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}
