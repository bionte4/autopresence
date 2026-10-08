import { describe, expect, it } from "vitest";
import { formatMinutes } from "@/lib/format";
import {
  heatmap,
  isoWeek,
  summarizeEmployees,
  summarizeKpis,
  trend,
  type DayRow,
} from "./aggregate";
import { attendanceCsv, csvCell } from "./csv";
import { parseDashboardQuery } from "./schema";

function day(date: string, lateMin: number | null, extra: Partial<DayRow> = {}): DayRow {
  return {
    employeeId: "billy",
    date,
    lateMin,
    actualLateMin: null,
    note: null,
    isWorkday: true,
    clockInMin: 480,
    clockOutMin: 1025,
    lateToleranceMin: 0,
    ...extra,
  };
}

const billy = { id: "billy", name: "BILLY TIGO RAMADHAN", pin: "4520", departmentName: "Operasional" };

describe("dashboard totals", () => {
  it("counts Billy's two late days as 03:43 from daily Telat values", () => {
    const rows = [day("2026-10-02", 133, { actualLateMin: 103 }), day("2026-10-07", 90, { actualLateMin: 85 }), day("2026-10-03", null)];
    const [summary] = summarizeEmployees([billy], rows);
    expect(summary?.lateCount).toBe(2);
    expect(summary?.lateMinutes).toBe(223);
    expect(formatMinutes(summary?.lateMinutes ?? 0)).toBe("03:43");
    expect(summarizeKpis([summary!], 0).lateEvents).toBe(2);
  });

  it("ignores lateness inside the schedule tolerance and keeps missing punch to one day", () => {
    const rows = [
      day("2026-10-01", 5, { lateToleranceMin: 10 }),
      day("2026-10-02", null, { clockOutMin: null, note: "Kurang Presensi Keluar" }),
      day("2026-10-03", null, { note: "Tanpa Keterangan" }),
    ];
    const [summary] = summarizeEmployees([billy], rows);
    expect(summary).toMatchObject({ lateCount: 0, missingPunch: 1, noReason: 1 });
  });

  it("buckets the two October late days into one month and two weeks", () => {
    const rows = [day("2026-10-02", 133), day("2026-10-07", 90)];
    expect(isoWeek("2026-10-02")).not.toBe(isoWeek("2026-10-07"));
    expect(trend(rows, "month")).toEqual([{ bucket: "2026-10", lateEvents: 2 }]);
    expect(trend(rows, "week")).toHaveLength(2);
    const cells = heatmap("2026-10-02", "2026-10-07", rows);
    expect(cells).toHaveLength(6);
    expect(cells.find((cell) => cell.date === "2026-10-02")?.lateMinutes).toBe(133);
    expect(cells.find((cell) => cell.date === "2026-10-03")?.lateMinutes).toBe(0);
  });

  it("neutralizes spreadsheet formulas in CSV cells", () => {
    expect(csvCell("=IMPOR")).toBe("'=IMPOR");
    const csv = attendanceCsv([
      {
        ...billy,
        employeeId: billy.id,
        name: "=IMPOR",
        lateCount: 2,
        lateMinutes: 223,
        actualLateMinutes: 188,
        missingPunch: 1,
        noReason: 0,
      },
    ]);
    expect(csv).toContain("'=IMPOR");
    expect(csv).toContain("03:43");
  });

  it("rejects a period that ends before it starts", () => {
    expect(() => parseDashboardQuery({ from: "2026-10-07", to: "2026-10-02" })).toThrow();
  });
});
