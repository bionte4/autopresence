import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseReport } from "@/modules/ingest/parser/parse";
import type { ParsedDay, ParsedEmployee } from "@/modules/ingest/parser/types";
import { sheetsFromWorkbook } from "@/modules/ingest/workbook";
import {
  dataChanged,
  daysMismatch,
  duplicateFile,
  fileMetadataSuspicious,
  granularityMismatch,
  missingPunch,
  missingUpload,
  noReason,
  repeatedLate,
  rowMismatches,
  totalMismatches,
  unknownEmployee,
  validateReport,
} from "./rules";
import { ANOMALY_TYPES } from "./issues";
import { isLate } from "./late";

const fixture = sheetsFromWorkbook(readFileSync("fixtures/Laporan_Per_Atribut.xlsx"));
const parsed = parseReport(fixture.map((sheet) => sheet.cells));
if (!parsed.ok) throw new Error("fixture gagal diurai");
const report = parsed.report;

function day(partial: Partial<ParsedDay> = {}): ParsedDay {
  return {
    date: "2026-10-02",
    isWorkday: true,
    scheduleIn: 480,
    scheduleOut: 1025,
    clockIn: 480,
    clockOut: 1025,
    earlyArrivalMin: null,
    lateMin: null,
    earlyLeaveMin: null,
    lateLeaveMin: null,
    actualLateMin: null,
    effectiveMin: 545,
    actualMin: 545,
    locIn: null,
    locOut: null,
    note: null,
    ...partial,
  };
}

function employee(partial: Partial<ParsedEmployee> = {}): ParsedEmployee {
  const { days: givenDays, reportedTotals, ...rest } = partial;
  const days = givenDays ?? [day()];
  return {
    name: "Uji",
    pin: "1",
    ...rest,
    days,
    reportedTotals: {
      dayCount: days.filter((item) => item.isWorkday).length,
      earlyArrivalMin: null,
      lateMin: null,
      earlyLeaveMin: null,
      lateLeaveMin: null,
      actualLateMin: null,
      effectiveMin: 545 * days.filter((item) => item.isWorkday).length,
      actualMin: 545,
      ...reportedTotals,
    },
  };
}

describe("golden validation", () => {
  const issues = validateReport(report, { knownPins: new Set(["4520"]), granularity: "MONTHLY" });

  it("flags Billy's blank Terlambat Aktual total and keeps his two late days", () => {
    const billy = report.employees.find((item) => item.name === "BILLY TIGO RAMADHAN");
    expect(billy).toBeDefined();
    const totals = issues.filter((issue) => issue.type === "TOTAL_MISMATCH" && issue.pin === "4520");
    expect(totals.some((issue) => issue.details?.field === "actualLateMin" && issue.details.summedMin === 188)).toBe(true);
    expect(totals.some((issue) => issue.details?.field === "lateMin")).toBe(false);
    expect(billy?.days.filter((item) => isLate(item, { lateToleranceMin: 0 })).map((item) => item.date)).toEqual([
      "2026-10-02",
      "2026-10-07",
    ]);
  });

  it("flags a derived column that was edited away from the clocks", () => {
    const cells = fixture[0].cells.map((row) => [...row]);
    const target = cells.find((row) => String(row[0]).includes("2 Okt 2026") && String(row[6]).trim() === "02:13");
    expect(target).toBeDefined();
    if (!target) return;
    target[6] = "00:05";
    const edited = parseReport([cells]);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const mismatches = validateReport(edited.report, {}).filter(
      (issue) => issue.type === "ROW_MISMATCH" && issue.date === "2026-10-02" && issue.pin === "4520",
    );
    expect(mismatches.length).toBeGreaterThan(0);
  });
});

describe("anomaly rules", () => {
  it("lists every configured anomaly code", () => {
    expect(ANOMALY_TYPES).toContain("TOTAL_MISMATCH");
    expect(ANOMALY_TYPES).toContain("UNKNOWN_NOTE");
  });

  it("compares derived minutes with a one-minute tolerance", () => {
    expect(rowMismatches(day({ isWorkday: false, scheduleIn: null, scheduleOut: null }), "1")).toEqual([]);
    expect(rowMismatches(day({ clockIn: 392, earlyArrivalMin: 87 }), "1")).toEqual([]);
    expect(rowMismatches(day({ clockIn: 392, earlyArrivalMin: 10 }), "1")[0]?.details).toMatchObject({
      fields: [expect.objectContaining({ field: "earlyArrivalMin" })],
    });
    const mismatch = rowMismatches(day({ clockIn: 506, lateMin: null }), "1");
    expect(mismatch[0]?.type).toBe("ROW_MISMATCH");
    expect(rowMismatches(day({ clockOut: 900, earlyLeaveMin: 200 }), "1")[0]?.type).toBe("ROW_MISMATCH");
  });

  it("detects a total or day-count that disagrees with the daily rows", () => {
    expect(totalMismatches(employee())).toEqual([]);
    const wrong = totalMismatches(employee({ reportedTotals: { dayCount: 1, earlyArrivalMin: null, lateMin: null, earlyLeaveMin: null, lateLeaveMin: null, actualLateMin: null, effectiveMin: 0, actualMin: 545 } }));
    expect(wrong.some((issue) => issue.details?.field === "effectiveMin")).toBe(true);
    expect(daysMismatch(employee())).toBeNull();
    expect(daysMismatch(employee({ reportedTotals: { dayCount: 9, earlyArrivalMin: null, lateMin: null, earlyLeaveMin: null, lateLeaveMin: null, actualLateMin: null, effectiveMin: 545, actualMin: 545 } }))?.type).toBe(
      "DAYS_MISMATCH",
    );
  });

  it("covers punch, reason, repeated lateness, and unknown employees", () => {
    expect(missingPunch(day(), "1")).toBeNull();
    expect(missingPunch(day({ note: "Kurang presensi Masuk" }), "1")?.type).toBe("MISSING_PUNCH");
    expect(missingPunch(day({ note: "Kurang Presensi Keluar" }), "1")?.message).toBe("Kurang presensi keluar.");
    expect(noReason(day(), "1")).toBeNull();
    expect(noReason(day({ note: "Tanpa Keterangan" }), "1")?.type).toBe("NO_REASON");
    expect(noReason(day({ isWorkday: false, note: "Tanpa Keterangan" }), "1")).toBeNull();
    const twice = employee({ days: [day({ lateMin: 10 }), day({ date: "2026-10-07", lateMin: 5 })] });
    expect(repeatedLate(twice, 0, 3)).toBeNull();
    expect(repeatedLate(twice, 0, 2)?.type).toBe("REPEATED_LATE");
    expect(isLate({ lateMin: 5 }, { lateToleranceMin: 5 })).toBe(false);
    expect(unknownEmployee("1", new Set(["1"]))).toBeNull();
    expect(unknownEmployee("2", new Set(["1"]))?.type).toBe("UNKNOWN_EMPLOYEE");
  });

  it("covers upload-level rules without reading the database", () => {
    expect(granularityMismatch({ start: "2026-09-10", end: "2026-10-09" }, "MONTHLY")).toBeNull();
    expect(granularityMismatch({ start: "2026-09-10", end: "2026-10-09" }, "DAILY")?.type).toBe("GRANULARITY_MISMATCH");
    expect(granularityMismatch({ start: "2026-09-10", end: "2026-09-12" }, "WEEKLY")).toBeNull();
    expect(duplicateFile("abc", [])).toBeNull();
    expect(duplicateFile("abc", ["abc"])?.type).toBe("DUPLICATE_FILE");
    const complete = { pin: "1", date: "2026-10-02", clockIn: 480, clockOut: 1025, note: null };
    expect(dataChanged(complete, complete)).toBeNull();
    expect(dataChanged(complete, { ...complete, clockOut: null })).toBeNull();
    expect(dataChanged(complete, { ...complete, pin: "2" })).toBeNull();
    expect(dataChanged(complete, { ...complete, clockIn: 500 })?.type).toBe("DATA_CHANGED");
    expect(missingUpload(true, true)).toBeNull();
    expect(missingUpload(false, false)).toBeNull();
    expect(missingUpload(true, false)?.type).toBe("MISSING_UPLOAD");
    const clean = {
      creator: "SmartPresence",
      lastModifiedBy: "SmartPresence",
      application: "SmartPresence",
      createdAt: "2026-10-08T03:00:00.000Z",
      modifiedAt: "2026-10-08T03:10:00.000Z",
    };
    expect(fileMetadataSuspicious(clean)).toBeNull();
    expect(fileMetadataSuspicious({ ...clean, lastModifiedBy: "Haryanto" })?.type).toBe("FILE_METADATA_SUSPICIOUS");
    expect(fileMetadataSuspicious({ ...clean, application: "Microsoft Excel" })?.type).toBe("FILE_METADATA_SUSPICIOUS");
    expect(fileMetadataSuspicious({ ...clean, modifiedAt: "2026-10-10T03:00:00.000Z" })?.details).toMatchObject({ lagged: true });
  });

  it("raises an unknown note and stays quiet when the note is recognized", () => {
    const odd = validateReport({ period: report.period, employees: [employee({ days: [day({ note: "Dinas luar" })] })] }, {});
    expect(odd.some((issue) => issue.type === "UNKNOWN_NOTE")).toBe(true);
    const known = validateReport({ period: report.period, employees: [employee({ days: [day({ note: "Libur", isWorkday: false, scheduleIn: null, scheduleOut: null })] })] }, {});
    expect(known.some((issue) => issue.type === "UNKNOWN_NOTE")).toBe(false);
  });
});
