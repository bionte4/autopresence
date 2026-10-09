import type { Prisma, Role } from "@prisma/client";
import { prisma, type Db, rethrowUnique } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const detail = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  employeeId: true,
  employee: { select: { name: true, pin: true } },
  managedDepartments: { where: { deletedAt: null }, select: { id: true } },
  customerId: true,
  customer: { select: { name: true } },
} as const;

export type UserRow = Prisma.UserGetPayload<{ select: typeof detail }>;

export async function listUsers(query: ListQuery, db: Db = prisma) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { employee: { name: { contains: query.q, mode: "insensitive" } } },
            { employee: { pin: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const orderBy = query.sort === "email" ? { email: query.direction } : { name: query.direction };
  const total = await db.user.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.user.findMany({
    where,
    orderBy,
    select: detail,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findUser(id: string, db: Db = prisma) {
  return db.user.findFirst({ where: { id, deletedAt: null }, select: detail });
}

export async function countDepartments(ids: string[], db: Db = prisma) {
  return db.department.count({ where: { id: { in: ids }, deletedAt: null } });
}

export async function customerIsActive(id: string, db: Db = prisma) {
  const row = await db.customer.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  return row !== null;
}

export async function employeeIsFree(employeeId: string, userId: string | null, db: Db = prisma) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true, user: { select: { id: true, deletedAt: true } } },
  });
  if (!employee) return "missing" as const;
  if (employee.user && employee.user.deletedAt === null && employee.user.id !== userId) return "taken" as const;
  return "ok" as const;
}

export async function insertUser(
  db: Db,
  data: {
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
    isActive: boolean;
    employeeId: string | null;
    managedDepartmentIds: string[];
    customerId: string | null;
  },
) {
  try {
    return await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role,
        isActive: data.isActive,
        customer: data.role === "CUSTOMER" && data.customerId ? { connect: { id: data.customerId } } : undefined,
        employee: data.employeeId ? { connect: { id: data.employeeId } } : undefined,
        managedDepartments:
          data.role === "MANAGER" ? { connect: data.managedDepartmentIds.map((id) => ({ id })) } : undefined,
      },
      select: detail,
    });
  } catch (error) {
    rethrowUnique(error, "Email atau tautan pegawai sudah digunakan.");
  }
}

export async function updateUser(
  db: Db,
  id: string,
  data: {
    email: string;
    name: string;
    passwordHash?: string;
    role: Role;
    isActive: boolean;
    employeeId: string | null;
    managedDepartmentIds: string[];
    customerId: string | null;
  },
) {
  try {
    const current = await db.user.findUnique({ where: { id }, select: { customerId: true } });
    const customer =
      data.role === "CUSTOMER" && data.customerId
        ? { connect: { id: data.customerId } }
        : current?.customerId
          ? { disconnect: true as const }
          : undefined;
    return await db.user.update({
      where: { id },
      data: {
        email: data.email,
        name: data.name,
        ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
        role: data.role,
        isActive: data.isActive,
        ...(customer ? { customer } : {}),
        employee: data.employeeId ? { connect: { id: data.employeeId } } : { disconnect: true },
        managedDepartments: {
          set: data.role === "MANAGER" ? data.managedDepartmentIds.map((departmentId) => ({ id: departmentId })) : [],
        },
      },
      select: detail,
    });
  } catch (error) {
    rethrowUnique(error, "Email atau tautan pegawai sudah digunakan.");
  }
}

export async function softDeleteUser(db: Db, id: string) {
  const current = await db.user.findUnique({ where: { id }, select: { customerId: true, employeeId: true } });
  return db.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
      ...(current?.employeeId ? { employee: { disconnect: true } } : {}),
      ...(current?.customerId ? { customer: { disconnect: true } } : {}),
      managedDepartments: { set: [] },
    },
    select: detail,
  });
}
