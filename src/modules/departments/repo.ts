import type { Prisma } from "@prisma/client";
import { prisma, type Db, rethrowUnique } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const active = { deletedAt: null } as const;

export async function listDepartments(query: ListQuery, db: Db = prisma) {
  const where: Prisma.DepartmentWhereInput = {
    ...active,
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const total = await db.department.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.department.findMany({
    where,
    orderBy: { name: query.direction },
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findDepartment(id: string, db: Db = prisma) {
  return db.department.findFirst({ where: { id, ...active } });
}

export async function insertDepartment(db: Db, name: string) {
  try {
    return await db.department.create({ data: { name } });
  } catch (error) {
    rethrowUnique(error, "Nama departemen sudah digunakan.");
  }
}

export async function updateDepartment(db: Db, id: string, name: string) {
  try {
    return await db.department.update({ where: { id }, data: { name } });
  } catch (error) {
    rethrowUnique(error, "Nama departemen sudah digunakan.");
  }
}

export async function softDeleteDepartment(db: Db, id: string) {
  return db.department.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function listDepartmentOptions(db: Db = prisma) {
  return db.department.findMany({
    where: active,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
