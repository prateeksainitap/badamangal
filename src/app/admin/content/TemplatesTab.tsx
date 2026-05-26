import { prisma } from "@/lib/db";
import ContentCard from "./ContentCard";
import ContentEditor from "./ContentEditor";
import { FilterStrip, EmptyState, TEMPLATE_AUDIENCE_OPTIONS } from "./PitchesTab";

/**
 * Templates tab, Content rows where kind = "TEMPLATE".
 *
 * Copy-paste templates for WhatsApp / email / Instagram. The audience
 * pivot here is organiser / volunteer / donor (vs sponsor / press for
 * pitches), since templates skew toward community comms.
 */
export default async function TemplatesTab({
  audience,
  channel,
}: {
  audience?: string;
  channel?: string;
}) {
  const where: {
    kind: string;
    status: string;
    audience?: string;
    channel?: string;
  } = { kind: "TEMPLATE", status: "ACTIVE" };
  if (
    audience &&
    TEMPLATE_AUDIENCE_OPTIONS.some((a) => a.key === audience)
  ) {
    where.audience = audience;
  }
  if (channel) where.channel = channel;

  const rows = await prisma.content.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <FilterStrip
        audience={audience ?? ""}
        channel={channel ?? ""}
        kind="templates"
      />
      <ContentEditor defaultKind="TEMPLATE" defaultAudience="ORGANISER" defaultChannel="WHATSAPP" />
      {rows.length === 0 ? (
        <EmptyState
          title={
            audience || channel
              ? "No templates match the current filters"
              : "No templates yet"
          }
          hint={
            audience || channel
              ? "Clear the filters above or create a new template."
              : "Drafts for WhatsApp messages, email subjects, and Instagram captions live here. Use “+ New content” above to add the first one."
          }
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
