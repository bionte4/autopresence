export type PunchClocks = {
  scheduleInMin: number | null;
  scheduleOutMin: number | null;
  clockInMin: number | null;
  clockOutMin: number | null;
};

export type DerivedPunch = {
  earlyArrivalMin: number | null;
  lateMin: number | null;
  earlyLeaveMin: number | null;
  lateLeaveMin: number | null;
  actualMin: number | null;
  effectiveMin: number | null;
};

function split(schedule: number | null, clock: number | null): { early: number; late: number } | null {
  if (schedule === null || clock === null) return null;
  const delta = clock - schedule;
  return delta < 0 ? { early: -delta, late: 0 } : { early: 0, late: delta };
}

/**
 * The same clock delta the row checker uses. Effective minutes stay the schedule span
 * (08:00–17:05 is 09:05). Actual minutes are the punch span. Terlambat aktual is left
 * untouched: the source file has no separate formula for that column.
 */
export function derivePunchMinutes(input: PunchClocks): DerivedPunch {
  const come = split(input.scheduleInMin, input.clockInMin);
  const leave = split(input.scheduleOutMin, input.clockOutMin);
  const actual =
    input.clockInMin !== null && input.clockOutMin !== null && input.clockOutMin >= input.clockInMin
      ? input.clockOutMin - input.clockInMin
      : null;
  const effective =
    input.scheduleInMin !== null && input.scheduleOutMin !== null && input.scheduleOutMin >= input.scheduleInMin
      ? input.scheduleOutMin - input.scheduleInMin
      : null;
  return {
    earlyArrivalMin: come?.early ?? null,
    lateMin: come?.late ?? null,
    earlyLeaveMin: leave?.early ?? null,
    lateLeaveMin: leave?.late ?? null,
    actualMin: actual,
    effectiveMin: effective,
  };
}

export type CorrectionPatch = {
  clockInMin?: number | null;
  clockOutMin?: number | null;
  note?: string | null;
};

export type RecordClocks = PunchClocks & {
  note: string | null;
  earlyArrivalMin: number | null;
  lateMin: number | null;
  earlyLeaveMin: number | null;
  lateLeaveMin: number | null;
  actualMin: number | null;
  effectiveMin: number | null;
};

export function applyCorrectionPatch(current: RecordClocks, patch: CorrectionPatch): RecordClocks {
  const clockInMin = patch.clockInMin !== undefined ? patch.clockInMin : current.clockInMin;
  const clockOutMin = patch.clockOutMin !== undefined ? patch.clockOutMin : current.clockOutMin;
  const note = patch.note !== undefined ? patch.note : current.note;
  const clocksChanged = patch.clockInMin !== undefined || patch.clockOutMin !== undefined;
  const derived = clocksChanged
    ? derivePunchMinutes({
        scheduleInMin: current.scheduleInMin,
        scheduleOutMin: current.scheduleOutMin,
        clockInMin,
        clockOutMin,
      })
    : null;
  return {
    scheduleInMin: current.scheduleInMin,
    scheduleOutMin: current.scheduleOutMin,
    clockInMin,
    clockOutMin,
    note,
    earlyArrivalMin: derived?.earlyArrivalMin ?? current.earlyArrivalMin,
    lateMin: derived?.lateMin ?? current.lateMin,
    earlyLeaveMin: derived?.earlyLeaveMin ?? current.earlyLeaveMin,
    lateLeaveMin: derived?.lateLeaveMin ?? current.lateLeaveMin,
    actualMin: derived?.actualMin ?? current.actualMin,
    effectiveMin: derived?.effectiveMin ?? current.effectiveMin,
  };
}
