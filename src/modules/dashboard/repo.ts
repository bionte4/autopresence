import { prisma } from "@/lib/prisma";
import type { DataScope } from "@/modules/rbac/policy";
import { dateOnly } from "@/modules/uploads/dates";

export type EmployeeFilter = {
  scope: DataScope;
  departmentId?: string;
  employeeId?: string;
  q?: string;
};

const employeeSelect = {
  id: true,
  pin: true,
  name: true,
  departmentId: true,
  department: { select: { name: true } },
  schedule: { select: { lateToleranceMin: true } },
} as const;

function emptyScope(scope: DataScope): boolean {
  if (scope.kind === "self") return !scope.employeeId;
  if (scope.kind === "departments") return scope.departmentIds.length === 0;
  return false;
}

export async function findDashboardEmployees(filter: EmployeeFilter) {
  if (emptyScope(filter.scope)) return [];
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...(filter.scope.kind === "self" ? { id: filter.scope.employeeId ?? undefined } : {}),
      ...(filter.scope.kind === "departments"
        ? { departmentId: { in: filter.departmentId ? [filter.departmentId] : filter.scope.departmentIds } }
        : {}),
      ...(filter.scope.kind === "all" && filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.employeeId ? { id: filter.employeeId } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: "insensitive" } },
              { pin: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: employeeSelect,
    orderBy: { name: "asc" },
  });
}

export async function findEmployeeInScope(id: string, scope: DataScope) {
  if (scope.kind === "self" && scope.employeeId !== id) return null;
  if (scope.kind === "departments" && scope.departmentIds.length === 0) return null;
  return prisma.employee.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(scope.kind === "departments" ? { departmentId: { in: scope.departmentIds } } : {}),
    },
    select: employeeSelect,
  });
}

export async function findAttendanceInRange(employeeIds: string[], from: string, to: string) {
  if (employeeIds.length === 0) return [];
  return prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: { gte: dateOnly(from), lte: dateOnly(to) },
    },
    select: {
      employeeId: true,
      date: true,
      lateMin: true,
      actualLateMin: true,
      note: true,
      isWorkday: true,
      clockInMin: true,
      clockOutMin: true,
    },
  });
}

export async function countOpenAnomalies(employeeIds: string[], from: string, to: string, includeUnassigned: boolean) {
  if (employeeIds.length === 0 && !includeUnassigned) return 0;
  return prisma.anomaly.count({
    where: {
      status: "OPEN",
      AND: [
        { OR: [{ date: null }, { date: { gte: dateOnly(from), lte: dateOnly(to) } }] },
        includeUnassigned
          ? { OR: [{ employeeId: { in: employeeIds } }, { employeeId: null }] }
          : { employeeId: { in: employeeIds } },
      ],
    },
  });
}

export async function findLatestUpload(employeeIds: string[] | "all") {
  if (employeeIds !== "all" && employeeIds.length === 0) return null;
  return prisma.upload.findFirst({
    where: employeeIds === "all" ? undefined : { records: { some: { employeeId: { in: employeeIds } } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalName: true, status: true, periodStart: true, periodEnd: true, sha256: true, createdAt: true },
  });
}

export async function listDepartmentOptions(scope: DataScope) {
  if (scope.kind === "self") return [];
  if (scope.kind === "departments" && scope.departmentIds.length === 0) return [];
  return prisma.department.findMany({
    where: {
      deletedAt: null,
      ...(scope.kind === "departments" ? { id: { in: scope.departmentIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
