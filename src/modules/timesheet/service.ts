import { listApprovedOvertime } from "@/modules/requests/repo";
import { getEmployeeDashboard, type EmployeeDashboardDto } from "@/modules/dashboard/service";
import { denied, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { dateOnly, isoDate } from "@/modules/uploads/dates";
import { timesheetWorkbook, type TimesheetRow } from "./sheet";

type TimesheetDay = EmployeeDashboardDto["days"][number] & { overtimeMin: number | null };

export type TimesheetDto = Omit<EmployeeDashboardDto, "days"> & { days: TimesheetDay[] };

export async function getTimesheet(
  actor: AuthUser,
  employeeId: string,
  period: { from: string; to: string },
): Promise<ServiceResult<TimesheetDto>> {
  if (!can(actor, "attendance.read")) return denied();
  const board = await getEmployeeDashboard(actor, employeeId, period);
  if (!board.ok) return board;
  const overtime = await listApprovedOvertime(employeeId, dateOnly(period.from), dateOnly(period.to));
  const byDate = new Map(overtime.map((row) => [isoDate(row.startDate), row.overtimeMin]));
  return {
    ok: true,
    data: {
      ...board.data,
      days: board.data.days.map((day) => ({ ...day, overtimeMin: byDate.get(day.date) ?? null })),
    },
  };
}

export async function exportTimesheet(
  actor: AuthUser,
  employeeId: string,
  period: { from: string; to: string },
): Promise<ServiceResult<{ filename: string; body: Buffer }>> {
  const sheet = await getTimesheet(actor, employeeId, period);
  if (!sheet.ok) return sheet;
  const rows: TimesheetRow[] = sheet.data.days.map((day) => ({
    date: day.date,
    clockInMin: day.clockInMin,
    clockOutMin: day.clockOutMin,
    lateMin: day.late ? day.lateMin : null,
    note: day.note,
    overtimeMin: day.overtimeMin,
  }));
  return {
    ok: true,
    data: {
      filename: `timesheet-${sheet.data.employee.pin}-${period.from}-${period.to}.xlsx`,
      body: timesheetWorkbook(sheet.data.employee.name, rows),
    },
  };
}
