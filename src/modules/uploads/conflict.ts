export type PunchFields = {
  isWorkday: boolean;
  scheduleInMin: number | null;
  scheduleOutMin: number | null;
  clockInMin: number | null;
  clockOutMin: number | null;
  earlyArrivalMin: number | null;
  lateMin: number | null;
  earlyLeaveMin: number | null;
  lateLeaveMin: number | null;
  actualLateMin: number | null;
  effectiveMin: number | null;
  actualMin: number | null;
  locIn: string | null;
  locOut: string | null;
  note: string | null;
};

export type ConflictAction = "insert" | "unchanged" | "complete" | "conflict" | "held";

const FIELDS = [
  "isWorkday",
  "scheduleInMin",
  "scheduleOutMin",
  "clockInMin",
  "clockOutMin",
  "earlyArrivalMin",
  "lateMin",
  "earlyLeaveMin",
  "lateLeaveMin",
  "actualLateMin",
  "effectiveMin",
  "actualMin",
  "locIn",
  "locOut",
  "note",
] as const;

export function samePunch(left: PunchFields, right: PunchFields): boolean {
  return FIELDS.every((field) => left[field] === right[field]);
}

/**
 * A finished day is never replaced. An open day is updated only when the new row supplies the missing clock-out.
 * Any other difference is held so the stored row stays as it was.
 */
export function decideConflict(existing: PunchFields | null, incoming: PunchFields): ConflictAction {
  if (!existing) return "insert";
  if (samePunch(existing, incoming)) return "unchanged";
  if (existing.clockOutMin === null && incoming.clockOutMin !== null) return "complete";
  if (existing.clockOutMin !== null) return "conflict";
  return "held";
}
