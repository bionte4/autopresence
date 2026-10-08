import { describe, expect, it } from "vitest";
import { applyCorrectionPatch, derivePunchMinutes } from "./derive";

const current = {
  scheduleInMin: 480,
  scheduleOutMin: 1025,
  clockInMin: 613,
  clockOutMin: 1025,
  note: null,
  earlyArrivalMin: 0,
  lateMin: 133,
  earlyLeaveMin: 0,
  lateLeaveMin: 0,
  actualMin: 412,
  effectiveMin: 545,
};

describe("correction punch math", () => {
  it("turns a late clock-in back into an on-time day", () => {
    expect(derivePunchMinutes({ scheduleInMin: 480, scheduleOutMin: 1025, clockInMin: 480, clockOutMin: 1025 })).toMatchObject({
      lateMin: 0,
      earlyArrivalMin: 0,
      effectiveMin: 545,
      actualMin: 545,
    });
  });

  it("leaves derived minutes alone when only the note changes", () => {
    const next = applyCorrectionPatch(current, { note: "Izin" });
    expect(next.lateMin).toBe(133);
    expect(next.note).toBe("Izin");
    expect(next.clockInMin).toBe(613);
  });

  it("recomputes lateness when the clock-in is corrected", () => {
    const next = applyCorrectionPatch(current, { clockInMin: 470 });
    expect(next.lateMin).toBe(0);
    expect(next.earlyArrivalMin).toBe(10);
    expect(next.clockOutMin).toBe(1025);
  });
});
