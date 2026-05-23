import { prisma } from "../src/lib/db";

async function main() {
  const total = await prisma.bhandaraMention.count();
  const approved = await prisma.bhandaraMention.count({
    where: { status: "APPROVED" },
  });
  const live = await prisma.bhandaraMention.count({
    where: { status: "APPROVED", expiresAt: { gt: new Date() } },
  });
  const totalSpots = await prisma.spot.count();
  const liveSpots = await prisma.spot.count({
    where: { status: "APPROVED", expiresAt: { gt: new Date() } },
  });
  console.log({
    bhandaraMentions: { total, approved, livePublic: live },
    spots: { total: totalSpots, livePublic: liveSpots },
  });
}

main().finally(() => prisma.$disconnect());
