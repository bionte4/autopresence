import { eachDate, isoWeek } from "@/modules/dashboard/aggregate";

/** Soft coaching reference: common 40-hour week under Indonesian labour rules. Not a legal ruling. */
export const WEEKLY_LIMIT_MIN = 40 * 60;

/** Soft flag when someone works this many calendar days in a row without a rest day recorded. */
export const REST_STREAK_LIMIT = 7;

export type SoftDay = {
  employeeId: string;
  date: string;
  isWorkday: boolean;
  scheduleOutMin: number | null;
  clockInMin: number | null;
  clockOutMin: number | null;
  actualMin: number | null;
  lateLeaveMin: number | null;
  note: string | null;
};

export type SoftEmployee = {
  id: string;
  name: string;
  pin: string;
  departmentName: string | null;
};

export type ApprovedOvertime = {
  employeeId: string;
  date: string;
  overtimeMin: number;
};

export type WeekRow = {
  employeeId: string;
  name: string;
  departmentName: string | null;
  week: string;
  workedMin: number;
  overLimit: boolean;
  note: string;
};

export type OvertimeRow = {
  employeeId: string;
  name: string;
  departmentName: string | null;
  date: string;
  observedMin: number;
  approvedMin: number;
  gapMin: number;
  note: string;
};

export type SoftSummary = {
  employeeId: string;
  name: string;
  pin: string;
  departmentName: string | null;
  weeksOverLimit: number;
  maxWorkStreak: number;
  restFlag: boolean;
  overtimeWithoutApprovalDays: number;
  coachingNote: string;
};

export function workedMinutes(day: SoftDay): number | null {
  if (day.actualMin != null && day.actualMin > 0) return day.actualMin;
  if (day.clockInMin == null || day.clockOutMin == null) return null;
  if (day.clockOutMin < day.clockInMin) return null;
  return day.clockOutMin - day.clockInMin;
}

/** Minutes past schedule end. Prefers lateLeaveMin when present. */
export function observedOvertimeMinutes(day: SoftDay): number {
  if (day.lateLeaveMin != null && day.lateLeaveMin > 0) return day.lateLeaveMin;
  if (day.scheduleOutMin == null || day.clockOutMin == null) return 0;
  const gap = day.clockOutMin - day.scheduleOutMin;
  return gap > 0 ? gap : 0;
}

export function maxWorkStreak(from: string, to: string, days: SoftDay[]): number {
  const worked = new Set(days.filter((day) => (workedMinutes(day) ?? 0) > 0).map((day) => day.date));
  let best = 0;
  let run = 0;
  for (const date of eachDate(from, to)) {
    if (worked.has(date)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function weekRows(employee: SoftEmployee, days: SoftDay[]): WeekRow[] {
  const buckets = new Map<string, number>();
  for (const day of days) {
    const worked = workedMinutes(day);
    if (worked == null || worked <= 0) continue;
    const week = isoWeek(day.date);
    buckets.set(week, (buckets.get(week) ?? 0) + worked);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([week, workedMin]) => {
      const overLimit = workedMin > WEEKLY_LIMIT_MIN;
      return {
        employeeId: employee.id,
        name: employee.name,
        departmentName: employee.departmentName,
        week,
        workedMin,
        overLimit,
        note: overLimit
          ? "Perlu ditinjau bersama: jam aktual melewati acuan 40 jam/minggu."
          : "Dalam acuan 40 jam/minggu.",
      };
    });
}

export function overtimeRows(
  employee: SoftEmployee,
  days: SoftDay[],
  approved: ReadonlyMap<string, number>,
): OvertimeRow[] {
  const rows: OvertimeRow[] = [];
  for (const day of days) {
    const observedMin = observedOvertimeMinutes(day);
    const approvedMin = approved.get(day.date) ?? 0;
    if (observedMin <= 0 && approvedMin <= 0) continue;
    const gapMin = Math.max(0, observedMin - approvedMin);
    rows.push({
      employeeId: employee.id,
      name: employee.name,
      departmentName: employee.departmentName,
      date: day.date,
      observedMin,
      approvedMin,
      gapMin,
      note:
        gapMin > 0
          ? "Ada jam di luar jadwal tanpa pengajuan lembur yang disetujui. Diskusikan bersama sebelum ditindaklanjuti."
          : approvedMin > 0 && observedMin <= approvedMin
            ? "Lembur tercatat dan sudah ada pengajuan yang disetujui."
            : "Pengajuan lembur disetujui; jam aktual di luar jadwal belum terlihat pada hari itu.",
    });
  }
  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

export function summarizeEmployee(
  employee: SoftEmployee,
  from: string,
  to: string,
  days: SoftDay[],
  approved: ReadonlyMap<string, number>,
): SoftSummary {
  const weeks = weekRows(employee, days);
  const overtime = overtimeRows(employee, days, approved);
  const weeksOverLimit = weeks.filter((row) => row.overLimit).length;
  const maxStreak = maxWorkStreak(from, to, days);
  const restFlag = maxStreak >= REST_STREAK_LIMIT;
  const overtimeWithoutApprovalDays = overtime.filter((row) => row.gapMin > 0).length;
  const parts: string[] = [];
  if (weeksOverLimit > 0) {
    parts.push(`${weeksOverLimit} minggu di atas acuan 40 jam`);
  }
  if (restFlag) {
    parts.push(`rentetan kerja ${maxStreak} hari tanpa istirahat tercatat`);
  }
  if (overtimeWithoutApprovalDays > 0) {
    parts.push(`${overtimeWithoutApprovalDays} hari lembur teramati tanpa persetujuan`);
  }
  return {
    employeeId: employee.id,
    name: employee.name,
    pin: employee.pin,
    departmentName: employee.departmentName,
    weeksOverLimit,
    maxWorkStreak: maxStreak,
    restFlag,
    overtimeWithoutApprovalDays,
    coachingNote:
      parts.length > 0
        ? `Bahan pembinaan: ${parts.join("; ")}. Bukan sanksi otomatis.`
        : "Tidak ada temuan pada acuan jam mingguan, istirahat, dan lembur vs pengajuan.",
  };
}

export function buildSoftLaborReport(
  employees: SoftEmployee[],
  from: string,
  to: string,
  days: SoftDay[],
  approvedRows: ApprovedOvertime[],
): { summaries: SoftSummary[]; weeks: WeekRow[]; overtime: OvertimeRow[] } {
  const byEmployee = new Map<string, SoftDay[]>();
  for (const day of days) {
    const list = byEmployee.get(day.employeeId) ?? [];
    list.push(day);
    byEmployee.set(day.employeeId, list);
  }
  const approvedByEmployee = new Map<string, Map<string, number>>();
  for (const row of approvedRows) {
    const map = approvedByEmployee.get(row.employeeId) ?? new Map<string, number>();
    map.set(row.date, (map.get(row.date) ?? 0) + row.overtimeMin);
    approvedByEmployee.set(row.employeeId, map);
  }

  const summaries: SoftSummary[] = [];
  const weeks: WeekRow[] = [];
  const overtime: OvertimeRow[] = [];
  for (const employee of employees) {
    const ownDays = byEmployee.get(employee.id) ?? [];
    const approved = approvedByEmployee.get(employee.id) ?? new Map();
    summaries.push(summarizeEmployee(employee, from, to, ownDays, approved));
    weeks.push(...weekRows(employee, ownDays));
    overtime.push(...overtimeRows(employee, ownDays, approved));
  }
  summaries.sort((left, right) => left.name.localeCompare(right.name, "id"));
  return { summaries, weeks, overtime };
}
