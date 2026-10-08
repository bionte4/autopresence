import type { Prisma } from "@prisma/client";
import { prisma, type Db, rethrowUnique } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const detail = {
  id: true,
  pin: true,
  name: true,
  isActive: true,
  departmentId: true,
  scheduleId: true,
  department: { select: { id: true, name: true } },
  schedule: { select: { id: true, name: true } },
} as const;

export type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof detail }>;

export async function listEmployees(query: ListQuery, db: Db = prisma) {
  const where: Prisma.EmployeeWhereInput = {
    deletedAt: null,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { pin: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy = query.sort === "pin" ? { pin: query.direction } : { name: query.direction };
  const total = await db.employee.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.employee.findMany({
    where,
    orderBy,
    select: detail,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findEmployee(id: string, db: Db = prisma) {
  return db.employee.findFirst({ where: { id, deletedAt: null }, select: detail });
}

export async function departmentExists(id: string, db: Db = prisma) {
  const row = await db.department.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  return Boolean(row);
}

export async function scheduleExists(id: string, db: Db = prisma) {
  const row = await db.workSchedule.findUnique({ where: { id }, select: { id: true } });
  return Boolean(row);
}

export async function insertEmployee(db: Db, data: Prisma.EmployeeCreateInput) {
  try {
    return await db.employee.create({ data, select: detail });
  } catch (error) {
    rethrowUnique(error, "PIN pegawai sudah digunakan.");
  }
}

export async function updateEmployee(db: Db, id: string, data: Prisma.EmployeeUpdateInput) {
  try {
    return await db.employee.update({ where: { id }, data, select: detail });
  } catch (error) {
    rethrowUnique(error, "PIN pegawai sudah digunakan.");
  }
}

export async function softDeleteEmployee(db: Db, id: string) {
  return db.employee.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: detail,
  });
}

export async function listEmployeeOptions(db: Db = prisma) {
  return db.employee.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, pin: true },
  });
}
