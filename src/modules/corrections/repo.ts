import { Prisma, type CorrectionStatus, type ReviewSeat } from "@prisma/client";
import { prisma, type Db } from "@/lib/prisma";
import type { DataScope } from "@/modules/rbac/policy";
import type { CorrectionListQuery } from "./schema";

const listSelect = {
  id: true,
  recordId: true,
  reason: true,
  status: true,
  stage: true,
  requestedById: true,
  createdAt: true,
  record: {
    select: {
      date: true,
      employee: { select: { id: true, name: true, departmentId: true } },
    },
  },
} as const;

function employeeFilter(scope: DataScope, reviewDepartmentIds: readonly string[]): Prisma.EmployeeWhereInput | undefined {
  if (scope.kind === "all") return undefined;
  const own: Prisma.EmployeeWhereInput =
    scope.kind === "self"
      ? { id: scope.employeeId ?? "__none__" }
      : { departmentId: { in: scope.departmentIds.length > 0 ? scope.departmentIds : ["__none__"] } };
  if (reviewDepartmentIds.length === 0) return own;
  if (scope.kind === "self" && !scope.employeeId) return { departmentId: { in: [...reviewDepartmentIds] } };
  if (scope.kind === "departments" && scope.departmentIds.length === 0) return { departmentId: { in: [...reviewDepartmentIds] } };
  return { OR: [own, { departmentId: { in: [...reviewDepartmentIds] } }] };
}

function scopedWhere(scope: DataScope, query: CorrectionListQuery, reviewDepartmentIds: readonly string[]): Prisma.CorrectionWhereInput {
  const employee = employeeFilter(scope, reviewDepartmentIds);
  return {
    ...(employee ? { record: { employee } } : {}),
    ...(query.status ? { status: query.status as CorrectionStatus } : {}),
    ...(query.q
      ? {
          OR: [
            { reason: { contains: query.q, mode: "insensitive" } },
            { record: { employee: { name: { contains: query.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

export async function listCorrections(scope: DataScope, query: CorrectionListQuery, reviewDepartmentIds: readonly string[] = []) {
  if (scope.kind === "self" && !scope.employeeId && reviewDepartmentIds.length === 0) return { total: 0, rows: [] };
  if (scope.kind === "departments" && scope.departmentIds.length === 0 && reviewDepartmentIds.length === 0) return { total: 0, rows: [] };
  const where = scopedWhere(scope, query, reviewDepartmentIds);
  const [total, rows] = await Promise.all([
    prisma.correction.count({ where }),
    prisma.correction.findMany({
      where,
      select: listSelect,
      orderBy: { [query.sort]: query.direction },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function findCorrection(id: string) {
  return prisma.correction.findUnique({
    where: { id },
    include: {
      record: {
        include: { employee: { select: { id: true, name: true, pin: true, departmentId: true } } },
      },
      decisions: { select: { seat: true, outcome: true, note: true, reviewer: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function findRecordScope(id: string) {
  return prisma.attendanceRecord.findUnique({
    where: { id },
    select: { id: true, employeeId: true, employee: { select: { departmentId: true } } },
  });
}

export async function findPendingCorrection(recordId: string, db: Db = prisma) {
  return db.correction.findFirst({ where: { recordId, status: "PENDING" }, select: { id: true } });
}

export async function listCorrectableRecords(scope: DataScope) {
  if (scope.kind === "self" && !scope.employeeId) return [];
  if (scope.kind === "departments" && scope.departmentIds.length === 0) return [];
  return prisma.attendanceRecord.findMany({
    where: {
      ...(scope.kind === "self" ? { employeeId: scope.employeeId ?? "__none__" } : {}),
      ...(scope.kind === "departments" ? { employee: { departmentId: { in: scope.departmentIds } } } : {}),
    },
    select: {
      id: true,
      date: true,
      clockInMin: true,
      clockOutMin: true,
      employee: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });
}

export async function insertCorrection(
  db: Db,
  data: { recordId: string; requestedById: string; changes: Prisma.InputJsonValue; reason: string; stage: ReviewSeat },
) {
  return db.correction.create({ data, select: { id: true, recordId: true, status: true, reason: true } });
}
