const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function periodLength(from: string, to: string): number | null {
  if (!ISO.test(from) || !ISO.test(to) || to < from) return null;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Overtime is the minutes after the schedule ends. A finish at or before that time is not overtime. */
export function overtimeMinutes(scheduleEndMin: number, endMin: number): number | null {
  if (endMin <= scheduleEndMin || endMin > 24 * 60) return null;
  return endMin - scheduleEndMin;
}

export function requestNote(kind: "LEAVE" | "SICK"): string {
  return kind === "LEAVE" ? "Cuti" : "Sakit";
}
