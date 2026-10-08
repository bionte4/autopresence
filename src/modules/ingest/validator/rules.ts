import { RECOMPUTE_TOLERANCE_MIN } from "@/lib/constants";
import { inclusiveDays } from "@/modules/ingest/parser/time";
import type { ParsedDay, ParsedEmployee, ParsedReport } from "@/modules/ingest/parser/types";
import type { AttendanceIssue } from "./issues";
import { isLate } from "./late";

const ROUND_FIELDS = [
  ["earlyArrivalMin", "Datang cepat"],
  ["lateMin", "Datang telat"],
  ["earlyLeaveMin", "Pulang cepat"],
  ["lateLeaveMin", "Pulang telat"],
  ["actualLateMin", "Terlambat aktual"],
] as const;

const MEASURED_FIELDS = [
  ["effectiveMin", "Jam efektif"],
  ["actualMin", "Jam aktual"],
] as const;

type MinuteField = (typeof ROUND_FIELDS)[number][0] | (typeof MEASURED_FIELDS)[number][0];

export type Granularity = "DAILY" | "WEEKLY" | "MONTHLY";

export type FileMetadata = {
  creator: string | null;
  lastModifiedBy: string | null;
  application: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
};

export type PunchSnapshot = {
  pin: string;
  date: string;
  clockIn: number | null;
  clockOut: number | null;
  note: string | null;
};

const METADATA_LAG_MS = 24 * 60 * 60 * 1000;

function diffExceeds(reported: number | null, expected: number, tolerance: number): boolean {
  return Math.abs((reported ?? 0) - expected) > tolerance;
}

function arrival(schedule: number | null, clock: number | null): { early: number; late: number } | null {
  if (schedule === null || clock === null) return null;
  const delta = clock - schedule;
  return delta < 0 ? { early: -delta, late: 0 } : { early: 0, late: delta };
}

/**
 * Derived daily columns must match the clocks. The report drops seconds, so one minute is not a mismatch.
 * A blank derived cell is treated as zero; a real gap (for example 08:26 with Telat "-") is still a mismatch.
 */
export function rowMismatches(day: ParsedDay, pin: string): AttendanceIssue[] {
  if (!day.isWorkday) return [];
  const fields: Array<{ field: string; expectedMin: number; reportedMin: number | null }> = [];
  const come = arrival(day.scheduleIn, day.clockIn);
  if (come && diffExceeds(day.earlyArrivalMin, come.early, RECOMPUTE_TOLERANCE_MIN)) {
    fields.push({ field: "earlyArrivalMin", expectedMin: come.early, reportedMin: day.earlyArrivalMin });
  }
  if (come && diffExceeds(day.lateMin, come.late, RECOMPUTE_TOLERANCE_MIN)) {
    fields.push({ field: "lateMin", expectedMin: come.late, reportedMin: day.lateMin });
  }
  const leave = arrival(day.scheduleOut, day.clockOut);
  if (leave && diffExceeds(day.earlyLeaveMin, leave.early, RECOMPUTE_TOLERANCE_MIN)) {
    fields.push({ field: "earlyLeaveMin", expectedMin: leave.early, reportedMin: day.earlyLeaveMin });
  }
  if (leave && diffExceeds(day.lateLeaveMin, leave.late, RECOMPUTE_TOLERANCE_MIN)) {
    fields.push({ field: "lateLeaveMin", expectedMin: leave.late, reportedMin: day.lateLeaveMin });
  }
  if (fields.length === 0) return [];
  return [
    {
      type: "ROW_MISMATCH",
      severity: "HIGH",
      message: "Nilai turunan pada baris harian tidak cocok dengan hitung ulang jam.",
      pin,
      date: day.date,
      details: { fields },
    },
  ];
}

function fieldSum(days: ParsedDay[], field: MinuteField): { total: number; valued: number } {
  let total = 0;
  let valued = 0;
  for (const day of days) {
    const value = day[field];
    if (value === null) continue;
    total += value;
    valued += 1;
  }
  return { total, valued };
}

/**
 * The Total row is evidence, not the source of truth. Rounded columns may drift by one minute per valued
 * daily cell plus one extra minute; effective and actual hours only allow one minute overall.
 */
export function totalMismatches(employee: ParsedEmployee): AttendanceIssue[] {
  const issues: AttendanceIssue[] = [];
  const check = (field: MinuteField, label: string, tolerance: number) => {
    const reported = employee.reportedTotals[field];
    const { total, valued } = fieldSum(employee.days, field);
    const allowed = field === "effectiveMin" || field === "actualMin" ? tolerance : valued + tolerance;
    if (!diffExceeds(reported, total, allowed)) return;
    issues.push({
      type: "TOTAL_MISMATCH",
      severity: "HIGH",
      message: `Total ${label} tidak sama dengan jumlah baris harian.`,
      pin: employee.pin,
      details: { field, reportedMin: reported, summedMin: total },
    });
  };
  for (const [field, label] of ROUND_FIELDS) check(field, label, 1);
  for (const [field, label] of MEASURED_FIELDS) check(field, label, 1);
  return issues;
}

/** Total N Hari must equal the number of rows that still have a work schedule. */
export function daysMismatch(employee: ParsedEmployee): AttendanceIssue | null {
  const actual = employee.days.filter((day) => day.isWorkday).length;
  if (actual === employee.reportedTotals.dayCount) return null;
  return {
    type: "DAYS_MISMATCH",
    severity: "MEDIUM",
    message: "Jumlah hari pada baris total tidak sama dengan hari kerja.",
    pin: employee.pin,
    details: { reported: employee.reportedTotals.dayCount, actual },
  };
}

/** Missing clock-in or clock-out is informational. The note is matched without caring about letter case. */
export function missingPunch(day: ParsedDay, pin: string): AttendanceIssue | null {
  const note = day.note?.toLowerCase();
  if (note !== "kurang presensi masuk" && note !== "kurang presensi keluar") return null;
  return {
    type: "MISSING_PUNCH",
    severity: "LOW",
    message: note === "kurang presensi masuk" ? "Kurang presensi masuk." : "Kurang presensi keluar.",
    pin,
    date: day.date,
  };
}

/** A workday explicitly marked without a reason needs a reviewer, even when the clocks are filled. */
export function noReason(day: ParsedDay, pin: string): AttendanceIssue | null {
  if (!day.isWorkday || day.note?.toLowerCase() !== "tanpa keterangan") return null;
  return {
    type: "NO_REASON",
    severity: "MEDIUM",
    message: "Hari kerja tanpa keterangan.",
    pin,
    date: day.date,
  };
}

/** Repeated lateness is counted from the official Telat column so a blank Telat is not counted. */
export function repeatedLate(employee: ParsedEmployee, toleranceMin: number, threshold: number): AttendanceIssue | null {
  const dates = employee.days.filter((day) => isLate(day, { lateToleranceMin: toleranceMin })).map((day) => day.date);
  if (dates.length < threshold) return null;
  return {
    type: "REPEATED_LATE",
    severity: "MEDIUM",
    message: `Terlambat ${dates.length} kali dalam periode ini.`,
    pin: employee.pin,
    details: { dates, threshold },
  };
}

/** A PIN that is not in the employee master cannot be posted to a person yet. */
export function unknownEmployee(pin: string, knownPins: ReadonlySet<string>): AttendanceIssue | null {
  if (knownPins.has(pin)) return null;
  return {
    type: "UNKNOWN_EMPLOYEE",
    severity: "MEDIUM",
    message: "PIN belum terdaftar pada data pegawai.",
    pin,
  };
}

/**
 * Chosen granularity is a range check, not an exact bucket: daily is one day, weekly is at most seven,
 * monthly is at most 35. A short period therefore also satisfies a wider choice.
 */
export function granularityMismatch(period: { start: string; end: string }, granularity: Granularity): AttendanceIssue | null {
  const days = inclusiveDays(period.start, period.end);
  const fits = granularity === "DAILY" ? days === 1 : granularity === "WEEKLY" ? days <= 7 : days <= 35;
  if (fits) return null;
  return {
    type: "GRANULARITY_MISMATCH",
    severity: "LOW",
    message: "Rentang periode pada berkas tidak sesuai jenis upload yang dipilih.",
    details: { granularity, days },
  };
}

/** The same file bytes must not be ingested twice. The previous upload stays the source of the hash. */
export function duplicateFile(hash: string, seenHashes: readonly string[]): AttendanceIssue | null {
  if (!seenHashes.includes(hash)) return null;
  return {
    type: "DUPLICATE_FILE",
    severity: "LOW",
    message: "Berkas yang sama sudah pernah diunggah.",
    details: { hash },
  };
}

/**
 * A complete day that changes between uploads is kept as a conflict. A row that only gains a clock-out
 * is a completion, so this rule stays silent.
 */
export function dataChanged(before: PunchSnapshot, after: PunchSnapshot): AttendanceIssue | null {
  if (before.pin !== after.pin || before.date !== after.date) return null;
  if (before.clockOut === null || after.clockOut === null) return null;
  const same = before.clockIn === after.clockIn && before.clockOut === after.clockOut && before.note === after.note;
  if (same) return null;
  return {
    type: "DATA_CHANGED",
    severity: "CRITICAL",
    message: "Data kehadiran yang sudah lengkap berubah.",
    pin: before.pin,
    date: before.date,
    details: { before, after },
  };
}

/** One missed expected upload per schedule period. Receiving the file clears the finding. */
export function missingUpload(expected: boolean, received: boolean): AttendanceIssue | null {
  if (!expected || received) return null;
  return {
    type: "MISSING_UPLOAD",
    severity: "HIGH",
    message: "Upload yang dijadwalkan belum diterima.",
  };
}

/**
 * Re-saving the export in another program, or by another person, is a sign the file left the source system.
 * A modification more than a day after creation is treated as far enough to review.
 */
export function fileMetadataSuspicious(metadata: FileMetadata): AttendanceIssue | null {
  const creator = metadata.creator?.trim() ?? "";
  const modifier = metadata.lastModifiedBy?.trim() ?? "";
  const application = metadata.application?.trim() ?? "";
  const authorChanged = creator !== "" && modifier !== "" && creator !== modifier;
  const foreignApp = application !== "" && !/smartpresence/i.test(application);
  const created = metadata.createdAt ? Date.parse(metadata.createdAt) : Number.NaN;
  const modified = metadata.modifiedAt ? Date.parse(metadata.modifiedAt) : Number.NaN;
  const lagged = Number.isFinite(created) && Number.isFinite(modified) && modified - created > METADATA_LAG_MS;
  if (!authorChanged && !foreignApp && !lagged) return null;
  return {
    type: "FILE_METADATA_SUSPICIOUS",
    severity: "MEDIUM",
    message: "Metadata berkas tidak sesuai pola export asli.",
    details: { authorChanged, foreignApp, lagged },
  };
}

export function validateReport(
  report: ParsedReport,
  options: { lateToleranceMin?: number; repeatedLateThreshold?: number; knownPins?: ReadonlySet<string>; granularity?: Granularity },
): AttendanceIssue[] {
  const tolerance = options.lateToleranceMin ?? 0;
  const threshold = options.repeatedLateThreshold ?? 3;
  const issues: AttendanceIssue[] = [];
  if (options.granularity) {
    const mismatch = granularityMismatch(report.period, options.granularity);
    if (mismatch) issues.push(mismatch);
  }
  for (const employee of report.employees) {
    if (options.knownPins) {
      const unknown = unknownEmployee(employee.pin, options.knownPins);
      if (unknown) issues.push(unknown);
    }
    const late = repeatedLate(employee, tolerance, threshold);
    if (late) issues.push(late);
    const days = daysMismatch(employee);
    if (days) issues.push(days);
    issues.push(...totalMismatches(employee));
    for (const day of employee.days) {
      issues.push(...rowMismatches(day, employee.pin));
      const punch = missingPunch(day, employee.pin);
      if (punch) issues.push(punch);
      const reason = noReason(day, employee.pin);
      if (reason) issues.push(reason);
      if (day.note && !["libur", "terlambat", "kurang presensi masuk", "kurang presensi keluar", "tanpa keterangan"].includes(day.note.toLowerCase())) {
        issues.push({
          type: "UNKNOWN_NOTE",
          severity: "LOW",
          message: `Keterangan "${day.note}" tidak dikenali.`,
          pin: employee.pin,
          date: day.date,
        });
      }
    }
  }
  return issues;
}
