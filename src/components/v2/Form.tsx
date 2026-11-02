import type { ReactNode } from "react";

/**
 * Form styling that WRAPS existing inputs: it never changes names,
 * validation, handlers or API calls. Two ways to use it:
 *
 * 1. Wrap a whole existing form's markup in <FormSkin> and every
 *    input, textarea, select, checkbox and radio inside picks up the
 *    kit style (52px fields, gold hairline, saffron focus ring).
 * 2. Build new rows with <Field>, which adds the label, hint and error
 *    around whatever control you pass as children.
 *
 *   <Field label="Your name" htmlFor="name" hint="As you want it shown">
 *     <input id="name" name="name" value={v} onChange={...} />
 *   </Field>
 *
 * Panels: <FormPanel> is the one soft surface allowed (a form needs a
 * frame); never put a panel inside a panel.
 */
export function FormSkin({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bmi-form ${className}`.trim()}>{children}</div>;
}

export function FormPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bmi-panel ${className}`.trim()}>{children}</div>;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  lang,
  asLabel,
  className = "",
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** Shows a quiet "optional" after the label. Pass the word in the page language. */
  optional?: ReactNode;
  children: ReactNode;
  lang?: string;
  /** Render the whole row as a <label> that wraps its control (for an
   *  existing form whose inputs carry no id). Keeps the click to focus
   *  behaviour the old markup had. */
  asLabel?: boolean;
  className?: string;
}) {
  if (asLabel) {
    return (
      <label className={`bmi-field ${className}`.trim()}>
        <span className="bmi-field-label" lang={lang}>
          {label}
          {optional ? <span className="opt">{optional}</span> : null}
        </span>
        {children}
        {hint && !error ? <span className="bmi-field-hint">{hint}</span> : null}
        {error ? (
          <span className="bmi-field-err" role="alert">
            {error}
          </span>
        ) : null}
      </label>
    );
  }
  return (
    <div className={`bmi-field ${className}`.trim()}>
      {htmlFor ? (
        <label htmlFor={htmlFor} lang={lang}>
          {label}
          {optional ? <span className="opt">{optional}</span> : null}
        </label>
      ) : (
        <span className="bmi-field-label" lang={lang}>
          {label}
          {optional ? <span className="opt">{optional}</span> : null}
        </span>
      )}
      {children}
      {hint && !error ? <p className="bmi-field-hint">{hint}</p> : null}
      {error ? (
        <p className="bmi-field-err" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Wraps an existing <select> so it gets the kit chevron and field
 *  style (the native list still opens, which is right on phones). */
export function Select({ children }: { children: ReactNode }) {
  return <div className="bmi-select bmi-field">{children}</div>;
}

/** Checkbox or radio with its label, a 48px tap row. */
export function Check({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label className="bmi-check" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

/**
 * Where you are in a multi step form. `current` is 0 based. Phones
 * show only the current step's label, the others as numbered dots.
 */
export function Stepper({ steps, current, label = "Progress" }: { steps: ReactNode[]; current: number; label?: string }) {
  return (
    <ol className="bmi-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={i} className={i < current ? "done" : undefined} aria-current={i === current ? "step" : undefined}>
          <span className="lbl">{s}</span>
        </li>
      ))}
    </ol>
  );
}
