export type GranularityName = "DAILY" | "WEEKLY" | "MONTHLY";

export type ScheduleClock = {
  id: string;
  granularity: GranularityName;
  cutoffTime: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
};

export type PeriodSlot = {
  from: string;
  to: string;
  due: boolean;
};

/** Jakarta has no daylight-saving shift. The calendar date is taken in that zone. */
export function jakartaParts(now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    minutes: Number(pick("hour")) * 60 + Number(pick("minute")),
  };
}

export function parseCutoff(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function addMonths(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + delta, 1));
  const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
}

export function isoWeekday(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function onWeekday(iso: string, weekday: number): string {
  return shiftDate(iso, weekday - isoWeekday(iso));
}

function withDay(iso: string, dayOfMonth: number): string {
  const [year, month] = iso.split("-");
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return `${year}-${month}-${String(Math.min(dayOfMonth, last)).padStart(2, "0")}`;
}

function weeklyWindow(due: string): PeriodSlot {
  return { from: shiftDate(due, -6), to: due, due: true };
}

function monthlyWindow(due: string): PeriodSlot {
  return { from: addMonths(due, -1), to: shiftDate(due, -1), due: true };
}

/**
 * Only the latest period whose cutoff has passed is eligible for MISSING_UPLOAD.
 * When today's cutoff is still ahead, that period is shown as not yet due.
 * A monthly due date on the 10th expects the previous cycle, such as 10 Sep–9 Oct.
 */
export function scheduleSlots(schedule: ScheduleClock, now: Date): { due: PeriodSlot | null; upcoming: PeriodSlot | null } {
  const clock = jakartaParts(now);
  const passed = clock.minutes >= parseCutoff(schedule.cutoffTime);

  if (schedule.granularity === "DAILY") {
    const today: PeriodSlot = { from: clock.date, to: clock.date, due: passed };
    if (passed) return { due: today, upcoming: null };
    return { due: { from: shiftDate(clock.date, -1), to: shiftDate(clock.date, -1), due: true }, upcoming: today };
  }

  if (schedule.granularity === "WEEKLY" && schedule.dayOfWeek) {
    const thisDue = onWeekday(clock.date, schedule.dayOfWeek);
    const thisPassed = thisDue < clock.date || (thisDue === clock.date && passed);
    const current = { ...weeklyWindow(thisDue), due: thisPassed };
    if (thisPassed) return { due: current, upcoming: null };
    return { due: weeklyWindow(shiftDate(thisDue, -7)), upcoming: current };
  }

  if (schedule.granularity === "MONTHLY" && schedule.dayOfMonth) {
    const thisDue = withDay(clock.date, schedule.dayOfMonth);
    const thisPassed = thisDue < clock.date || (thisDue === clock.date && passed);
    const current = { ...monthlyWindow(thisDue), due: thisPassed };
    if (thisPassed) return { due: current, upcoming: null };
    return { due: monthlyWindow(addMonths(thisDue, -1)), upcoming: current };
  }

  return { due: null, upcoming: null };
}

export function uploadCovers(
  upload: { granularity: GranularityName; periodStart: string; periodEnd: string; status: string },
  granularity: GranularityName,
  slot: PeriodSlot,
): boolean {
  if (upload.status === "REJECTED" || upload.granularity !== granularity) return false;
  return upload.periodStart <= slot.to && upload.periodEnd >= slot.from;
}
