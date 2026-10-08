import { utils, write } from "xlsx";
import { formatMinutes } from "@/lib/format";
import { sheetText } from "@/modules/dashboard/sheet";

export type TimesheetRow = {
  date: string;
  clockInMin: number | null;
  clockOutMin: number | null;
  lateMin: number | null;
  note: string | null;
  overtimeMin: number | null;
};

function clock(value: number | null): string {
  return value === null ? "" : formatMinutes(value);
}

export function timesheetWorkbook(name: string, rows: TimesheetRow[]): Buffer {
  const header = ["Nama", "Tanggal", "Masuk", "Keluar", "Telat", "Keterangan", "Lembur"];
  const body = rows.map((row) => [
    sheetText(name),
    row.date,
    clock(row.clockInMin),
    clock(row.clockOutMin),
    row.lateMin === null ? "" : formatMinutes(row.lateMin),
    sheetText(row.note ?? ""),
    row.overtimeMin === null ? "" : formatMinutes(row.overtimeMin),
  ]);
  const sheet = utils.aoa_to_sheet([header, ...body]);
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "Timesheet");
  return write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
