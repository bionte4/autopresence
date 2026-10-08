import { Prisma, type AnomalyStatus, type AnomalyType, type Severity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DataScope } from "@/modules/rbac/policy";
import { dateOnly } from "@/modules/uploads/dates";
import type { AnomalyListQuery } from "./schema";

const listSelect = {
  id: true,
  type: true,
  severity: true,
  status: true,
  message: true,
  date: true,
  employeeId: true,
  uploadId: true,
  createdAt: true,
  employee: { select: { name: true, departmentId: true } },
} as const;

function scopedWhere(scope: DataScope, query: AnomalyListQuery): Prisma.AnomalyWhereInput {
  return {
    ...(scope.kind === "departments" ? { employee: { departmentId: { in: scope.departmentIds } } } : {}),
    ...(query.status ? { status: query.status as AnomalyStatus } : {}),
    ...(query.severity ? { severity: query.severity as Severity } : {}),
    ...(query.type ? { type: query.type as AnomalyType } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.q ? { message: { contains: query.q, mode: "insensitive" } } : {}),
    ...(query.from || query.to
      ? {
          date: {
            ...(query.from ? { gte: dateOnly(query.from) } : {}),
            ...(query.to ? { lte: dateOnly(query.to) } : {}),
          },
        }
      : {}),
  };
}

export async function listAnomalies(scope: DataScope, query: AnomalyListQuery) {
  if (scope.kind === "self" || (scope.kind === "departments" && scope.departmentIds.length === 0)) {
    return { total: 0, rows: [] };
  }
  const where = scopedWhere(scope, query);
  const [total, rows] = await Promise.all([
    prisma.anomaly.count({ where }),
    prisma.anomaly.findMany({
      where,
      select: listSelect,
      orderBy: { [query.sort]: query.direction },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function findAnomaly(id: string) {
  return prisma.anomaly.findUnique({
    where: { id },
    include: { employee: { select: { name: true, pin: true, departmentId: true } } },
  });
}

export async function markAnomaly(
  id: string,
  data: { status: AnomalyStatus; resolvedById?: string | null; resolvedNote?: string | null; resolvedAt?: Date | null },
) {
  return prisma.anomaly.update({ where: { id }, data, include: { employee: { select: { name: true, pin: true, departmentId: true } } } });
}

export async function listEmployeeOptions(scope: DataScope) {
  if (scope.kind !== "all" && scope.kind !== "departments") return [];
  if (scope.kind === "departments" && scope.departmentIds.length === 0) return [];
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...(scope.kind === "departments" ? { departmentId: { in: scope.departmentIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}
