import { utils, write } from "xlsx";
import { formatMinutes } from "@/lib/format";
import type { EmployeeSummary } from "./aggregate";

/** Spreadsheet apps execute cells that start with = + - @. A leading quote keeps them as text. */
export function sheetText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function attendanceWorkbook(rows: EmployeeSummary[]): Buffer {
  const header = ["Nama", "PIN", "Departemen", "Kejadian terlambat", "Total telat", "Kurang presensi", "Tanpa keterangan"];
  const body = rows.map((row) => [
    sheetText(row.name),
    sheetText(row.pin),
    sheetText(row.departmentName ?? ""),
    row.lateCount,
    sheetText(formatMinutes(row.lateMinutes)),
    row.missingPunch,
    row.noReason,
  ]);
  const sheet = utils.aoa_to_sheet([header, ...body]);
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "Kehadiran");
  return write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
