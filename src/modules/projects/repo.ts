import type { Prisma } from "@prisma/client";
import { prisma, type Db, rethrowUnique } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const detail = {
  id: true,
  name: true,
  customerId: true,
  customer: { select: { id: true, name: true } },
} as const;

export type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof detail }>;

export async function listProjects(query: ListQuery, db: Db = prisma) {
  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { customer: { name: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const total = await db.project.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.project.findMany({
    where,
    orderBy: { name: query.direction },
    select: detail,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findProject(id: string, db: Db = prisma) {
  return db.project.findFirst({ where: { id, deletedAt: null }, select: detail });
}

export async function customerIsActive(id: string, db: Db = prisma) {
  const row = await db.customer.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  return Boolean(row);
}

export async function insertProject(db: Db, data: { name: string; customerId: string }) {
  try {
    return await db.project.create({
      data: { name: data.name, customer: { connect: { id: data.customerId } } },
      select: detail,
    });
  } catch (error) {
    rethrowUnique(error, "Nama proyek sudah digunakan untuk pelanggan ini.");
  }
}

export async function updateProject(db: Db, id: string, data: { name: string; customerId: string }) {
  try {
    return await db.project.update({
      where: { id },
      data: { name: data.name, customer: { connect: { id: data.customerId } } },
      select: detail,
    });
  } catch (error) {
    rethrowUnique(error, "Nama proyek sudah digunakan untuk pelanggan ini.");
  }
}

export async function softDeleteProject(db: Db, id: string) {
  return db.project.update({ where: { id }, data: { deletedAt: new Date() }, select: detail });
}

export async function countLinkedDepartments(projectId: string, db: Db = prisma) {
  return db.department.count({ where: { projectId, deletedAt: null } });
}

export async function listLinkableProjects(currentProjectId: string | null, db: Db = prisma) {
  return db.project.findMany({
    where: {
      deletedAt: null,
      OR: [{ department: { is: null } }, ...(currentProjectId ? [{ id: currentProjectId }] : [])],
    },
    orderBy: [{ customer: { name: "asc" } }, { name: "asc" }],
    select: detail,
  });
}
