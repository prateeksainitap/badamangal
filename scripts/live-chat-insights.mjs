// Live-chat / live-map insights since Fri 22 May 2026 (IST).
//
// Queries the production DB (shared between localhost + prod via
// the Supabase pooler) and reports:
//   • BhandaraMention rows (the chat feed source)
//   • Spot rows (the map plot source)
//   • Bhandara rows created in the window (organizer / bot inflow)
//   • BotIngestionLog rollups (volume + outcome breakdown)
//
// Cutoff: 2026-05-22T00:00:00+05:30 → 2026-05-21T18:30:00Z (UTC).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Friday 22 May 2026, midnight IST.
const SINCE_ISO = "2026-05-21T18:30:00.000Z";
const SINCE = new Date(SINCE_ISO);

function fmtInt(n) {
  return n.toLocaleString("en-IN");
}
function pct(part, whole) {
  if (whole === 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

async function main() {
  console.log(`\nLive-chat & live-map insights`);
  console.log(`Since: Friday 22 May 2026, 00:00 IST (${SINCE_ISO})`);
  console.log(`Now:   ${new Date().toISOString()}\n`);

  // ─── BhandaraMention (the chat feed) ──────────────────────────────
  const [
    mentionsTotal,
    mentionsApproved,
    mentionsPending,
    mentionsRejected,
    mentionsWithCoords,
    mentionsSharing,
    mentionsAsking,
    mentionsMentioning,
  ] = await Promise.all([
    prisma.bhandaraMention.count({ where: { createdAt: { gte: SINCE } } }),
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: SINCE }, status: "APPROVED" },
    }),
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: SINCE }, status: "PENDING" },
    }),
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: SINCE }, status: "REJECTED" },
    }),
    prisma.bhandaraMention.count({
      where: {
        createdAt: { gte: SINCE },
        lat: { not: null },
      },
    }),
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: SINCE }, intent: "SHARING" },
    }),
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: SINCE }, intent: "ASKING" },
    }),
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: SINCE }, intent: "MENTIONING" },
    }),
  ]);

  console.log("MENTIONS (chat feed source)");
  console.log(`  Total          ${fmtInt(mentionsTotal)}`);
  console.log(
    `    APPROVED     ${fmtInt(mentionsApproved)}  (${pct(mentionsApproved, mentionsTotal)})`,
  );
  console.log(
    `    PENDING      ${fmtInt(mentionsPending)}  (${pct(mentionsPending, mentionsTotal)})`,
  );
  console.log(
    `    REJECTED     ${fmtInt(mentionsRejected)}  (${pct(mentionsRejected, mentionsTotal)})`,
  );
  console.log(
    `  With coords    ${fmtInt(mentionsWithCoords)}  (${pct(mentionsWithCoords, mentionsTotal)}) ← these also plot on the map`,
  );
  console.log(`  Intents:`);
  console.log(
    `    SHARING      ${fmtInt(mentionsSharing)}  (${pct(mentionsSharing, mentionsTotal)})`,
  );
  console.log(
    `    MENTIONING   ${fmtInt(mentionsMentioning)}  (${pct(mentionsMentioning, mentionsTotal)})`,
  );
  console.log(
    `    ASKING       ${fmtInt(mentionsAsking)}  (${pct(mentionsAsking, mentionsTotal)})\n`,
  );

  // Top groups (chat sources)
  const topGroups = await prisma.bhandaraMention.groupBy({
    by: ["groupName"],
    where: { createdAt: { gte: SINCE }, groupName: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { groupName: "desc" } },
    take: 8,
  });
  console.log("  Top WhatsApp groups by mention volume:");
  for (const g of topGroups) {
    console.log(`    ${String(g.groupName).padEnd(45)} ${fmtInt(g._count._all)}`);
  }
  console.log();

  // Daily breakdown
  const days = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Asia/Kolkata')::date AS day,
      COUNT(*)::int AS total,
      SUM(CASE WHEN "lat" IS NOT NULL THEN 1 ELSE 0 END)::int AS plotted
    FROM "BhandaraMention"
    WHERE "createdAt" >= ${SINCE}
    GROUP BY day
    ORDER BY day ASC
  `;
  console.log("  Daily breakdown (IST date · total mentions · plotted on map):");
  for (const d of days) {
    const dayName = new Date(d.day).toLocaleDateString("en-US", {
      weekday: "short",
    });
    const dayStr = new Date(d.day).toISOString().slice(0, 10);
    console.log(
      `    ${dayStr} ${dayName.padEnd(4)}  total=${String(d.total).padStart(4)}  plotted=${String(d.plotted).padStart(4)}`,
    );
  }
  console.log();

  // ─── Spot (live-map plots) ────────────────────────────────────────
  const [
    spotsTotal,
    spotsApproved,
    spotsWithCoords,
    spotsWithPhoto,
    spotsWithBoth,
    spotsLiveNow,
  ] = await Promise.all([
    prisma.spot.count({ where: { createdAt: { gte: SINCE } } }),
    prisma.spot.count({
      where: { createdAt: { gte: SINCE }, status: "APPROVED" },
    }),
    prisma.spot.count({
      where: {
        createdAt: { gte: SINCE },
        AND: [{ lat: { not: 0 } }, { lng: { not: 0 } }],
      },
    }),
    prisma.spot.count({
      where: { createdAt: { gte: SINCE }, photoUrl: { not: null } },
    }),
    prisma.spot.count({
      where: {
        createdAt: { gte: SINCE },
        photoUrl: { not: null },
        AND: [{ lat: { not: 0 } }, { lng: { not: 0 } }],
      },
    }),
    prisma.spot.count({
      where: {
        createdAt: { gte: SINCE },
        status: "APPROVED",
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  console.log("SPOTS (live-map plots)");
  console.log(`  Created total      ${fmtInt(spotsTotal)}`);
  console.log(
    `    APPROVED         ${fmtInt(spotsApproved)}  (${pct(spotsApproved, spotsTotal)})`,
  );
  console.log(
    `    With photo       ${fmtInt(spotsWithPhoto)}  (${pct(spotsWithPhoto, spotsTotal)})`,
  );
  console.log(
    `    With coords      ${fmtInt(spotsWithCoords)}  (${pct(spotsWithCoords, spotsTotal)}) ← these plot on the map`,
  );
  console.log(
    `    Photo + coords   ${fmtInt(spotsWithBoth)}  (${pct(spotsWithBoth, spotsTotal)}) ← the ideal "rich" plot`,
  );
  console.log(`  Currently live      ${fmtInt(spotsLiveNow)}  (within 8h TTL)\n`);

  // Top spotted areas
  const topAreas = await prisma.spot.groupBy({
    by: ["area"],
    where: { createdAt: { gte: SINCE }, area: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { area: "desc" } },
    take: 8,
  });
  console.log("  Top areas by spot volume:");
  for (const a of topAreas) {
    console.log(`    ${String(a.area).padEnd(30)} ${fmtInt(a._count._all)}`);
  }
  console.log();

  // ─── Bhandara (organizer / bot inflow) ────────────────────────────
  const [bhandarasTotal, bhandarasApproved, bhandarasFromBot] =
    await Promise.all([
      prisma.bhandara.count({ where: { createdAt: { gte: SINCE } } }),
      prisma.bhandara.count({
        where: { createdAt: { gte: SINCE }, status: "APPROVED" },
      }),
      prisma.bhandara.count({
        where: {
          createdAt: { gte: SINCE },
          description: { contains: "[bot:" },
        },
      }),
    ]);
  console.log("BHANDARAS (new listings created in window)");
  console.log(`  Total              ${fmtInt(bhandarasTotal)}`);
  console.log(
    `    APPROVED         ${fmtInt(bhandarasApproved)}  (${pct(bhandarasApproved, bhandarasTotal)})`,
  );
  console.log(
    `    From WA bot      ${fmtInt(bhandarasFromBot)}  (${pct(bhandarasFromBot, bhandarasTotal)})`,
  );
  console.log(
    `    Manual entries   ${fmtInt(bhandarasTotal - bhandarasFromBot)}  (${pct(bhandarasTotal - bhandarasFromBot, bhandarasTotal)})\n`,
  );

  // ─── BotIngestionLog (ingest funnel) ─────────────────────────────
  try {
    const ingestOutcomes = await prisma.botIngestionLog.groupBy({
      by: ["outcome"],
      where: { createdAt: { gte: SINCE } },
      _count: { _all: true },
      orderBy: { _count: { outcome: "desc" } },
    });
    const ingestTotal = ingestOutcomes.reduce(
      (sum, o) => sum + o._count._all,
      0,
    );
    console.log("INGEST FUNNEL (every /api/bot/* attempt)");
    console.log(`  Total attempts     ${fmtInt(ingestTotal)}`);
    for (const o of ingestOutcomes) {
      console.log(
        `    ${String(o.outcome).padEnd(28)} ${fmtInt(o._count._all)}  (${pct(o._count._all, ingestTotal)})`,
      );
    }
    console.log();
  } catch (err) {
    console.log("(BotIngestionLog query failed:", err.message, ")\n");
  }

  // ─── Mentions by language (bonus) ────────────────────────────────
  const langs = await prisma.bhandaraMention.groupBy({
    by: ["language"],
    where: { createdAt: { gte: SINCE } },
    _count: { _all: true },
    orderBy: { _count: { language: "desc" } },
  });
  console.log("MENTIONS BY LANGUAGE");
  for (const l of langs) {
    console.log(
      `  ${String(l.language).padEnd(8)} ${fmtInt(l._count._all)}  (${pct(l._count._all, mentionsTotal)})`,
    );
  }
  console.log();

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exitCode = 1;
});
