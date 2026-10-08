import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sheetsFromWorkbook } from "@/modules/ingest/workbook";
import { parseReport, parseSheet } from "./parse";
import { calendarDate, inclusiveDays, parseClock, parseDisplayDate, parsePeriod } from "./time";
import type { SheetGrid } from "./types";

const fixture = sheetsFromWorkbook(readFileSync("fixtures/Laporan_Per_Atribut.xlsx"));

const header = [
  "Tanggal",
  "Jam Kerja",
  "",
  "Jam Masuk",
  "Jam Keluar",
  "Jam Datang",
  "",
  "Jumlah Jam Pulang",
  "",
  "Terlambat Aktual",
  "Jumlah Jam Efektif",
  "Jumlah Jam Aktual",
  "Lokasi Masuk",
  "Lokasi Keluar",
  "Keterangan",
];
const subheader = ["", "Masuk", "Pulang", "", "", "Cepat", "Telat", "Cepat", "Telat"];

function block(period: string, name: string, pin: string, day: string[], total: string[]): SheetGrid {
  return [["Laporan Kehadiran Pegawai"], ["Periode", period], ["Nama", name], ["Pin", pin], [], header, subheader, day, total];
}

describe("calendar helpers", () => {
  it("rejects impossible dates and accepts a leap day", () => {
    expect(calendarDate(2026, 2, 31)).toBeNull();
    expect(calendarDate(2024, 2, 29)).toBe("2024-02-29");
    expect(parseClock("08:00 ")).toBe(480);
    expect(parseClock("-")).toBeNull();
    expect(parseClock("jam")).toBe("invalid");
    expect(parseDisplayDate("Km, 10 Sep 2026 ")).toBe("2026-09-10");
    expect(parseDisplayDate("bukan tanggal")).toBe("invalid");
    expect(parsePeriod(": 20 Des - 10 Jan 2027")).toEqual({ start: "2026-12-20", end: "2027-01-10" });
    expect(parsePeriod("7 Okt 2026")).toEqual({ start: "2026-10-07", end: "2026-10-07" });
    expect(parsePeriod(": 7 Okt 2026")).toEqual({ start: "2026-10-07", end: "2026-10-07" });
    expect(parsePeriod("1 Okt 2026 - 7 Okt 2026")).toEqual({ start: "2026-10-01", end: "2026-10-07" });
    expect(parsePeriod("10 Sep - 9 Okt 2026")).toEqual({ start: "2026-09-10", end: "2026-10-09" });
    expect(parsePeriod("tanpa tanggal")).toBeNull();
    expect(inclusiveDays("2026-09-10", "2026-10-09")).toBe(30);
  });
});

describe("sample report", () => {
  it("reads the first sheet that contains employee blocks", () => {
    const parsed = parseReport([fixture[1].cells, fixture[0].cells]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.report.employees).toHaveLength(13);
    expect(parsed.report.period).toEqual({ start: "2026-09-10", end: "2026-10-09" });
    const billy = parsed.report.employees.find((employee) => employee.name === "BILLY TIGO RAMADHAN");
    expect(billy?.pin).toBe("4520");
    const late = billy?.days.filter((day) => (day.lateMin ?? 0) > 0) ?? [];
    expect(late.map((day) => [day.date, day.lateMin, day.actualLateMin])).toEqual([
      ["2026-10-02", 133, 103],
      ["2026-10-07", 90, 85],
    ]);
    const notes = parsed.report.employees.flatMap((employee) => employee.days.map((day) => day.note).filter(Boolean));
    expect(notes.filter((note) => note === "Libur")).toHaveLength(104);
    expect(notes.filter((note) => note === "Kurang Presensi Keluar")).toHaveLength(32);
    expect(notes.filter((note) => note === "Tanpa Keterangan")).toHaveLength(8);
    expect(notes.filter((note) => note?.toLowerCase() === "kurang presensi masuk")).toHaveLength(5);
    expect(notes.filter((note) => note === "Terlambat")).toHaveLength(2);
    for (const employee of parsed.report.employees) {
      for (const day of employee.days.filter((item) => item.isWorkday)) {
        expect(day.scheduleIn).toBe(480);
        expect(day.scheduleOut).toBe(1025);
      }
    }
  });

  it("rejects a sheet that looks like a report but has an unknown header", () => {
    const grid = block(": 10 Sep - 9 Okt 2026", ": UJI", ": 1", ["10 Sep 2026", "08:00"], ["Total 1 Hari"]);
    grid[5] = ["Tanggal", "Kolom lain"];
    expect(parseSheet(grid).ok).toBe(false);
  });

  it("does not fall through to a later sheet after a broken report", () => {
    const broken = block(": 10 Sep - 9 Okt 2026", ": UJI", ": 1", ["bukan tanggal", "08:00"], ["Total 1 Hari"]);
    const result = parseReport([broken, fixture[0].cells]);
    expect(result.ok).toBe(false);
  });

  it("rejects a workbook with no employee blocks", () => {
    expect(parseReport([[["kosong"]]]).ok).toBe(false);
  });

  it("rejects a block that never reaches its total row", () => {
    const grid = block(": 10 Sep - 9 Okt 2026", ": UJI", ": 1", ["10 Sep 2026", "08:00", "17:05"], ["Total 1 Hari"]);
    grid.pop();
    expect(parseSheet(grid).ok).toBe(false);
  });

  it("rejects employees that declare different periods", () => {
    const first = block(
      ": 10 Sep - 9 Okt 2026",
      ": SATU",
      ": 1",
      ["Km, 10 Sep 2026", "08:00", "17:05", "08:00", "17:05", "-", "-", "-", "-", "-", "09:05", "09:05"],
      ["Total 1 Hari", "", "", "", "", "-", "-", "-", "-", "-", "09:05", "09:05"],
    );
    const second = block(
      ": 1 Okt - 2 Okt 2026",
      ": DUA",
      ": 2",
      ["Km, 1 Okt 2026", "08:00", "17:05", "08:00", "17:05", "-", "-", "-", "-", "-", "09:05", "09:05"],
      ["Total 1 Hari", "", "", "", "", "-", "-", "-", "-", "-", "09:05", "09:05"],
    );
    expect(parseSheet([...first, [], ...second]).ok).toBe(false);
  });

  it("accepts a daily report whose period is a single date", () => {
    const parsed = parseSheet(
      block(
        ": 7 Okt 2026",
        ": ANDREA RAHMADANISYA",
        ": 4370",
        ["Rb, 7 Okt 2026 ", "08:00 ", " 17:05", "06:25", "17:11", "01:34", "-", "-", "00:06", "-", "09:05", "09:05"],
        ["Total 1 Hari", "", "", "", "", "01:34", "-", "-", "00:06", "-", "09:05", "09:05"],
      ),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.report.period).toEqual({ start: "2026-10-07", end: "2026-10-07" });
    expect(parsed.report.employees[0]?.pin).toBe("4370");
    expect(parsed.report.employees[0]?.days).toHaveLength(1);
  });

  it("keeps an unrecognized note and a year-crossing period", () => {
    const parsed = parseSheet(
      block(
        ": 20 Des - 10 Jan 2027",
        ": UJI",
        ": 9",
        ["Sn, 20 Des 2026 ", "08:00", "17:05", "08:00", "17:05", "-", "-", "-", "-", "-", "09:05", "09:05", "", "", "Catatan Aneh"],
        ["Total 1 Hari", "", "", "", "", "-", "-", "-", "-", "-", "09:05", "09:05"],
      ),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.report.period).toEqual({ start: "2026-12-20", end: "2027-01-10" });
    expect(parsed.report.employees[0]?.days[0]?.note).toBe("Catatan Aneh");
  });
});
