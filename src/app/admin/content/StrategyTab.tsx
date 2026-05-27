import ContentCard from "./ContentCard";
import ContentEditor from "./ContentEditor";
import { EmptyState } from "./PitchesTab";
import { safeContentFindMany } from "./contentQuery";

/**
 * Strategy tab, long-form planning docs.
 *
 * Visitor personas, off-season calendar, marketing strategy. These
 * don't need the audience/channel pivots that pitches and templates
 * have; they're internal planning material with a flatter list.
 */
export default async function StrategyTab() {
  // Same migration-safe helper PitchesTab uses, so this page renders
  // even when the send-tracking columns aren't in the DB yet.
  const rows = await safeContentFindMany({
    where: { kind: "STRATEGY", status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <ContentEditor defaultKind="STRATEGY" defaultAudience="INTERNAL" defaultChannel="INTERNAL" />
      {rows.length === 0 ? (
        <EmptyState
          title="No strategy docs yet"
          hint="Personas, calendar, off-season strategy, anything long-form planning material. The import banner up top loads the seven /notes/ markdown files at once."
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <ContentCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
