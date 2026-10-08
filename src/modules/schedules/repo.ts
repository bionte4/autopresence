import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

export async function listSchedules(query: ListQuery, db: Db = prisma) {
  const where: Prisma.WorkScheduleWhereInput = query.q
    ? { name: { contains: query.q, mode: "insensitive" } }
    : {};
  const orderBy = query.sort === "startMin" ? { startMin: query.direction } : { name: query.direction };
  const total = await db.workSchedule.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.workSchedule.findMany({
    where,
    orderBy,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findSchedule(id: string, db: Db = prisma) {
  return db.workSchedule.findUnique({ where: { id } });
}

export async function insertSchedule(
  db: Db,
  data: { name: string; startMin: number; endMin: number; lateToleranceMin: number },
) {
  return db.workSchedule.create({ data });
}

export async function updateSchedule(
  db: Db,
  id: string,
  data: { name: string; startMin: number; endMin: number; lateToleranceMin: number },
) {
  return db.workSchedule.update({ where: { id }, data });
}

export async function countScheduleEmployees(scheduleId: string, db: Db = prisma) {
  return db.employee.count({ where: { scheduleId } });
}

export async function deleteSchedule(db: Db, id: string) {
  return db.workSchedule.delete({ where: { id } });
}

export async function listScheduleOptions(db: Db = prisma) {
  return db.workSchedule.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, startMin: true, endMin: true },
  });
}
