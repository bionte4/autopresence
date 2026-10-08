import { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/lib/prisma";

export async function findAnomalyForNotify(id: string) {
  return prisma.anomaly.findUnique({
    where: { id },
    select: { id: true, type: true, severity: true, message: true, employee: { select: { departmentId: true } } },
  });
}

export async function listPendingEmails(anomalyId: string) {
  return prisma.notification.findMany({
    where: { anomalyId, channel: "EMAIL", status: "PENDING" },
    select: { id: true, attempts: true, title: true, body: true, anomalyId: true, user: { select: { email: true } } },
  });
}

export async function listDispatchAnomalies(uploadId: string) {
  return prisma.anomaly.findMany({
    where: { uploadId },
    select: {
      id: true,
      type: true,
      severity: true,
      message: true,
      employee: { select: { departmentId: true } },
    },
  });
}

export async function listNotifyUsers() {
  return prisma.user.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, email: true, role: true, managedDepartments: { select: { id: true } } },
  });
}

export async function listAnomalyRules() {
  return prisma.anomalyRule.findMany();
}

export async function insertNotification(
  data: {
    userId: string;
    anomalyId: string | null;
    title: string;
    body: string;
    channel: string;
    status: string;
  },
  db: Db = prisma,
): Promise<"created" | "duplicate"> {
  try {
    await db.notification.create({ data });
    return "created";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
}

export async function listChannelNotifications(uploadId: string, channel: string, statuses: string[]) {
  return prisma.notification.findMany({
    where: { channel, status: { in: statuses }, anomaly: { uploadId } },
    select: { id: true, attempts: true, user: { select: { email: true } }, title: true, body: true, anomalyId: true },
  });
}

export async function markNotification(id: string, data: { status: string; attempts?: number }) {
  return prisma.notification.update({ where: { id }, data });
}

export async function findDispatchJob(uploadId: string) {
  const jobs = await prisma.job.findMany({
    where: { type: "anomaly.dispatch", status: { in: ["PENDING", "FAILED"] } },
    orderBy: { runAt: "asc" },
  });
  const matches = jobs.filter((job) => {
    const payload = job.payload;
    return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && payload.uploadId === uploadId);
  });
  return matches.find((job) => job.status === "PENDING") ?? matches[0] ?? null;
}

export async function listDueDispatchJobs(now: Date) {
  const jobs = await prisma.job.findMany({
    where: { type: "anomaly.dispatch", status: "PENDING", runAt: { lte: now } },
    orderBy: { runAt: "asc" },
    take: 20,
  });
  return jobs.flatMap((job) => {
    const payload = job.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.uploadId !== "string") return [];
    return [{ id: job.id, uploadId: payload.uploadId, attempts: job.attempts }];
  });
}

export async function markJob(
  id: string,
  data: { status: string; attempts: number; runAt?: Date; lastError?: string | null },
) {
  return prisma.job.update({ where: { id }, data });
}

export async function countInbox(userId: string) {
  const where = { userId, channel: "IN_APP" };
  const [total, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { total, unread };
}

export async function listInbox(userId: string, page: number, pageSize: number) {
  return prisma.notification.findMany({
    where: { userId, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, title: true, body: true, anomalyId: true, readAt: true, createdAt: true },
  });
}

export async function markInboxRead(userId: string, ids: string[] | undefined, readAt: Date) {
  return prisma.notification.updateMany({
    where: {
      userId,
      channel: "IN_APP",
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt },
  });
}

export async function countNotificationsForUser(userId: string, uploadId?: string) {
  return prisma.notification.count({
    where: { userId, ...(uploadId ? { anomaly: { uploadId } } : {}) },
  });
}
