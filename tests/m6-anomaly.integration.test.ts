import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { utils, write } from "xlsx";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { acknowledgeAnomaly, listAnomalyPage, resolveAnomaly } from "@/modules/anomalies/service";
import { useMailer } from "@/modules/notify/mailer";
import { dispatchUpload } from "@/modules/notify/dispatch";
import type { AuthUser } from "@/modules/rbac/policy";
import { ingestUpload } from "@/modules/uploads/service";

const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const created = { uploads: [] as string[], employees: [] as string[], departments: [] as string[] };
const header = ["Tanggal", "Jam Kerja", "", "Jam Masuk", "Jam Keluar", "Jam Datang", "", "Jumlah Jam Pulang", "", "Terlambat Aktual", "Jumlah Jam Efektif", "Jumlah Jam Aktual", "Lokasi Masuk", "Lokasi Keluar", "Keterangan"];
const subheader = ["", "Masuk", "Pulang", "", "", "Cepat", "Telat", "Cepat", "Telat"];

function workbook(pin: string, note: string): Uint8Array {
  const rows = [
    ["Laporan Kehadiran Pegawai"],
    ["Periode", ": 2 Okt - 2 Okt 2026"],
    ["Nama", ": Uji Anomali"],
    ["Pin", `: ${pin}`],
    [],
    header,
    subheader,
    ["Km, 2 Okt 2026", "08:00", "17:05", "08:00", "17:05", "-", "-", "-", "-", "-", "09:05", "09:05", "", "", note],
    ["Total 1 Hari", "", "", "", "", "-", "-", "-", "-", "-", "09:05", "09:05"],
  ];
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Worksheet");
  return new Uint8Array(write(book, { type: "buffer", bookType: "xlsx" }));
}

function actor(role: AuthUser["role"], extra: Partial<AuthUser> = {}): AuthUser {
  return {
    id: extra.id ?? `${role}-actor`,
    email: `${role}@test`,
    name: role,
    role,
    employeeId: extra.employeeId ?? null,
    managedDepartmentIds: extra.managedDepartmentIds ?? [],
  };
}

async function noteCount(uploadId: string): Promise<number> {
  return prisma.notification.count({ where: { anomaly: { uploadId } } });
}

afterAll(async () => {
  useMailer(null);
  const uploads = await prisma.upload.findMany({ where: { id: { in: created.uploads } }, select: { id: true, storageKey: true } });
  const anomalies = await prisma.anomaly.findMany({ where: { uploadId: { in: created.uploads } }, select: { id: true } });
  if (anomalies.length) await prisma.notification.deleteMany({ where: { anomalyId: { in: anomalies.map((row) => row.id) } } });
  if (created.uploads.length) {
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
    await prisma.upload.deleteMany({ where: { id: { in: created.uploads } } });
  }
  if (created.employees.length) await prisma.employee.deleteMany({ where: { id: { in: created.employees } } });
  if (created.departments.length) await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
  for (const upload of uploads) rmSync(`storage/${upload.storageKey}`, { force: true });
});

describe("anomaly alerts", () => {
  it("does not notify when a report is uploaded or repeated", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } });
    const bytes = readFileSync("fixtures/Laporan_Per_Atribut.xlsx");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    let upload = await prisma.upload.findUnique({ where: { sha256 } });
    if (!upload) {
      const ingested = await ingestUpload(
        actor("SUPER_ADMIN", { id: admin.id }),
        { filename: "Laporan_Per_Atribut.xlsx", mime, bytes, granularity: "MONTHLY", confirm: true },
        null,
      );
      expect(ingested.ok).toBe(true);
      if (!ingested.ok) return;
      upload = await prisma.upload.findUniqueOrThrow({ where: { id: ingested.data.id } });
    }
    const before = await noteCount(upload.id);
    await dispatchUpload(upload.id);
    expect(await noteCount(upload.id)).toBe(before);

    const uploader = actor("SUPER_ADMIN", { id: admin.id });
    await ingestUpload(uploader, { filename: "Laporan_Per_Atribut.xlsx", mime, bytes, granularity: "MONTHLY", confirm: true }, null);
    await ingestUpload(uploader, { filename: "Laporan_Per_Atribut.xlsx", mime, bytes, granularity: "MONTHLY", confirm: true }, null);
    expect(await noteCount(upload.id)).toBe(before);
  }, 30_000);

  it("keeps the upload when SMTP fails and enforces resolve permissions", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } });
    const hrUser = await prisma.user.findUniqueOrThrow({ where: { email: "hr.admin@local" } });
    const stamp = Date.now();
    const department = await prisma.department.create({ data: { name: `Anomali ${stamp}` } });
    created.departments.push(department.id);
    const employee = await prisma.employee.create({
      data: { pin: `N${stamp}`, name: `Pegawai ${stamp}`, departmentId: department.id, scheduleId: "seed-schedule-default" },
    });
    created.employees.push(employee.id);
    useMailer({
      async send() {
        throw new Error("smtp down");
      },
    });
    const ingested = await ingestUpload(
      actor("SUPER_ADMIN", { id: admin.id }),
      { filename: `anomali-${stamp}.xlsx`, mime, bytes: workbook(employee.pin, "Kurang Presensi Keluar"), granularity: "DAILY", confirm: false },
      null,
    );
    useMailer(null);
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) return;
    created.uploads.push(ingested.data.id);
    expect(ingested.data.status).not.toBe("REJECTED");
    expect(await noteCount(ingested.data.id)).toBe(0);

    const low = await prisma.anomaly.findFirstOrThrow({ where: { uploadId: ingested.data.id, type: "MISSING_PUNCH", employeeId: employee.id } });
    const critical = await prisma.anomaly.create({
      data: {
        type: "DATA_CHANGED",
        severity: "CRITICAL",
        uploadId: ingested.data.id,
        employeeId: employee.id,
        message: "Data kehadiran yang sudah lengkap berubah.",
        details: {},
        dedupeKey: `critical-${stamp}`,
      },
    });
    const manager = actor("MANAGER", { managedDepartmentIds: [department.id] });
    const outsider = actor("MANAGER", { managedDepartmentIds: ["departemen-lain"] });
    const hr = actor("HR_ADMIN", { id: hrUser.id });
    const auditor = actor("AUDITOR");
    await expect(listAnomalyPage(actor("EMPLOYEE"), { page: 1, pageSize: 20, q: "", sort: "createdAt", direction: "desc" })).resolves.toMatchObject({ status: 403 });
    await expect(acknowledgeAnomaly(auditor, critical.id, null)).resolves.toMatchObject({ status: 403 });
    await expect(acknowledgeAnomaly(manager, critical.id, null)).resolves.toMatchObject({ status: 403 });
    await expect(acknowledgeAnomaly(outsider, low.id, null)).resolves.toMatchObject({ status: 404 });
    await expect(acknowledgeAnomaly(manager, low.id, null)).resolves.toMatchObject({ ok: true });
    await expect(resolveAnomaly(hr, critical.id, { outcome: "RESOLVED", note: "ok" }, null)).resolves.toMatchObject({ status: 400 });
    const resolved = await resolveAnomaly(hr, critical.id, { outcome: "FALSE_POSITIVE", note: "Diperiksa ulang." }, null);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.data.status).toBe("FALSE_POSITIVE");
    await expect(resolveAnomaly(hr, critical.id, { outcome: "RESOLVED", note: "Diperiksa ulang." }, null)).resolves.toMatchObject({ status: 409 });
  });
});
