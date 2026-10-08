import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const select = { id: true, granularity: true, cutoffTime: true, dayOfWeek: true, dayOfMonth: true, enabled: true } as const;

const GRANULARITY_QUERY: Record<string, "DAILY" | "WEEKLY" | "MONTHLY"> = {
  harian: "DAILY",
  mingguan: "WEEKLY",
  bulanan: "MONTHLY",
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
};

export async function listUploadSchedules(query: ListQuery, db: Db = prisma) {
  const mapped = GRANULARITY_QUERY[query.q.toLowerCase()];
  const where: Prisma.UploadScheduleWhereInput = query.q
    ? { OR: [...(mapped ? [{ granularity: mapped }] : []), { cutoffTime: { contains: query.q } }] }
    : {};
  const orderBy = query.sort === "cutoffTime" ? { cutoffTime: query.direction } : { granularity: query.direction };
  const total = await db.uploadSchedule.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  return {
    total,
    page,
    rows: await db.uploadSchedule.findMany({
      where,
      orderBy,
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
      select,
    }),
  };
}

export async function findUploadSchedule(id: string, db: Db = prisma) {
  return db.uploadSchedule.findUnique({ where: { id }, select });
}

export async function insertUploadSchedule(db: Db, data: Prisma.UploadScheduleCreateInput) {
  return db.uploadSchedule.create({ data, select });
}

export async function updateUploadSchedule(db: Db, id: string, data: Prisma.UploadScheduleUpdateInput) {
  return db.uploadSchedule.update({ where: { id }, data, select });
}

export async function deleteUploadSchedule(db: Db, id: string) {
  return db.uploadSchedule.delete({ where: { id } });
}

export async function listEnabledUploadSchedules(db: Db = prisma) {
  return db.uploadSchedule.findMany({ where: { enabled: true }, select });
}
