import ContentCard from "./ContentCard";
import ContentEditor from "./ContentEditor";
import { FilterBar, EmptyState, TEMPLATE_AUDIENCE_OPTIONS } from "./PitchesTab";
import { safeContentFindMany } from "./contentQuery";

/**
 * Templates tab — Content rows where kind = "TEMPLATE".
 *
 * Copy-paste templates for WhatsApp / email / Instagram. Audience
 * pivot here is organiser / volunteer / donor (vs sponsor / press
 * for pitches), since templates skew toward community comms.
 *
 * No status filter row (unlike Pitches) — templates aren't sent
 * one-off to a journalist, they're snippets the operator pastes
 * many times. The send-tracking model doesn't fit. Filter bar
 * still gives audience + channel + search.
 */
export default async function TemplatesTab({
  audience,
  channel,
  q,
}: {
  audience?: string;
  channel?: string;
  q?: string;
}) {
  const trimmedQ = (q ?? "").trim().slice(0, 200);

  // Mirror the PitchesTab where-builder, but without the status
  // filter. Hide ARCHIVED but show DRAFT + ACTIVE (Templates don't
  // get a DRAFT/ACTIVE distinction in the UI today, but keeping
  // the predicate inclusive future-proofs adding it later).
  const baseWhere: {
    kind: string;
    status: { not: string };
    audience?: string;
    channel?: string;
  } = { kind: "TEMPLATE", status: { not: "ARCHIVED" } };

  if (
    audience &&
    TEMPLATE_AUDIENCE_OPTIONS.some((a) => a.key === audience)
  ) {
    baseWhere.audience = audience;
  }
  if (channel) baseWhere.channel = channel;

  // Search across title / body / summary / tags, same pattern as
  // PitchesTab. No OR-collision concerns here since the status
  // filter doesn't introduce its own OR.
  const finalWhere: Record<string, unknown> = trimmedQ
    ? {
        ...baseWhere,
        OR: [
          { title: { contains: trimmedQ, mode: "insensitive" } },
          { body: { contains: trimmedQ, mode: "insensitive" } },
          { summary: { contains: trimmedQ, mode: "insensitive" } },
          { tags: { has: trimmedQ.toLowerCase() } },
        ],
      }
    : (baseWhere as Record<string, unknown>);

  // Defensive query via the shared helper — same migration-safe
  // fallback as PitchesTab so this page renders even when the
  // send-tracking columns haven't been added to Postgres yet.
  const rows = await safeContentFindMany({
    where: finalWhere,
    orderBy: { updatedAt: "desc" },
  });

  const hasActiveFilters =
    Boolean(audience) || Boolean(channel) || Boolean(trimmedQ);

  return (
    <div className="space-y-4">
      <FilterBar
        audience={audience ?? ""}
        channel={channel ?? ""}
        q={trimmedQ}
        filter=""
        kind="templates"
      />
      <ContentEditor defaultKind="TEMPLATE" defaultAudience="ORGANISER" defaultChannel="WHATSAPP" />
      {rows.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? "No templates match the current filters"
              : "No templates yet"
          }
          hint={
            hasActiveFilters
              ? "Clear filters above or create a new template."
              : "Drafts for WhatsApp messages, email subjects, and Instagram captions live here. Use the editor below to add the first one."
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <ContentCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
