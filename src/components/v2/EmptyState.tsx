import type { ReactNode } from "react";
import Heading from "./Heading";

/**
 * When a list has nothing in it. Reads as an invitation, never as a
 * failure: no "0", no "nothing found" in red. The painted pattal is
 * the default art.
 *
 *   <EmptyState title={{ en: "Be the first in Aliganj", hi: "अलीगंज में पहले बनें" }}
 *               lede={<T en="..." hi="..." />}
 *               actions={<Actions><Button href="/list-bhandara?lang=en">List a bhandara</Button></Actions>} />
 */
export default function EmptyState({
  title,
  heading,
  lede,
  actions,
  art = { src: "/illustrations/empty-state-plate.webp", width: 1254, height: 1254 },
  headingAs = "h2",
}: {
  title?: { en: string; hi: string };
  heading?: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  art?: { src: string; width: number; height: number } | null;
  headingAs?: "h2" | "h3" | "p";
}) {
  return (
    <div className="bmi-empty">
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="bmi-empty-art" src={art.src} alt="" width={art.width} height={art.height} loading="lazy" data-rv />
      ) : null}
      {heading ?? (title ? <Heading as={headingAs} size="sub" en={title.en} hi={title.hi} /> : null)}
      {lede ? (
        <p className="bmi-lede" data-rv>
          {lede}
        </p>
      ) : null}
      {actions}
    </div>
  );
}
