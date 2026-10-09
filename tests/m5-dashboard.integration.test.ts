import { rmSync } from "node:fs";
import { read, utils, write } from "xlsx";
import { afterAll, describe, expect, it } from "vitest";
import { formatMinutes } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { listCorrectionPage } from "@/modules/corrections/service";
import { exportAttendanceWorkbook, getDashboard, getEmployeeDashboard } from "@/modules/dashboard/service";
import { findAuthUser } from "@/modules/auth/repo";
import type { AuthUser } from "@/modules/rbac/policy";
import { listRequestPage } from "@/modules/requests/service";
import { getTimesheet } from "@/modules/timesheet/service";
import { ingestUpload } from "@/modules/uploads/service";

const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const created = {
  employees: [] as string[],
  uploads: [] as string[],
  departments: [] as string[],
  projects: [] as string[],
  customers: [] as string[],
  users: [] as string[],
};
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

function punch(date: string, telat: string, clockOut = "17:05", note = ""): string[] {
  return [date, "08:00", "17:05", "08:00", clockOut, "-", telat, "-", "-", "-", "09:05", "09:05", "", "", note];
}

function workbook(blocks: string[][][]): Uint8Array {
  const rows = blocks.flat();
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Worksheet");
  return new Uint8Array(write(book, { type: "buffer", bookType: "xlsx" }));
}

function block(pin: string, name: string, days: string[][], totalDays: number, totalTelat: string): string[][] {
  return [
    ["Laporan Kehadiran Pegawai"],
    ["Periode", ": 2 Okt - 7 Okt 2026"],
    ["Nama", `: ${name}`],
    ["Pin", `: ${pin}`],
    [],
    header,
    subheader,
    ...days,
    [`Total ${totalDays} Hari`, "", "", "", "", "-", totalTelat, "-", "-", "-", "09:05", "09:05"],
    [],
  ];
}

function actor(role: AuthUser["role"], extra: Partial<AuthUser> = {}): AuthUser {
  return {
    id: extra.id ?? "dashboard-actor",
    email: `${role}@test`,
    name: role,
    role,
    employeeId: extra.employeeId ?? null,
    managedDepartmentIds: extra.managedDepartmentIds ?? [],
    customerDepartmentIds: extra.customerDepartmentIds,
  };
}

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
  if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  if (created.employees.length) await prisma.employee.deleteMany({ where: { id: { in: created.employees } } });
  if (created.departments.length) {
    await prisma.department.updateMany({ where: { id: { in: created.departments } }, data: { projectId: null } });
    await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
  }
  if (created.projects.length) await prisma.project.deleteMany({ where: { id: { in: created.projects } } });
  if (created.customers.length) await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
  for (const upload of uploads) rmSync(`storage/${upload.storageKey}`, { force: true });
});

describe("dashboard scope", () => {
  it("shows Billy's 2 late days and 03:43 only inside his team", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } });
    const stamp = Date.now();
    const team = await prisma.department.create({ data: { name: `Dash A ${stamp}` } });
    const otherTeam = await prisma.department.create({ data: { name: `Dash B ${stamp}` } });
    created.departments.push(team.id, otherTeam.id);
    const billy = await prisma.employee.create({
      data: { pin: `B${stamp}`, name: "BILLY TIGO RAMADHAN", departmentId: team.id, scheduleId: "seed-schedule-default" },
    });
    const other = await prisma.employee.create({
      data: { pin: `C${stamp}`, name: "=IMPOR", departmentId: otherTeam.id, scheduleId: "seed-schedule-default" },
    });
    created.employees.push(billy.id, other.id);

    const bytes = workbook([
      block(
        billy.pin,
        billy.name,
        [
          punch("Km, 2 Okt 2026", "02:13"),
          punch("Sb, 3 Okt 2026", "-", "17:05", "Tanpa Keterangan"),
          punch("Mg, 4 Okt 2026", "-", "-", "Kurang Presensi Keluar"),
          punch("Rb, 7 Okt 2026", "01:30"),
        ],
        4,
        "03:43",
      ),
      block(other.pin, "Pegawai lain", [punch("Km, 2 Okt 2026", "00:10")], 1, "00:10"),
    ]);
    const uploaded = await ingestUpload(
      actor("SUPER_ADMIN", { id: admin.id }),
      { filename: `dasbor-${stamp}.xlsx`, mime, bytes, granularity: "MONTHLY", confirm: false },
      null,
    );
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    created.uploads.push(uploaded.data.id);

    const period = { from: "2026-10-02", to: "2026-10-07", q: "", sort: "lateCount" as const, direction: "desc" as const, page: 1, pageSize: 20, grain: "week" as const };
    const hr = await getDashboard(actor("HR_ADMIN"), { ...period, departmentId: team.id });
    expect(hr.ok).toBe(true);
    if (!hr.ok) return;
    expect(hr.data.kpis.lateEvents).toBe(2);
    expect(hr.data.kpis.lateMinutes).toBe(223);
    expect(formatMinutes(hr.data.kpis.lateMinutes)).toBe("03:43");
    expect(hr.data.kpis.missingPunch).toBe(1);
    expect(hr.data.kpis.noReason).toBe(1);
    expect(hr.data.rows.map((row) => row.name)).toEqual(["BILLY TIGO RAMADHAN"]);

    const self = await getDashboard(actor("EMPLOYEE", { employeeId: billy.id }), period);
    expect(self.ok).toBe(true);
    if (!self.ok) return;
    expect(self.data.kpis.employees).toBe(1);
    expect(self.data.kpis.lateEvents).toBe(2);
    expect(formatMinutes(self.data.kpis.lateMinutes)).toBe("03:43");
    expect(self.data.rows.every((row) => row.employeeId === billy.id)).toBe(true);

    const outsider = await getDashboard(actor("MANAGER", { managedDepartmentIds: [otherTeam.id] }), period);
    expect(outsider.ok).toBe(true);
    if (!outsider.ok) return;
    expect(outsider.data.rows.map((row) => row.name)).toEqual(["=IMPOR"]);
    expect(outsider.data.kpis.lateEvents).toBe(1);

    await expect(getDashboard(actor("MANAGER", { managedDepartmentIds: [otherTeam.id] }), { ...period, departmentId: team.id })).resolves.toMatchObject({
      status: 403,
    });
    await expect(getEmployeeDashboard(actor("EMPLOYEE", { employeeId: billy.id }), other.id, period)).resolves.toMatchObject({ status: 403 });
    await expect(getEmployeeDashboard(actor("MANAGER", { managedDepartmentIds: [otherTeam.id] }), billy.id, period)).resolves.toMatchObject({
      status: 404,
    });
    const detail = await getEmployeeDashboard(actor("EMPLOYEE", { employeeId: billy.id }), billy.id, period);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.data.kpis.lateEvents).toBe(2);
    expect(formatMinutes(detail.data.kpis.lateMinutes)).toBe("03:43");

    const file = await exportAttendanceWorkbook(actor("HR_ADMIN"), period);
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    expect(file.data.filename.endsWith(".xlsx")).toBe(true);
    const book = read(file.data.body);
    const grid = utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1 });
    const flat = grid.flat().map(String);
    expect(flat).toContain("BILLY TIGO RAMADHAN");
    expect(flat).toContain("03:43");
    expect(flat).toContain("'=IMPOR");

    const customer = await prisma.customer.create({ data: { name: `Pelanggan ${stamp}` } });
    const project = await prisma.project.create({ data: { name: `Proyek ${stamp}`, customerId: customer.id } });
    created.customers.push(customer.id);
    created.projects.push(project.id);
    await prisma.department.update({ where: { id: team.id }, data: { projectId: project.id } });
    const viewer = await prisma.user.create({
      data: {
        email: `pelanggan-${stamp}@test`,
        name: "Pelanggan uji",
        passwordHash: "not-a-login",
        role: "CUSTOMER",
        customerId: customer.id,
      },
    });
    created.users.push(viewer.id);
    const loaded = await findAuthUser(viewer.id);
    expect(loaded?.customerDepartmentIds).toEqual([team.id]);
    const portal = actor("CUSTOMER", { customerDepartmentIds: loaded?.customerDepartmentIds });
    const board = await getDashboard(portal, period);
    expect(board.ok).toBe(true);
    if (!board.ok) return;
    expect(board.data.rows.map((row) => row.name)).toEqual(["BILLY TIGO RAMADHAN"]);
    expect(board.data.rows.every((row) => row.pin === "")).toBe(true);
    expect(board.data.kpis.openAnomalies).toBe(0);
    expect(board.data.integrity).toBeNull();
    await expect(getDashboard(portal, { ...period, departmentId: otherTeam.id })).resolves.toMatchObject({ status: 403 });
    await expect(getEmployeeDashboard(portal, other.id, period)).resolves.toMatchObject({ status: 404 });
    const own = await getEmployeeDashboard(portal, billy.id, period);
    expect(own.ok).toBe(true);
    if (!own.ok) return;
    expect(own.data.employee.pin).toBe("");
    const exported = await exportAttendanceWorkbook(portal, { ...period, departmentId: team.id });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const customerBook = read(exported.data.body);
    const customerGrid = utils.sheet_to_json<string[]>(customerBook.Sheets[customerBook.SheetNames[0]], { header: 1 });
    expect(customerGrid[0]).not.toContain("PIN");
    expect(customerGrid.flat().map(String)).not.toContain(billy.pin);
    const listQuery = { page: 1, pageSize: 20, q: "", sort: "createdAt" as const, direction: "desc" as const };
    await expect(listCorrectionPage(portal, listQuery)).resolves.toMatchObject({ status: 403 });
    await expect(listRequestPage(portal, listQuery)).resolves.toMatchObject({ status: 403 });
    await expect(getTimesheet(portal, billy.id, period)).resolves.toMatchObject({ status: 403 });
  });
});
