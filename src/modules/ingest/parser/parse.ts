import { parseClock, parseDisplayDate, parsePeriod } from "./time";
import type { CellValue, ParseResult, ParsedDay, ParsedEmployee, ReportedTotals, SheetGrid } from "./types";

function text(row: CellValue[] | undefined, index: number): string {
  const value = row?.[index];
  if (value == null) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function blank(row: CellValue[] | undefined): boolean {
  return !row || row.every((value) => text([value], 0) === "");
}

function formatUnknown(message: string): ParseResult {
  return { ok: false, issues: [{ code: "FORMAT_UNKNOWN", severity: "HIGH", message }] };
}

function labeled(row: CellValue[], label: string): string | null {
  if (text(row, 0).toLowerCase() !== label) return null;
  const match = /^:\s*(.*)$/.exec(text(row, 1));
  return match ? match[1].trim() : null;
}

function isTitle(row: CellValue[]): boolean {
  return text(row, 0).toLowerCase() === "laporan kehadiran pegawai";
}

function isHeader(row: CellValue[]): boolean {
  return (
    text(row, 0).toLowerCase() === "tanggal" &&
    text(row, 1).toLowerCase() === "jam kerja" &&
    text(row, 3).toLowerCase() === "jam masuk" &&
    text(row, 4).toLowerCase() === "jam keluar" &&
    text(row, 5).toLowerCase() === "jam datang" &&
    text(row, 7).toLowerCase() === "jumlah jam pulang" &&
    text(row, 9).toLowerCase() === "terlambat aktual" &&
    text(row, 14).toLowerCase() === "keterangan"
  );
}

function isSubheader(row: CellValue[]): boolean {
  return (
    text(row, 1).toLowerCase() === "masuk" &&
    text(row, 2).toLowerCase() === "pulang" &&
    text(row, 5).toLowerCase() === "cepat" &&
    text(row, 6).toLowerCase() === "telat" &&
    text(row, 7).toLowerCase() === "cepat" &&
    text(row, 8).toLowerCase() === "telat"
  );
}

function minutes(raw: string): number | null | "invalid" {
  return parseClock(raw);
}

function optionalText(raw: string): string | null {
  const value = raw.trim();
  if (value === "" || value === "-" || value.toLowerCase() === "null") return null;
  return value;
}

function readDay(row: CellValue[]): ParsedDay | "skip" | "invalid" {
  const date = parseDisplayDate(text(row, 0));
  if (date === null) return "skip";
  if (date === "invalid") return "invalid";
  const fields = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => minutes(text(row, index)));
  if (fields.some((value) => value === "invalid")) return "invalid";
  const [scheduleIn, scheduleOut, clockIn, clockOut, earlyArrivalMin, lateMin, earlyLeaveMin, lateLeaveMin, actualLateMin, effectiveMin, actualMin] =
    fields as Array<number | null>;
  const note = optionalText(text(row, 14));
  return {
    date,
    isWorkday: scheduleIn !== null || scheduleOut !== null,
    scheduleIn,
    scheduleOut,
    clockIn,
    clockOut,
    earlyArrivalMin,
    lateMin,
    earlyLeaveMin,
    lateLeaveMin,
    actualLateMin,
    effectiveMin,
    actualMin,
    locIn: optionalText(text(row, 12)),
    locOut: optionalText(text(row, 13)),
    note,
  };
}

function readTotals(row: CellValue[]): ReportedTotals | null {
  const match = /^total (\d+) hari$/i.exec(text(row, 0));
  if (!match) return null;
  const values = [5, 6, 7, 8, 9, 10, 11].map((index) => minutes(text(row, index)));
  if (values.some((value) => value === "invalid")) return null;
  const [earlyArrivalMin, lateMin, earlyLeaveMin, lateLeaveMin, actualLateMin, effectiveMin, actualMin] = values as Array<number | null>;
  return {
    dayCount: Number(match[1]),
    earlyArrivalMin,
    lateMin,
    earlyLeaveMin,
    lateLeaveMin,
    actualLateMin,
    effectiveMin,
    actualMin,
  };
}

function nextFilled(grid: SheetGrid, index: number): number {
  let cursor = index;
  while (cursor < grid.length && blank(grid[cursor])) cursor += 1;
  return cursor;
}

function readBlock(
  grid: SheetGrid,
  start: number,
): { employee: ParsedEmployee; period: { start: string; end: string }; next: number } | ParseResult {
  let cursor = nextFilled(grid, start + 1);
  let periodRaw: string | null = null;
  let name: string | null = null;
  let pin: string | null = null;
  while (cursor < grid.length && !isHeader(grid[cursor]) && !isTitle(grid[cursor])) {
    const row = grid[cursor];
    periodRaw = labeled(row, "periode") ?? periodRaw;
    name = labeled(row, "nama") ?? name;
    pin = labeled(row, "pin") ?? pin;
    cursor += 1;
  }
  const period = periodRaw ? parsePeriod(periodRaw) : null;
  if (!name || !pin) return formatUnknown("Blok pegawai tidak lengkap (nama atau PIN).");
  if (!period) return formatUnknown("Periode laporan tidak dikenali. Gunakan tanggal tunggal atau rentang hari bulan tahun.");
  if (cursor >= grid.length || !isHeader(grid[cursor])) return formatUnknown("Header laporan tidak dikenali.");
  cursor = nextFilled(grid, cursor + 1);
  if (cursor >= grid.length || !isSubheader(grid[cursor])) return formatUnknown("Subheader laporan tidak dikenali.");
  cursor += 1;
  const days: ParsedDay[] = [];
  while (cursor < grid.length) {
    if (blank(grid[cursor])) {
      cursor += 1;
      continue;
    }
    if (isTitle(grid[cursor])) return formatUnknown("Blok pegawai terputus sebelum baris total.");
    const totals = readTotals(grid[cursor]);
    if (totals) {
      return { employee: { name, pin, days, reportedTotals: totals }, period, next: cursor + 1 };
    }
    const day = readDay(grid[cursor]);
    if (day === "invalid" || day === "skip") return formatUnknown(`Baris tanggal tidak dikenali pada pegawai ${pin}.`);
    days.push(day);
    cursor += 1;
  }
  return formatUnknown("Baris total pegawai tidak ditemukan.");
}

export function containsReportTitle(grid: SheetGrid): boolean {
  return grid.some((row) => isTitle(row));
}

export function parseSheet(grid: SheetGrid): ParseResult {
  const employees: ParsedEmployee[] = [];
  let period: { start: string; end: string } | null = null;
  for (let index = 0; index < grid.length; index += 1) {
    if (!isTitle(grid[index])) continue;
    const block = readBlock(grid, index);
    if ("ok" in block) return block;
    if (period && (period.start !== block.period.start || period.end !== block.period.end)) {
      return formatUnknown("Periode antar pegawai tidak sama.");
    }
    period = block.period;
    employees.push(block.employee);
    index = block.next - 1;
  }
  if (!period || employees.length === 0) return formatUnknown("Tidak ada blok pegawai yang dikenali.");
  return { ok: true, report: { period, employees }, issues: [] };
}

export function parseReport(sheets: SheetGrid[]): ParseResult {
  for (const sheet of sheets) {
    if (!containsReportTitle(sheet)) continue;
    return parseSheet(sheet);
  }
  return formatUnknown("Tidak ada lembar yang berisi blok pegawai.");
}
