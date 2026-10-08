import { readFileSync, rmSync } from "node:fs";
import { utils, write } from "xlsx";
import { afterAll, describe, expect, it } from "vitest";
import { prisma, transaction } from "@/lib/prisma";
import type { AuthUser } from "@/modules/rbac/policy";
import { insertAttendance } from "@/modules/uploads/repo";
import { ingestUpload } from "@/modules/uploads/service";

const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const created = { employees: [] as string[], uploads: [] as string[] };

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

function sheet(period: string, pin: string, days: string[][], totals: string[]): Uint8Array {
  const rows = [["Laporan Kehadiran Pegawai"], ["Periode", period], ["Nama", ": Uji Upload"], ["Pin", pin], [], header, subheader, ...days, totals];
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Worksheet");
  return new Uint8Array(write(book, { type: "buffer", bookType: "xlsx" }));
}

const day = (date: string, clockIn: string, clockOut: string, note = ""): string[] => [
  date,
  "08:00",
  "17:05",
  clockIn,
  clockOut,
  "-",
  "-",
  "-",
  "-",
  "-",
  "09:05",
  "09:05",
  "",
  "",
  note,
];

afterAll(async () => {
  const uploads = await prisma.upload.findMany({ where: { id: { in: created.uploads } }, select: { id: true, storageKey: true } });
  const records = await prisma.attendanceRecord.findMany({ where: { sourceUploadId: { in: created.uploads } }, select: { id: true } });
  if (records.length) {
    await prisma.attendanceRevision.deleteMany({ where: { recordId: { in: records.map((row) => row.id) } } });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: records.map((row) => row.id) } } });
  }
  await prisma.anomaly.deleteMany({ where: { uploadId: { in: created.uploads } } });
  const jobs = await prisma.job.findMany({ where: { type: "anomaly.dispatch" } });
  const jobIds = jobs
    .filter((job) => {
      const payload = job.payload;
      return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && created.uploads.includes(String(payload.uploadId)));
    })
    .map((job) => job.id);
  if (jobIds.length) await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  if (created.uploads.length) await prisma.upload.deleteMany({ where: { id: { in: created.uploads } } });
  if (created.employees.length) await prisma.employee.deleteMany({ where: { id: { in: created.employees } } });
  for (const upload of uploads) {
    rmSync(`storage/${upload.storageKey}`, { force: true });
  }
});

describe("upload pipeline", () => {
  it("keeps completed rows, fills an open clock-out, and rejects the same bytes", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } });
    const actor: AuthUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      employeeId: null,
      managedDepartmentIds: [],
    };
    const employee = await prisma.employee.create({
      data: { pin: `U${Date.now()}`, name: "Uji Upload", scheduleId: "seed-schedule-default" },
    });
    created.employees.push(employee.id);
    const pin = `: ${employee.pin}`;
    const totals = ["Total 1 Hari", "", "", "", "", "-", "-", "-", "-", "-", "09:05", "09:05"];

    const daily = sheet(": 2 Okt - 2 Okt 2026", pin, [day("Km, 2 Okt 2026", "08:00", "17:05")], totals);
    const first = await ingestUpload(actor, { filename: "uji-harian.xlsx", mime, bytes: daily, granularity: "DAILY", confirm: false }, null);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    created.uploads.push(first.data.id);
    expect(first.data.stats?.inserted).toBe(1);

    const again = await ingestUpload(actor, { filename: "uji-harian.xlsx", mime, bytes: daily, granularity: "DAILY", confirm: false }, null);
    expect(again).toMatchObject({ ok: false, code: "DUPLICATE_FILE", uploadId: first.data.id });

    const monthly = sheet(
      ": 2 Okt - 3 Okt 2026",
      pin,
      [day("Km, 2 Okt 2026", "08:00", "17:05"), day("Jm, 3 Okt 2026", "08:00", "17:05")],
      ["Total 2 Hari", "", "", "", "", "-", "-", "-", "-", "-", "18:10", "18:10"],
    );
    const overlap = await ingestUpload(actor, { filename: "uji-bulanan.xlsx", mime, bytes: monthly, granularity: "MONTHLY", confirm: false }, null);
    expect(overlap.ok).toBe(true);
    if (!overlap.ok) return;
    created.uploads.push(overlap.data.id);
    expect(overlap.data.stats?.unchanged).toBe(1);
    expect(overlap.data.stats?.inserted).toBe(1);

    const changed = sheet(": 2 Okt - 2 Okt 2026", pin, [day("Km, 2 Okt 2026", "10:13", "17:05")], totals);
    const conflict = await ingestUpload(actor, { filename: "uji-konflik.xlsx", mime, bytes: changed, granularity: "DAILY", confirm: false }, null);
    expect(conflict.ok).toBe(true);
    if (!conflict.ok) return;
    created.uploads.push(conflict.data.id);
    expect(conflict.data.stats?.conflicts).toBe(1);
    const stored = await prisma.attendanceRecord.findFirstOrThrow({ where: { employeeId: employee.id, date: new Date("2026-10-02T00:00:00.000Z") } });
    expect(stored.clockInMin).toBe(480);
    const anomaly = await prisma.anomaly.findFirst({ where: { uploadId: conflict.data.id, type: "DATA_CHANGED" } });
    expect(anomaly).not.toBeNull();

    const open = sheet(": 4 Okt - 4 Okt 2026", pin, [day("Mg, 4 Okt 2026", "08:00", "-", "Kurang Presensi Keluar")], totals);
    const missing = await ingestUpload(actor, { filename: "uji-kosong.xlsx", mime, bytes: open, granularity: "DAILY", confirm: false }, null);
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    created.uploads.push(missing.data.id);
    const closed = sheet(": 4 Okt - 4 Okt 2026", pin, [day("Mg, 4 Okt 2026", "08:00", "17:05")], totals);
    const completed = await ingestUpload(actor, { filename: "uji-lengkap.xlsx", mime, bytes: closed, granularity: "DAILY", confirm: false }, null);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    created.uploads.push(completed.data.id);
    expect(completed.data.stats?.completed).toBe(1);
    const finished = await prisma.attendanceRecord.findFirstOrThrow({ where: { employeeId: employee.id, date: new Date("2026-10-04T00:00:00.000Z") } });
    expect(finished.clockOutMin).toBe(1025);

    const manager: AuthUser = { ...actor, id: "manager-actor", role: "MANAGER" };
    await expect(
      ingestUpload(manager, { filename: "uji-harian.xlsx", mime, bytes: daily, granularity: "DAILY", confirm: false }, null),
    ).resolves.toMatchObject({ status: 403 });
  });

  it("asks before saving a period that does not match the chosen granularity", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } });
    const actor: AuthUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      employeeId: null,
      managedDepartmentIds: [],
    };
    const bytes = sheet(": 2 Okt - 3 Okt 2026", ": 1", [day("Km, 2 Okt 2026", "08:00", "17:05"), day("Jm, 3 Okt 2026", "08:00", "17:05")], ["Total 2 Hari"]);
    const warned = await ingestUpload(actor, { filename: "uji-mingguan.xlsx", mime, bytes, granularity: "DAILY", confirm: false }, null);
    expect(warned).toMatchObject({ code: "GRANULARITY_MISMATCH" });
    expect(await prisma.upload.count({ where: { sha256: { not: "" }, originalName: "uji-mingguan.xlsx" } })).toBe(0);
  });

  it("rolls back a record when the write fails", async () => {
    const employee = await prisma.employee.create({
      data: { pin: `R${Date.now()}`, name: "Rollback", scheduleId: "seed-schedule-default" },
    });
    created.employees.push(employee.id);
    await expect(
      transaction(async (tx) => {
        await insertAttendance(tx, {
          employeeId: employee.id,
          date: new Date("2026-10-02T00:00:00.000Z"),
          isWorkday: true,
          sourceUploadId: "upload-yang-tidak-ada",
        });
        throw new Error("gagal");
      }),
    ).rejects.toThrow();
    expect(await prisma.attendanceRecord.count({ where: { employeeId: employee.id } })).toBe(0);
  });

  it("accepts the real sample workbook bytes as a zip", () => {
    const bytes = readFileSync("fixtures/Laporan_Per_Atribut.xlsx");
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
  });
});
