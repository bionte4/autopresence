import { prisma } from "@/lib/prisma";
import { dateOnly, isoDate } from "@/modules/uploads/dates";
import type { SoftDay } from "./aggregate";

export async function findSoftLaborDays(employeeIds: string[], from: string, to: string): Promise<SoftDay[]> {
  if (employeeIds.length === 0) return [];
  const rows = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: { gte: dateOnly(from), lte: dateOnly(to) },
    },
    select: {
      employeeId: true,
      date: true,
      isWorkday: true,
      scheduleOutMin: true,
      clockInMin: true,
      clockOutMin: true,
      actualMin: true,
      lateLeaveMin: true,
      note: true,
    },
    orderBy: [{ employeeId: "asc" }, { date: "asc" }],
  });
  return rows.map((row) => ({
    employeeId: row.employeeId,
    date: isoDate(row.date),
    isWorkday: row.isWorkday,
    scheduleOutMin: row.scheduleOutMin,
    clockInMin: row.clockInMin,
    clockOutMin: row.clockOutMin,
    actualMin: row.actualMin,
    lateLeaveMin: row.lateLeaveMin,
    note: row.note,
  }));
}

export async function findApprovedOvertimeMinutes(employeeIds: string[], from: string, to: string) {
  if (employeeIds.length === 0) return [];
  const rows = await prisma.attendanceRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      kind: "OVERTIME",
      status: "APPROVED",
      startDate: { gte: dateOnly(from), lte: dateOnly(to) },
    },
    select: { employeeId: true, startDate: true, overtimeMin: true },
  });
  return rows.map((row) => ({
    employeeId: row.employeeId,
    date: isoDate(row.startDate),
    overtimeMin: row.overtimeMin ?? 0,
  }));
}
