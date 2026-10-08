import { formatMinutes } from "@/lib/format";
import type { EmployeeSummary } from "./aggregate";

/** Spreadsheet apps execute cells that start with = + - @. A leading quote keeps them as text. */
export function csvCell(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(neutralized)) return `"${neutralized.replaceAll('"', '""')}"`;
  return neutralized;
}

export function attendanceCsv(rows: EmployeeSummary[]): string {
  const header = ["Nama", "PIN", "Departemen", "Kejadian terlambat", "Total telat", "Kurang presensi", "Tanpa keterangan"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.name),
        csvCell(row.pin),
        csvCell(row.departmentName ?? ""),
        csvCell(String(row.lateCount)),
        csvCell(formatMinutes(row.lateMinutes)),
        csvCell(String(row.missingPunch)),
        csvCell(String(row.noReason)),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}
