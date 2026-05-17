"use client";

import {
  Card,
  EmptyState,
  JaliFrame,
  Kicker,
  Pill,
  SectionHeader,
} from "@/components/ui";
import {
  DiyaCluster,
  GadaBullet,
  JaliCorner,
  MarigoldDivider,
  SunburstSpark,
} from "@/components/ornaments";

/**
 * Internal style guide. Renders every design-system primitive, token,
 * and pattern on a single scrollable page so the team can:
 *   • visually QA brand changes (colour shifts, font swaps)
 *   • copy-paste working snippets into new sections
 *   • spot drift before it lands in production
 *
 * Companion to DESIGN_SYSTEM.md at the repo root. The page is
 * intentionally `noindex` (see metadata in /design-system/page.tsx).
 */
export default function StyleGuide() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
      {/* Page hero */}
      <header className="mb-10">
        <Kicker tone="gold">Internal · v1</Kicker>
        <h1 className="mt-3 font-fraunces font-semibold text-sindoor-700 text-4xl sm:text-5xl leading-tight">
          BadaMangal Design System
        </h1>
        <p className="mt-3 text-ink-600 max-w-2xl leading-relaxed">
          Every token, type style, ornament, and primitive that the
          public site is built from, rendered live so you can see drift
          the moment it happens. Pair this with{" "}
          <code className="text-sindoor-700">DESIGN_SYSTEM.md</code> at
          the repo root for the written rules.
        </p>
      </header>

      <Section title="Colour" anchor="colour">
        <ColourGrid />
      </Section>

      <Section title="Typography" anchor="type">
        <TypeSpecimens />
      </Section>

      <Section title="Buttons" anchor="buttons">
        <ButtonRow />
      </Section>

      <Section title="Pills" anchor="pills">
        <PillRow />
      </Section>

      <Section title="Kickers" anchor="kickers">
        <div className="space-y-3">
          <Kicker>Default saffron</Kicker>
          <Kicker tone="sindoor">Devotional sindoor</Kicker>
          <Kicker tone="gold">Editorial gold</Kicker>
          <Kicker tone="ink">Muted ink</Kicker>
          <Kicker dot>Live · with pulsing dot</Kicker>
        </div>
      </Section>

      <Section title="Section header" anchor="section-header">
        <div className="rounded-3xl border border-gold-500/40 bg-cream-50 p-8">
          <SectionHeader
            kicker="Past Bhandaras"
            headline="Bhandaras of past Tuesdays"
            body="Every Tuesday whose moment has passed, kept here on the record."
          />
        </div>
      </Section>

      <Section title="Cards" anchor="cards">
        <div className="grid gap-5 sm:grid-cols-3">
          <Card>
            <Kicker>Default</Kicker>
            <h3 className="mt-2 font-fraunces font-semibold text-sindoor-700 text-lg">
              White surface
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              The base card. White background, gold hairline, warm shadow.
            </p>
          </Card>
          <Card variant="cream">
            <Kicker tone="gold">Cream</Kicker>
            <h3 className="mt-2 font-fraunces font-semibold text-sindoor-700 text-lg">
              Tinted surface
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              Cream background; sits flush with the page colour.
            </p>
          </Card>
          <Card variant="saffron-tint">
            <Kicker tone="sindoor">Saffron tint</Kicker>
            <h3 className="mt-2 font-fraunces font-semibold text-sindoor-700 text-lg">
              Hero card
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              Diagonal gradient, used on empty states + featured panels.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="Ornaments" anchor="ornaments">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <OrnamentDemo name="<JaliCorner />">
            <div className="relative w-32 h-32">
              <JaliCorner position="tl" size={56} className="absolute top-0 left-0 text-gold-500" />
              <JaliCorner position="tr" size={56} className="absolute top-0 right-0 text-gold-500" />
              <JaliCorner position="bl" size={56} className="absolute bottom-0 left-0 text-gold-500" />
              <JaliCorner position="br" size={56} className="absolute bottom-0 right-0 text-gold-500" />
            </div>
          </OrnamentDemo>
          <OrnamentDemo name="<MarigoldDivider />">
            <MarigoldDivider size={180} className="text-gold-500" />
          </OrnamentDemo>
          <OrnamentDemo name="<SunburstSpark />">
            <SunburstSpark size={64} className="text-gold-500" />
          </OrnamentDemo>
          <OrnamentDemo name="<DiyaCluster />">
            <DiyaCluster size={80} className="text-saffron-600" />
          </OrnamentDemo>
        </div>
        <div className="mt-6 flex items-center gap-3 text-ink-600">
          <GadaBullet className="text-saffron-600" />
          <span>
            <code className="text-sindoor-700">&lt;GadaBullet /&gt;</code>,
            inline list bullet for editorial prose.
          </span>
        </div>
      </Section>

      <Section title="Empty states" anchor="empty-state">
        <EmptyState
          illustration="/illustrations/empty-state-plate.webp"
          kicker="Waiting for the first spot"
          headlineEn="The pandals are quiet right now."
          headlineHi="अभी पंडाल शांत हैं।"
          bodyEn="The moment a passer-by reports a bhandara from anywhere in Lucknow, their photo will land here within 8 seconds."
          bodyHi="जैसे ही कोई पासर्बाई कोई भंडारा रिपोर्ट करेगा, उसकी तस्वीर यहाँ हर 8 सेकंड में अपने-आप आ जाएगी।"
          primaryCta={{ href: "/spot", label: "Spot a bhandara now", ga: "design_system_demo" }}
          secondaryCta={{ href: "/", label: "Browse listed bhandaras", ga: "design_system_demo" }}
          source="design_system"
        />
      </Section>

      <Section title="JaliFrame" anchor="jali-frame">
        <JaliFrame className="rounded-3xl border border-gold-500/40 bg-cream-50 px-8 py-10 text-center">
          <p className="font-tiro text-sindoor-700 text-2xl">
            ॥ जय बजरंगबली ॥
          </p>
          <p className="mt-2 text-ink-600 text-sm">
            Wrap any positioned card with the four Awadhi-jali corners.
          </p>
        </JaliFrame>
      </Section>

      <footer className="mt-16 pt-8 border-t border-gold-500/30 text-center text-xs text-ink-600">
        BadaMangal Design System · Internal page · Pair with{" "}
        <code className="text-sindoor-700">DESIGN_SYSTEM.md</code>
      </footer>
    </main>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────── */

function Section({
  title,
  anchor,
  children,
}: {
  title: string;
  anchor: string;
  children: React.ReactNode;
}) {
  return (
    <section id={anchor} className="mt-12 sm:mt-16 scroll-mt-24">
      <h2 className="mb-5 font-fraunces font-semibold text-sindoor-700 text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ── Colour swatches ─────────────────────────────────────────────── */

function ColourGrid() {
  const swatches: { token: string; cls: string; hex: string; note: string }[] = [
    { token: "saffron-50",  cls: "bg-saffron-50",  hex: "#FFF6EE", note: "tinted backgrounds" },
    { token: "saffron-500", cls: "bg-saffron-500", hex: "#F2944C", note: "hover gradient stop" },
    { token: "saffron-600", cls: "bg-saffron-600", hex: "#E07A1F", note: "PRIMARY action" },
    { token: "sindoor-700", cls: "bg-sindoor-700", hex: "#9C2A2A", note: "DEVOTIONAL headline" },
    { token: "gold-100",    cls: "bg-gold-100",    hex: "#F5EAC9", note: "soft chip" },
    { token: "gold-500",    cls: "bg-gold-500",    hex: "#C9A24A", note: "hairlines + dividers" },
    { token: "cream-50",    cls: "bg-cream-50 border border-gold-500/40", hex: "#FBF7F0", note: "page canvas" },
    { token: "ink-600",     cls: "bg-ink-600",     hex: "#5A4F46", note: "body text" },
    { token: "ink-900",     cls: "bg-ink-900",     hex: "#1A1410", note: "high-emphasis text" },
    { token: "leaf-600",    cls: "bg-leaf-600",    hex: "#3F7A3F", note: "share / WhatsApp" },
    { token: "alert-500",   cls: "bg-alert-500",   hex: "#C44A2C", note: "form errors" },
  ];

  return (
    <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {swatches.map((s) => (
        <li
          key={s.token}
          className="rounded-2xl border border-gold-500/30 bg-white overflow-hidden shadow-warm"
        >
          <div className={`h-20 ${s.cls}`} aria-label={s.token} />
          <div className="px-3 py-2.5">
            <p className="text-sm font-semibold text-ink-900">{s.token}</p>
            <p className="text-[11px] text-ink-600 font-mono">{s.hex}</p>
            <p className="text-[11px] text-ink-600 mt-0.5">{s.note}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Type specimens ──────────────────────────────────────────────── */

function TypeSpecimens() {
  return (
    <div className="space-y-4">
      <Specimen label="h1-lg / Fraunces 80px">
        <p className="font-fraunces text-h1-lg font-semibold text-sindoor-700 [text-wrap:balance]">
          Lucknow's table is always set.
        </p>
      </Specimen>
      <Specimen label="h1 / Tiro 56px (Hindi)">
        <p className="font-tiro text-h1 text-sindoor-700 [text-wrap:balance]">
          जहाँ भक्ति, वहाँ भंडारा।
        </p>
      </Specimen>
      <Specimen label="h2 / Fraunces 36px">
        <p className="font-fraunces text-h2 font-semibold text-sindoor-700">
          Bhandaras of past Tuesdays
        </p>
      </Specimen>
      <Specimen label="pull / Cormorant 28px">
        <p className="font-cormorant italic text-pull text-ink-900 [text-wrap:pretty]">
          A quiet civic miracle, kept by twenty thousand kitchens.
        </p>
      </Specimen>
      <Specimen label="body / Mukta 17px">
        <p className="font-mukta text-body text-ink-900 max-w-2xl">
          Every Tuesday of Jyeshtha, Lucknow becomes one giant kitchen.
          In this rare 8-Tuesday year, every bhandara on one map.
        </p>
      </Specimen>
      <Specimen label="body-hi / Mukta 18px (Hindi)">
        <p className="font-mukta text-body-hi text-ink-900 max-w-2xl">
          हर मंगलवार लखनऊ एक बड़ी रसोई बन जाता है। इस दुर्लभ
          8-मंगल वर्ष में, हर भंडारा एक नक़्शे पर।
        </p>
      </Specimen>
      <Specimen label="caption / Mukta 13px tracked">
        <p className="font-mukta text-caption uppercase text-saffron-600 font-semibold">
          BADA MANGAL · LUCKNOW · 2026
        </p>
      </Specimen>
      <Specimen label="numerals / Bricolage 60px">
        <p className="font-numerals font-extrabold text-saffron-600 text-6xl tabular-nums">
          146
        </p>
      </Specimen>
    </div>
  );
}

function Specimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold-500/30 bg-white px-5 py-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-600 mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── Buttons / pills ─────────────────────────────────────────────── */

function ButtonRow() {
  return (
    <div className="space-y-4">
      <Cluster label="Variants">
        <button className="btn btn-primary">Primary</button>
        <button className="btn btn-sindoor">Sindoor</button>
        <button className="btn btn-ghost">Ghost</button>
        <button className="btn btn-soft">Soft</button>
        <button className="btn btn-leaf">Leaf</button>
      </Cluster>
      <Cluster label="Sizes">
        <button className="btn btn-primary btn-sm">Small</button>
        <button className="btn btn-primary">Default</button>
        <button className="btn btn-primary btn-lg">Large</button>
      </Cluster>
      <Cluster label="States">
        <button className="btn btn-primary" disabled>Disabled</button>
        <button className="btn btn-ghost" disabled>Disabled ghost</button>
      </Cluster>
    </div>
  );
}

function PillRow() {
  return (
    <div className="space-y-3">
      <Cluster label="Tones">
        <Pill>Saffron</Pill>
        <Pill tone="sindoor">Sindoor</Pill>
        <Pill tone="gold">Gold</Pill>
        <Pill tone="leaf">Leaf</Pill>
        <Pill tone="cream">Cream / overlay</Pill>
      </Cluster>
      <Cluster label="With dots + icons">
        <Pill dot>Live</Pill>
        <Pill tone="sindoor" dot>Today</Pill>
        <Pill tone="gold">Read · listen</Pill>
      </Cluster>
      <Cluster label="Sizes">
        <Pill size="sm">Small</Pill>
        <Pill size="md">Default</Pill>
      </Cluster>
    </div>
  );
}

function Cluster({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-600 mt-2 w-32 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function OrnamentDemo({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gold-500/30 bg-cream-50 px-4 py-6 flex flex-col items-center gap-3">
      <div className="flex items-center justify-center min-h-[120px]">
        {children}
      </div>
      <code className="text-xs text-sindoor-700">{name}</code>
    </div>
  );
}
