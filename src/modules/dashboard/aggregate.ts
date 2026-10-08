import { isLate } from "@/modules/ingest/validator/late";

const MISSING_PUNCH = /kurang presensi/i;
const NO_REASON = /tanpa keterangan/i;
const EXCUSED = /^(cuti|sakit)\b/i;

export type DayRow = {
  employeeId: string;
  date: string;
  lateMin: number | null;
  actualLateMin: number | null;
  note: string | null;
  isWorkday: boolean;
  clockInMin: number | null;
  clockOutMin: number | null;
  lateToleranceMin: number;
};

export type EmployeeRef = {
  id: string;
  name: string;
  pin: string;
  departmentName: string | null;
};

export type EmployeeSummary = EmployeeRef & {
  employeeId: string;
  lateCount: number;
  lateMinutes: number;
  actualLateMinutes: number;
  missingPunch: number;
  noReason: number;
};

export type DashboardKpis = {
  employees: number;
  lateEvents: number;
  lateMinutes: number;
  missingPunch: number;
  noReason: number;
  openAnomalies: number;
};

export type TrendPoint = { bucket: string; lateEvents: number };
export type HeatCell = { date: string; lateMinutes: number };
export type SortKey = "name" | "lateCount" | "lateMinutes" | "missingPunch" | "noReason";

export function rowIsLate(row: DayRow): boolean {
  return isLate({ lateMin: row.lateMin }, { lateToleranceMin: row.lateToleranceMin });
}

export function rowMissingPunch(row: Pick<DayRow, "note" | "isWorkday" | "clockInMin" | "clockOutMin">): boolean {
  if (row.note && EXCUSED.test(row.note.trim())) return false;
  if (row.note && MISSING_PUNCH.test(row.note)) return true;
  return row.isWorkday && (row.clockInMin === null || row.clockOutMin === null);
}

export function rowNoReason(note: string | null): boolean {
  return note !== null && NO_REASON.test(note);
}

export function summarizeEmployees(employees: EmployeeRef[], rows: DayRow[]): EmployeeSummary[] {
  const grouped = new Map<string, DayRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.employeeId) ?? [];
    list.push(row);
    grouped.set(row.employeeId, list);
  }
  return employees.map((employee) => {
    const days = grouped.get(employee.id) ?? [];
    const lateDays = days.filter(rowIsLate);
    return {
      ...employee,
      employeeId: employee.id,
      lateCount: lateDays.length,
      lateMinutes: lateDays.reduce((sum, day) => sum + (day.lateMin ?? 0), 0),
      actualLateMinutes: days.reduce((sum, day) => sum + (day.actualLateMin ?? 0), 0),
      missingPunch: days.filter(rowMissingPunch).length,
      noReason: days.filter((day) => rowNoReason(day.note)).length,
    };
  });
}

export function summarizeKpis(rows: EmployeeSummary[], openAnomalies: number): DashboardKpis {
  return {
    employees: rows.length,
    lateEvents: rows.reduce((sum, row) => sum + row.lateCount, 0),
    lateMinutes: rows.reduce((sum, row) => sum + row.lateMinutes, 0),
    missingPunch: rows.reduce((sum, row) => sum + row.missingPunch, 0),
    noReason: rows.reduce((sum, row) => sum + row.noReason, 0),
    openAnomalies,
  };
}

export function sortSummaries(rows: EmployeeSummary[], sort: SortKey, direction: "asc" | "desc"): EmployeeSummary[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const primary = sort === "name" ? left.name.localeCompare(right.name, "id") : left[sort] - right[sort];
    if (primary !== 0) return primary * factor;
    return left.name.localeCompare(right.name, "id");
  });
}

/** Week buckets use the ISO week of the calendar date, not the report's Total row. */
export function isoWeek(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function trend(rows: DayRow[], grain: "week" | "month"): TrendPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!rowIsLate(row)) continue;
    const bucket = grain === "month" ? row.date.slice(0, 7) : isoWeek(row.date);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, lateEvents]) => ({ bucket, lateEvents }));
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function heatmap(from: string, to: string, rows: DayRow[]): HeatCell[] {
  const minutes = new Map<string, number>();
  for (const row of rows) {
    if (!rowIsLate(row)) continue;
    minutes.set(row.date, (minutes.get(row.date) ?? 0) + (row.lateMin ?? 0));
  }
  return eachDate(from, to).map((date) => ({ date, lateMinutes: minutes.get(date) ?? 0 }));
}
