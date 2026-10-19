import { describe, expect, it } from "vitest";
import {
  WEEKLY_LIMIT_MIN,
  buildSoftLaborReport,
  maxWorkStreak,
  observedOvertimeMinutes,
  weekRows,
  workedMinutes,
  type SoftDay,
  type SoftEmployee,
} from "./aggregate";

const employee: SoftEmployee = { id: "e1", name: "Uji", pin: "1", departmentName: "Ops" };

function day(partial: Partial<SoftDay> & Pick<SoftDay, "date">): SoftDay {
  return {
    employeeId: "e1",
    isWorkday: true,
    scheduleOutMin: 1025,
    clockInMin: 480,
    clockOutMin: 1025,
    actualMin: 545,
    lateLeaveMin: null,
    note: null,
    ...partial,
  };
}

describe("soft labor aggregate", () => {
  it("prefers actualMin then clock span for worked minutes", () => {
    expect(workedMinutes(day({ date: "2026-10-01", actualMin: 600 }))).toBe(600);
    expect(workedMinutes(day({ date: "2026-10-01", actualMin: null, clockInMin: 480, clockOutMin: 1080 }))).toBe(600);
    expect(workedMinutes(day({ date: "2026-10-01", actualMin: null, clockOutMin: null }))).toBeNull();
  });

  it("flags a week above the 40-hour reference", () => {
    const days = Array.from({ length: 5 }, (_, index) =>
      day({
        date: `2026-10-${String(5 + index).padStart(2, "0")}`,
        actualMin: 9 * 60,
      }),
    );
    const rows = weekRows(employee, days);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.workedMin).toBe(45 * 60);
    expect(rows[0]?.workedMin).toBeGreaterThan(WEEKLY_LIMIT_MIN);
    expect(rows[0]?.overLimit).toBe(true);
  });

  it("measures consecutive worked calendar days and soft rest flags", () => {
    const days = [
      day({ date: "2026-10-01" }),
      day({ date: "2026-10-02" }),
      day({ date: "2026-10-03" }),
      day({ date: "2026-10-04" }),
      day({ date: "2026-10-05" }),
      day({ date: "2026-10-06" }),
      day({ date: "2026-10-07" }),
    ];
    expect(maxWorkStreak("2026-10-01", "2026-10-07", days)).toBe(7);
    const report = buildSoftLaborReport([employee], "2026-10-01", "2026-10-07", days, []);
    expect(report.summaries[0]?.restFlag).toBe(true);
  });

  it("compares observed overtime with approved requests", () => {
    expect(observedOvertimeMinutes(day({ date: "2026-10-01", clockOutMin: 1145, lateLeaveMin: null }))).toBe(120);
    expect(observedOvertimeMinutes(day({ date: "2026-10-01", lateLeaveMin: 90 }))).toBe(90);
    const report = buildSoftLaborReport(
      [employee],
      "2026-10-01",
      "2026-10-02",
      [day({ date: "2026-10-01", clockOutMin: 1145, lateLeaveMin: null }), day({ date: "2026-10-02", clockOutMin: 1145 })],
      [{ employeeId: "e1", date: "2026-10-01", overtimeMin: 60 }],
    );
    expect(report.overtime[0]?.approvedMin).toBe(60);
    expect(report.overtime[0]?.gapMin).toBe(60);
    expect(report.overtime[1]?.gapMin).toBe(120);
    expect(report.summaries[0]?.overtimeWithoutApprovalDays).toBe(2);
  });
});
