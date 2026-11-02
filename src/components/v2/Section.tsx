import type { ReactNode } from "react";
import Heading from "./Heading";

/**
 * A page section: generous top space, the content width the header
 * uses, and an optional head (kicker, h2, one line, a "see all" link).
 *
 *   <Section id="nearby" title={{ en: "Bhandaras in nearby areas", hi: "पास के क्षेत्रों के भंडारे" }}
 *            lede={<T en="..." hi="..." />} action={<Button variant="text" href="/">All areas</Button>}>
 *     <RowList>...</RowList>
 *   </Section>
 *
 * `heading` replaces `title` for an h2 with a link inside. `tone="paper"`
 * lays the warmer paper wash behind the section (fades at both ends,
 * no hard line). `narrow` for reading width (prose, forms).
 */
export default function Section({
  id,
  kicker,
  title,
  heading,
  lede,
  action,
  center,
  tone,
  tight,
  narrow,
  children,
  className = "",
  labelledBy,
}: {
  id?: string;
  kicker?: ReactNode;
  title?: { en: string; hi: string };
  heading?: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  center?: boolean;
  tone?: "paper";
  tight?: boolean;
  narrow?: boolean;
  children?: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const hid = labelledBy ?? (id ? `${id}-h` : undefined);
  const hasHead = kicker || title || heading || lede || action;
  return (
    <section
      id={id}
      aria-labelledby={labelledBy ?? (title || heading ? hid : undefined)}
      className={`bmi-sec ${tone === "paper" ? "paper" : ""} ${tight ? "tight" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      <div className={`bmi-wrap ${narrow ? "narrow" : ""}`.trim()}>
        {hasHead ? (
          <SectionHead
            id={hid}
            kicker={kicker}
            title={title}
            heading={heading}
            lede={lede}
            action={action}
            center={center}
          />
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function SectionHead({
  id,
  kicker,
  title,
  heading,
  lede,
  action,
  center,
}: {
  id?: string;
  kicker?: ReactNode;
  title?: { en: string; hi: string };
  heading?: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`bmi-sec-head ${center ? "center" : ""}`.trim()}>
      <div>
        {kicker}
        {heading ?? (title ? <Heading as="h2" id={id} en={title.en} hi={title.hi} /> : null)}
        {lede ? (
          <p className="bmi-lede" data-rv>
            {lede}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
