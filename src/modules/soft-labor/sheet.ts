import { utils, write } from "xlsx";
import { formatMinutes } from "@/lib/format";
import { sheetText } from "@/modules/dashboard/sheet";
import type { OvertimeRow, SoftSummary, WeekRow } from "./aggregate";
import { WEEKLY_LIMIT_MIN } from "./aggregate";

export function softLaborWorkbook(input: {
  from: string;
  to: string;
  summaries: SoftSummary[];
  weeks: WeekRow[];
  overtime: OvertimeRow[];
}): Buffer {
  const book = utils.book_new();
  const notice = [
    ["Laporan lembur (pembinaan)"],
    [`Periode ${input.from} s.d. ${input.to}`],
    ["Bahan pembinaan internal. Bukan putusan hukum atau sanksi otomatis."],
    ["Acuan jam mingguan: 40 jam (kerangka umum UU Ketenagakerjaan)."],
    ["Istirahat: ditandai jika ada 7 hari kalender beruntun dengan jam kerja tercatat."],
    ["Lembur: jam pulang setelah jadwal dibandingkan dengan pengajuan lembur yang disetujui."],
  ];

  const summaryHeader = [
    "Nama",
    "PIN",
    "Departemen",
    "Minggu di atas 40 jam",
    "Rentetan kerja terpanjang (hari)",
    "Perlu tinjau istirahat",
    "Hari lembur tanpa persetujuan",
    "Catatan pembinaan",
  ];
  const summaryBody = input.summaries.map((row) => [
    sheetText(row.name),
    sheetText(row.pin),
    sheetText(row.departmentName ?? ""),
    row.weeksOverLimit,
    row.maxWorkStreak,
    row.restFlag ? "Ya" : "Tidak",
    row.overtimeWithoutApprovalDays,
    sheetText(row.coachingNote),
  ]);
  utils.book_append_sheet(book, utils.aoa_to_sheet([...notice, [], summaryHeader, ...summaryBody]), "Ringkasan");

  const weekHeader = ["Nama", "Departemen", "Minggu", "Jam aktual", "Acuan 40 jam", "Status", "Catatan"];
  const weekBody = input.weeks.map((row) => [
    sheetText(row.name),
    sheetText(row.departmentName ?? ""),
    sheetText(row.week),
    sheetText(formatMinutes(row.workedMin)),
    sheetText(formatMinutes(WEEKLY_LIMIT_MIN)),
    row.overLimit ? "Perlu ditinjau" : "Dalam acuan",
    sheetText(row.note),
  ]);
  utils.book_append_sheet(book, utils.aoa_to_sheet([weekHeader, ...weekBody]), "Jam mingguan");

  const otHeader = [
    "Nama",
    "Departemen",
    "Tanggal",
    "Lembur teramati",
    "Lembur disetujui",
    "Selisih tanpa persetujuan",
    "Catatan",
  ];
  const otBody = input.overtime.map((row) => [
    sheetText(row.name),
    sheetText(row.departmentName ?? ""),
    sheetText(row.date),
    sheetText(formatMinutes(row.observedMin)),
    sheetText(formatMinutes(row.approvedMin)),
    sheetText(formatMinutes(row.gapMin)),
    sheetText(row.note),
  ]);
  utils.book_append_sheet(book, utils.aoa_to_sheet([otHeader, ...otBody]), "Lembur");

  return write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
