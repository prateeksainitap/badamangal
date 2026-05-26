import { notFound } from "next/navigation";
import BhandaraDetailView from "@/components/BhandaraDetailView";
import { prisma, toBhandara } from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";

// Dev-only preview route. Reads the same bhandara row the public
// `/bhandara/[slug]` page reads, but lets us override `upiId` and
// `upiQrUrl` via search params so we can visually confirm the
// `OrganiserUpiBlock` render without first writing to the prod DB.
//
//   /preview/bhandara/<slug>?upi_id=<vpa>&upi_qr=<image-url>
//
// In production this route 404s, the visible side-effect on prod is
// nothing. Locally it's the staging surface for "does the QR look
// right before I make it live for everyone."
//
// Why a separate route instead of overlaying the override on the
// real /bhandara/[slug] page:
//   • That page is ISR (revalidate=300). Touching `searchParams` on
//     it would force-dynamic the whole route on prod, costing the
//     SEO-critical perf budget for zero user benefit.
//   • A separate route can be `force-dynamic` without consequence
//     and gated on NODE_ENV so it can't accidentally leak.
//
// Once the QR is verified and we've persisted upiId + upiQrUrl to
// the DB, the real `/bhandara/<slug>` page serves the same view
// this route is just the test bench.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = Promise<{ slug: string }>;
type RouteSearch = Promise<{ upi_id?: string; upi_qr?: string }>;

export default async function BhandaraPreviewPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearch;
}) {
  // Hard kill switch, preview belongs on localhost only. A direct
  // hit on prod 404s identical to a missing slug.
  if (process.env.NODE_ENV === "production") notFound();

  const { slug } = await params;
  const { upi_id: upiIdOverride, upi_qr: upiQrOverride } = await searchParams;

  const record = await prisma.bhandara.findUnique({ where: { slug } });
  if (!record || record.status !== "APPROVED") notFound();

  const b = toBhandara(record);
  // Apply the preview overrides. Both default to whatever's already
  // on the row, so a partial query (?upi_id=… without upi_qr=…)
  // shows whatever the row currently has for the other field.
  if (upiIdOverride) b.upiId = upiIdOverride;
  if (upiQrOverride) b.upiQrUrl = upiQrOverride;

  // "Other bhandaras in <area>" panel still hydrates from the real
  // table so the rest of the page renders authentically.
  const otherRecords = await prisma.bhandara.findMany({
    where: { status: "APPROVED", area: record.area, NOT: { id: record.id } },
    take: 3,
  });
  const others = otherRecords
    .map(toBhandara)
    .filter((o) => hasUpcomingDate(o));

  return (
    <>
      {/* Visible dev banner, explicit "this is not prod" so a
          screenshot from this URL can't be mistaken for the live
          page if it ends up shared somewhere. */}
      <div className="bg-saffron-500/95 text-ink-900 text-center text-xs font-mono tracking-[0.16em] uppercase py-1.5 px-4">
        Localhost preview · upiId &amp; upiQrUrl overridden via search
        params · prod DB not touched
      </div>
      <BhandaraDetailView b={b} others={others} />
    </>
  );
}
