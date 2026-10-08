import type { Prisma } from "@prisma/client";
import { prisma, type Db, rethrowUnique } from "@/lib/prisma";
import { visiblePage, type ListQuery } from "@/modules/master/query";

const active = { deletedAt: null } as const;

export async function listCustomers(query: ListQuery, db: Db = prisma) {
  const where: Prisma.CustomerWhereInput = {
    ...active,
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const total = await db.customer.count({ where });
  const page = visiblePage(query.page, query.pageSize, total);
  const rows = await db.customer.findMany({
    where,
    orderBy: { name: query.direction },
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { total, rows, page };
}

export async function findCustomer(id: string, db: Db = prisma) {
  return db.customer.findFirst({ where: { id, ...active } });
}

export async function insertCustomer(db: Db, name: string) {
  try {
    return await db.customer.create({ data: { name } });
  } catch (error) {
    rethrowUnique(error, "Nama pelanggan sudah digunakan.");
  }
}

export async function updateCustomer(db: Db, id: string, name: string) {
  try {
    return await db.customer.update({ where: { id }, data: { name } });
  } catch (error) {
    rethrowUnique(error, "Nama pelanggan sudah digunakan.");
  }
}

export async function softDeleteCustomer(db: Db, id: string) {
  return db.customer.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function countActiveProjects(customerId: string, db: Db = prisma) {
  return db.project.count({ where: { customerId, deletedAt: null } });
}

export async function listCustomerOptions(db: Db = prisma) {
  return db.customer.findMany({
    where: active,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
