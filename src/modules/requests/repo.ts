import { Prisma, type RequestStatus } from "@prisma/client";
import { prisma, type Db } from "@/lib/prisma";
import type { DataScope } from "@/modules/rbac/policy";
import type { RequestListQuery } from "./schema";

const listSelect = {
  id: true,
  kind: true,
  startDate: true,
  endDate: true,
  endMin: true,
  overtimeMin: true,
  reason: true,
  status: true,
  stage: true,
  requestedById: true,
  createdAt: true,
  employee: { select: { id: true, name: true, departmentId: true } },
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

function scopedWhere(scope: DataScope, query: RequestListQuery, reviewDepartmentIds: readonly string[]): Prisma.AttendanceRequestWhereInput {
  const employee = employeeFilter(scope, reviewDepartmentIds);
  return {
    ...(employee ? { employee } : {}),
    ...(query.status ? { status: query.status as RequestStatus } : {}),
    ...(query.q
      ? {
          OR: [
            { reason: { contains: query.q, mode: "insensitive" } },
            { employee: { name: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listRequests(scope: DataScope, query: RequestListQuery, reviewDepartmentIds: readonly string[] = []) {
  if (scope.kind === "self" && !scope.employeeId && reviewDepartmentIds.length === 0) return { total: 0, rows: [] };
  if (scope.kind === "departments" && scope.departmentIds.length === 0 && reviewDepartmentIds.length === 0) return { total: 0, rows: [] };
  const where = scopedWhere(scope, query, reviewDepartmentIds);
  const [total, rows] = await Promise.all([
    prisma.attendanceRequest.count({ where }),
    prisma.attendanceRequest.findMany({
      where,
      select: listSelect,
      orderBy: { [query.sort]: query.direction },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function findRequest(id: string) {
  return prisma.attendanceRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, pin: true, departmentId: true } },
      decisions: { select: { seat: true, outcome: true, note: true, reviewer: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function findRequestEmployee(id: string) {
  return prisma.employee.findFirst({
    where: { id, deletedAt: null, isActive: true },
    select: { id: true, name: true, departmentId: true, schedule: { select: { endMin: true } } },
  });
}

export async function listRequestEmployees(scope: DataScope) {
  if (scope.kind === "self" && !scope.employeeId) return [];
  if (scope.kind === "departments" && scope.departmentIds.length === 0) return [];
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(scope.kind === "self" ? { id: scope.employeeId ?? "__none__" } : {}),
      ...(scope.kind === "departments" ? { departmentId: { in: scope.departmentIds } } : {}),
    },
    select: { id: true, name: true, pin: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}

export async function findOverlap(db: Db, employeeId: string, start: Date, end: Date) {
  return db.attendanceRequest.findFirst({
    where: {
      employeeId,
      status: "PENDING",
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true },
  });
}

export async function findRecordsInRange(db: Db, employeeId: string, start: Date, end: Date) {
  return db.attendanceRecord.findMany({
    where: { employeeId, date: { gte: start, lte: end } },
    select: { id: true, date: true, note: true },
    orderBy: { date: "asc" },
  });
}

export async function listApprovedOvertime(employeeId: string, from: Date, to: Date) {
  return prisma.attendanceRequest.findMany({
    where: {
      employeeId,
      kind: "OVERTIME",
      status: "APPROVED",
      startDate: { gte: from, lte: to },
    },
    select: { startDate: true, overtimeMin: true },
  });
}
