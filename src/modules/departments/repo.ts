import { Prisma, type ReviewSeat } from "@prisma/client";
import { prisma, UniqueConflict, type Db } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const active = { deletedAt: null } as const;

const detail = {
  id: true,
  name: true,
  projectId: true,
  project: {
    select: {
      id: true,
      name: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  },
  reviewers: { select: { seat: true, userId: true, user: { select: { name: true } } } },
} as const;

export type DepartmentRow = Prisma.DepartmentGetPayload<{ select: typeof detail }>;

function rethrowDepartmentUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : [];
    if (fields.includes("projectId")) throw new UniqueConflict("Proyek sudah ditautkan ke departemen lain.");
    throw new UniqueConflict("Nama departemen sudah digunakan.");
  }
  throw error;
}

export async function listDepartments(query: ListQuery, db: Db = prisma) {
  const where: Prisma.DepartmentWhereInput = {
    ...active,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { project: { name: { contains: query.q, mode: "insensitive" } } },
            { project: { customer: { name: { contains: query.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const total = await db.department.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.department.findMany({
    where,
    orderBy: { name: query.direction },
    select: detail,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findDepartment(id: string, db: Db = prisma) {
  return db.department.findFirst({ where: { id, ...active }, select: detail });
}

export async function findActiveProject(id: string, db: Db = prisma) {
  return db.project.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
}

export async function insertDepartment(db: Db, data: { name: string; projectId: string | null }) {
  try {
    return await db.department.create({
      data: { name: data.name, projectId: data.projectId },
      select: detail,
    });
  } catch (error) {
    rethrowDepartmentUnique(error);
  }
}

export async function updateDepartment(db: Db, id: string, data: { name: string; projectId: string | null }) {
  try {
    return await db.department.update({
      where: { id },
      data: { name: data.name, projectId: data.projectId },
      select: detail,
    });
  } catch (error) {
    rethrowDepartmentUnique(error);
  }
}

export async function softDeleteDepartment(db: Db, id: string) {
  return db.department.update({
    where: { id },
    data: { deletedAt: new Date(), projectId: null },
    select: detail,
  });
}

export async function replaceReviewers(
  db: Db,
  departmentId: string,
  reviewers: Partial<Record<ReviewSeat, string | null>>,
) {
  const seats = (["TEAM_LEADER", "OPERATION_MANAGER", "PROJECT_MANAGER"] as const).flatMap((seat) => {
    const userId = reviewers[seat];
    return userId ? [{ departmentId, seat, userId }] : [];
  });
  await db.departmentReviewer.deleteMany({ where: { departmentId } });
  if (seats.length > 0) await db.departmentReviewer.createMany({ data: seats });
}

export async function listReviewerOptions(db: Db = prisma) {
  return db.user.findMany({
    where: { isActive: true, deletedAt: null, role: { not: "AUDITOR" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
    take: 200,
  });
}

export async function countActiveUsers(ids: string[], db: Db = prisma) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return 0;
  return db.user.count({ where: { id: { in: unique }, isActive: true, deletedAt: null, role: { not: "AUDITOR" } } });
}

export async function listDepartmentOptions(db: Db = prisma) {
  return db.department.findMany({
    where: active,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
