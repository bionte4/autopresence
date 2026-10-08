import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { rowMissingPunch } from "@/modules/dashboard/aggregate";
import { dateOnly } from "@/modules/uploads/dates";
import { createRequest, reviewRequest } from "@/modules/requests/service";
import type { AuthUser } from "@/modules/rbac/policy";

const created = { employees: [] as string[], uploads: [] as string[], requests: [] as string[], departments: [] as string[] };

function actor(
  user: { id: string; email: string; name: string; role: AuthUser["role"]; employeeId: string | null },
  reviewSeats: AuthUser["reviewSeats"] = [],
): AuthUser {
  return { ...user, managedDepartmentIds: [], reviewSeats };
}

afterAll(async () => {
  if (created.requests.length) await prisma.attendanceRequest.deleteMany({ where: { id: { in: created.requests } } });
  const records = await prisma.attendanceRecord.findMany({ where: { sourceUploadId: { in: created.uploads } }, select: { id: true } });
  if (records.length) {
    await prisma.attendanceRevision.deleteMany({ where: { recordId: { in: records.map((row) => row.id) } } });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: records.map((row) => row.id) } } });
  }
  if (created.uploads.length) await prisma.upload.deleteMany({ where: { id: { in: created.uploads } } });
  if (created.employees.length) await prisma.employee.deleteMany({ where: { id: { in: created.employees } } });
  if (created.departments.length) await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
});

describe("leave and overtime requests", () => {
  it("writes Cuti onto the attendance row only after the review chain finishes", async () => {
    const [hr, auditor, manager, superUser, projectUser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "hr.admin@local" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "auditor@local" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "manager@local" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "employee@local" } }),
    ]);
    const stamp = Date.now();
    const department = await prisma.department.create({ data: { name: `Uji Pengajuan ${stamp}` } });
    created.departments.push(department.id);
    await prisma.departmentReviewer.createMany({
      data: [
        { departmentId: department.id, seat: "TEAM_LEADER", userId: manager.id },
        { departmentId: department.id, seat: "OPERATION_MANAGER", userId: superUser.id },
        { departmentId: department.id, seat: "PROJECT_MANAGER", userId: projectUser.id },
      ],
    });
    const employee = await prisma.employee.create({
      data: { pin: `rq${stamp}`, name: "Pegawai Pengajuan", scheduleId: "seed-schedule-default", departmentId: department.id },
    });
    created.employees.push(employee.id);
    const upload = await prisma.upload.create({
      data: {
        originalName: `uji-${stamp}.xlsx`,
        storageKey: `${stamp.toString(16).padStart(32, "a").slice(0, 32)}.xlsx`,
        sha256: `${stamp.toString(16).padStart(64, "b").slice(0, 64)}`,
        sizeBytes: 1,
        granularity: "DAILY",
        periodStart: dateOnly("2026-10-02"),
        periodEnd: dateOnly("2026-10-02"),
        status: "PARSED",
        fileMeta: {},
        uploadedById: hr.id,
      },
    });
    created.uploads.push(upload.id);
    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        date: dateOnly("2026-10-02"),
        isWorkday: true,
        sourceUploadId: upload.id,
      },
    });

    const leave = await createRequest(
      actor(hr),
      { employeeId: employee.id, kind: "LEAVE", startDate: "2026-10-02", endDate: "2026-10-02", reason: "Acara keluarga." },
      null,
    );
    expect(leave.ok).toBe(true);
    if (!leave.ok) return;
    created.requests.push(leave.data.id);
    expect(await prisma.attendanceRecord.findUnique({ where: { id: record.id } })).toMatchObject({ note: null });

    await expect(reviewRequest(actor(auditor), leave.data.id, "APPROVED", "Bukan wewenang auditor.", null)).resolves.toMatchObject({
      status: 403,
    });
    const lead = await reviewRequest(
      actor(manager, [{ departmentId: department.id, seat: "TEAM_LEADER" }]),
      leave.data.id,
      "APPROVED",
      "Team leader setuju.",
      null,
    );
    expect(lead.ok).toBe(true);
    expect((await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } })).note).toBeNull();
    const operations = await reviewRequest(actor(superUser), leave.data.id, "APPROVED", "Operation manager setuju.", null);
    expect(operations.ok).toBe(true);
    expect((await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } })).note).toBeNull();
    const approved = await reviewRequest(
      actor(projectUser, [{ departmentId: department.id, seat: "PROJECT_MANAGER" }]),
      leave.data.id,
      "APPROVED",
      "Project manager setuju.",
      null,
    );
    expect(approved.ok).toBe(true);
    const stored = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(stored.note).toBe("Cuti");
    expect(rowMissingPunch({ note: stored.note, isWorkday: true, clockInMin: null, clockOutMin: null })).toBe(false);
    expect(await prisma.attendanceRevision.count({ where: { recordId: record.id } })).toBe(1);

    const overtime = await createRequest(
      actor(hr),
      { employeeId: employee.id, kind: "OVERTIME", startDate: "2026-10-02", endDate: "2026-10-02", endMin: 1085, reason: "Lembur rilis." },
      null,
    );
    expect(overtime.ok).toBe(true);
    if (!overtime.ok) return;
    created.requests.push(overtime.data.id);
    expect(overtime.data.overtimeMin).toBe(60);
    expect(await prisma.attendanceRecord.findUnique({ where: { id: record.id } })).toMatchObject({ clockOutMin: null });
  });
});
