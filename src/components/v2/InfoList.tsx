import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

/**
 * Facts as label and value rows on gold hairlines, no cards. On phones
 * the label sits over the value; from 760px they sit side by side on
 * one baseline.
 *
 *   <InfoList>
 *     <InfoRow label={<T en="When" hi="कब" />} icon="clock">
 *       <span className="big">Tuesday, 19 May</span>
 *       <span className="sub">9 AM to 2 PM</span>
 *     </InfoRow>
 *   </InfoList>
 *
 * `labelAs="h2"` when the label is one of the page's existing SEO
 * headings ("On the thali", "Organized by"). Inside a value: `.big`
 * for the main fact, `.sub` for one quiet line, <ChipList> or
 * <Actions> for chips and links.
 */
export function InfoList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bmi-info ${className}`.trim()} data-rv>
      {children}
    </div>
  );
}

export function InfoRow({
  label,
  labelAs: L = "p",
  icon,
  id,
  lang,
  children,
}: {
  label: ReactNode;
  labelAs?: "p" | "h2" | "h3";
  icon?: IconName;
  id?: string;
  lang?: string;
  children: ReactNode;
}) {
  return (
    <div className="bmi-irow" id={id}>
      <L className="bmi-ilabel" lang={lang}>
        {icon ? <Icon name={icon} /> : null}
        {label}
      </L>
      <div className="bmi-ival">{children}</div>
    </div>
  );
}

export default InfoList;
