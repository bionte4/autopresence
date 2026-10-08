import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "@/modules/uploads/dates";

export async function listUploadsOverlapping(from: string, to: string) {
  return prisma.upload.findMany({
    where: {
      periodStart: { lte: dateOnly(to) },
      periodEnd: { gte: dateOnly(from) },
    },
    select: { id: true, granularity: true, periodStart: true, periodEnd: true, status: true, originalName: true },
  });
}

export async function insertMissingAnomaly(input: { dedupeKey: string; message: string; severity: "HIGH" }) {
  try {
    return await prisma.anomaly.create({
      data: {
        type: "MISSING_UPLOAD",
        severity: input.severity,
        message: input.message,
        details: {},
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

export async function closeMissingAnomaly(dedupeKey: string) {
  const existing = await prisma.anomaly.findUnique({ where: { dedupeKey }, select: { id: true, status: true } });
  if (!existing || existing.status === "RESOLVED" || existing.status === "FALSE_POSITIVE") return null;
  return prisma.anomaly.update({
    where: { id: existing.id },
    data: { status: "RESOLVED", resolvedNote: "Upload diterima.", resolvedAt: new Date() },
    select: { id: true },
  });
}

export async function findDigestJob(date: string) {
  return prisma.job.findFirst({
    where: { type: "digest.daily", payload: { path: ["date"], equals: date } },
    select: { id: true },
  });
}

export async function markDigestEmail(userId: string, title: string, status: string) {
  return prisma.notification.updateMany({
    where: { userId, title, channel: "EMAIL", status: "PENDING" },
    data: { status, attempts: 1 },
  });
}

export async function insertDigestJob(date: string) {
  return prisma.job.create({
    data: { type: "digest.daily", payload: { date }, status: "DONE" },
    select: { id: true },
  });
}

export async function digestFacts(from: string, to: string, threshold: number) {
  const [openAnomalies, missingUploads, rules, rows, hr] = await Promise.all([
    prisma.anomaly.count({ where: { status: "OPEN" } }),
    prisma.anomaly.count({ where: { status: "OPEN", type: "MISSING_UPLOAD" } }),
    prisma.anomalyRule.findUnique({ where: { type: "REPEATED_LATE" }, select: { threshold: true } }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: dateOnly(from), lte: dateOnly(to) }, lateMin: { not: null } },
      select: { employeeId: true, lateMin: true, employee: { select: { name: true, schedule: { select: { lateToleranceMin: true } } } } },
    }),
    prisma.user.findMany({
      where: { role: "HR_ADMIN", isActive: true, deletedAt: null },
      select: { id: true, email: true },
    }),
  ]);
  const limit = rules?.threshold ?? threshold;
  const counts = new Map<string, { name: string; late: number }>();
  for (const row of rows) {
    const tolerance = row.employee.schedule.lateToleranceMin;
    if ((row.lateMin ?? 0) <= tolerance) continue;
    const current = counts.get(row.employeeId) ?? { name: row.employee.name, late: 0 };
    current.late += 1;
    counts.set(row.employeeId, current);
  }
  const repeated = [...counts.values()].filter((item) => item.late >= limit).sort((left, right) => right.late - left.late);
  return { openAnomalies, missingUploads, repeated, hr };
}
