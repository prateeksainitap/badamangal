"use client";

/**
 * Selection state + sticky bulk-action bar for moderation queues.
 *
 *   <QueueSelectionProvider>
 *     {rows.map(r => <RowWithCheckbox id={r.id}>...</RowWithCheckbox>)}
 *     <BulkActionBar actions={[...]} />
 *   </QueueSelectionProvider>
 *
 * The provider owns a `Set<string>` of selected row ids. <RowCheckbox>
 * reads + writes that set via context. <BulkActionBar> renders the
 * sticky bottom bar (visible only when count > 0) with each action
 * as its own <form> POSTing to a server action — the form's hidden
 * inputs serialise the selected ids so the server gets them via
 * `formData.getAll("ids")`.
 *
 * Why context instead of prop drilling: the queue page is a server
 * component, the rows are server components, only the checkbox +
 * bar are client. Context lets the client islands talk to each
 * other without dragging the row renderer client-side.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import SubmitButton from "@/components/admin/SubmitButton";

type SelectionContext = {
  ids: ReadonlySet<string>;
  toggle: (id: string) => void;
  clear: () => void;
  selectAll: (ids: string[]) => void;
  /** Total rows currently rendered — used by the "X of Y" label
   *  inside the bar. The provider doesn't track this itself; it's
   *  set by the page via the `total` prop. */
  total: number;
};

const Ctx = createContext<SelectionContext | null>(null);

export function QueueSelectionProvider({
  total,
  children,
}: {
  total: number;
  children: ReactNode;
}) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setIds(new Set()), []);

  const selectAll = useCallback((rowIds: string[]) => {
    setIds(new Set(rowIds));
  }, []);

  const value = useMemo(
    () => ({ ids, toggle, clear, selectAll, total }),
    [ids, toggle, clear, selectAll, total],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useQueueSelection(): SelectionContext {
  const v = useContext(Ctx);
  if (!v)
    throw new Error(
      "useQueueSelection must be used inside <QueueSelectionProvider>",
    );
  return v;
}

/* ────────────────────── RowCheckbox ───────────────────────────── */

/** Per-row checkbox. Pass it the row id; it reads/writes the
 *  selection set via context. Rendered as a small square button so
 *  it sits cleanly inside the dark row-card grid. */
export function RowCheckbox({
  id,
  label,
}: {
  id: string;
  /** Accessible label, ideally the row's primary title (e.g. the
   *  bhandara name) so screen readers can disambiguate between
   *  rows. Defaults to "Select row". */
  label?: string;
}) {
  const { ids, toggle } = useQueueSelection();
  const checked = ids.has(id);
  return (
    <label
      className={[
        "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md border cursor-pointer transition-colors mt-1.5",
        checked
          ? "bg-saffron-500 border-saffron-500 text-cream-50"
          : "bg-cream-50/[0.04] border-cream-50/20 hover:border-cream-50/40 text-transparent hover:text-cream-50/30",
      ].join(" ")}
      aria-label={label ?? "Select row"}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggle(id)}
        className="sr-only"
      />
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </label>
  );
}

/* ────────────────────── BulkActionBar ─────────────────────────── */

export type BulkActionDef = {
  /** Internal key — used as React key, doesn't go to server. */
  key: string;
  /** Button label. */
  label: string;
  /** Server action to call. Receives a FormData with multivalue
   *  `ids` entries. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (formData: FormData) => Promise<any>;
  /** Visual variant. Defaults to "outline-saffron". */
  variant?:
    | "primary-green"
    | "primary-saffron"
    | "outline-saffron"
    | "outline-alert"
    | "outline-ink";
  /** Optional confirm prompt before submit. */
  confirm?: string;
  /** Pending-state label. */
  pendingLabel?: string;
};

export function BulkActionBar({
  actions,
  /** Optional list of all row ids visible on the page — when
   *  provided, the "Select all" button activates. Pass `undefined`
   *  to hide that button. */
  allRowIds,
}: {
  actions: BulkActionDef[];
  allRowIds?: string[];
}) {
  const { ids, clear, selectAll, total } = useQueueSelection();
  const selectedIds = Array.from(ids);
  const count = selectedIds.length;

  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-2rem)]"
    >
      <div className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-cyan-400/30 bg-[#080A10]/95 backdrop-blur-md shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] px-3 sm:px-4 py-2.5">
        {/* Count chip */}
        <div className="inline-flex items-center gap-2 pr-2 sm:pr-3 sm:border-r border-cyan-400/15">
          <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 text-xs font-semibold font-mono tabular-nums px-2 py-0.5 min-w-[1.75rem] shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]">
            {count}
          </span>
          <span className="text-xs text-cream-50/85 hidden sm:inline">
            selected
            {total > 0 ? (
              <span className="text-cream-50/45 ml-1">of {total}</span>
            ) : null}
          </span>
        </div>

        {/* Select-all (when caller passed allRowIds + < all are selected) */}
        {allRowIds && count < allRowIds.length ? (
          <button
            type="button"
            onClick={() => selectAll(allRowIds)}
            className="hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-[11px] text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.05] transition-colors"
          >
            Select all
          </button>
        ) : null}

        {/* Action buttons — each is its own form with the selected
            ids serialised as multiple <input name="ids" value=…>
            hidden inputs.

            The action callback is wrapped so the selection clears
            once the server action finishes. Without this, rows stay
            visually "selected" (orange checkboxes ticked) after the
            operator hits Delist / Merge / Verify in bulk, even
            though the server-side mutation completed and the page
            data refreshed. The bar would also linger because
            `count > 0`. Real complaint from /admin/spots — after
            clicking Delist 2 the same 2 rows kept their tick marks.

            Wrapped in try/finally so clear() runs even when the
            server action throws (e.g. Next's NEXT_REDIRECT control-
            flow throw from `redirect()`, or a validation error). The
            page already revalidates on the server side; the only
            client state we own is the selection set. */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {actions.map((a) => {
            const wrappedAction = async (formData: FormData) => {
              try {
                await a.action(formData);
              } finally {
                clear();
              }
            };
            return (
              <form key={a.key} action={wrappedAction}>
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="ids" value={id} />
                ))}
                <SubmitButton
                  variant={a.variant ?? "outline-saffron"}
                  pendingLabel={a.pendingLabel ?? "Working…"}
                  confirm={
                    a.confirm
                      ? a.confirm.replace("{n}", String(count))
                      : undefined
                  }
                >
                  {a.label.replace("{n}", String(count))}
                </SubmitButton>
              </form>
            );
          })}
        </div>

        {/* Dismiss / clear selection */}
        <button
          type="button"
          onClick={clear}
          aria-label="Clear selection"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-cream-50/55 hover:text-cream-50 hover:bg-cream-50/[0.05] transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
