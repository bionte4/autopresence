import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCorrection, reviewCorrection } from "@/modules/corrections/service";
import type { AuthUser } from "@/modules/rbac/policy";
import { dateOnly } from "@/modules/uploads/dates";

const created = { records: [] as string[], uploads: [] as string[], employees: [] as string[], departments: [] as string[] };

function actor(
  user: { id: string; email: string; name: string; role: AuthUser["role"]; employeeId: string | null },
  departments: string[],
  reviewSeats: AuthUser["reviewSeats"] = [],
): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role, employeeId: user.employeeId, managedDepartmentIds: departments, reviewSeats };
}

afterAll(async () => {
  if (created.records.length) {
    await prisma.attendanceRevision.deleteMany({ where: { recordId: { in: created.records } } });
    await prisma.correction.deleteMany({ where: { recordId: { in: created.records } } });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: created.records } } });
  }
  if (created.uploads.length) await prisma.upload.deleteMany({ where: { id: { in: created.uploads } } });
  if (created.employees.length) await prisma.employee.deleteMany({ where: { id: { in: created.employees } } });
  if (created.departments.length) await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
});

describe("attendance corrections", () => {
  it("applies a clock fix only after team leader, operation manager, and project manager approve", async () => {
    const [manager, hr, auditor, employeeUser, superUser, schedule] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "manager@local" }, include: { managedDepartments: true } }),
      prisma.user.findUniqueOrThrow({ where: { email: "hr.admin@local" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "auditor@local" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "employee@local" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } }),
      prisma.workSchedule.findUniqueOrThrow({ where: { id: "seed-schedule-default" } }),
    ]);
    const department = await prisma.department.create({ data: { name: `Uji Koreksi ${Date.now()}` } });
    created.departments.push(department.id);
    await prisma.departmentReviewer.createMany({
      data: [
        { departmentId: department.id, seat: "TEAM_LEADER", userId: hr.id },
        { departmentId: department.id, seat: "OPERATION_MANAGER", userId: superUser.id },
        { departmentId: department.id, seat: "PROJECT_MANAGER", userId: employeeUser.id },
      ],
    });
    const managerActor = actor(manager, [department.id, ...manager.managedDepartments.map((row) => row.id)]);
    const hrActor = actor(hr, []);
    const projectActor = actor(employeeUser, [], [{ departmentId: department.id, seat: "PROJECT_MANAGER" }]);
    const staff = await prisma.employee.create({
      data: { pin: `m8-${Date.now()}`, name: "Pegawai Koreksi", departmentId: department.id, scheduleId: schedule.id },
    });
    created.employees.push(staff.id);
    const upload = await prisma.upload.create({
      data: {
        originalName: "koreksi.xlsx",
        storageKey: `koreksi-${staff.id}.xlsx`,
        sha256: createHash("sha256").update(staff.id).digest("hex"),
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
        employeeId: staff.id,
        date: dateOnly("2026-10-02"),
        isWorkday: true,
        scheduleInMin: 480,
        scheduleOutMin: 1025,
        clockInMin: 613,
        clockOutMin: 1025,
        lateMin: 133,
        earlyArrivalMin: 0,
        sourceUploadId: upload.id,
      },
    });
    created.records.push(record.id);

    const body = { recordId: record.id, clockInMin: 480, reason: "Jam mesin salah.", evidenceNote: "surat atasan" };
    await expect(createCorrection(actor(auditor, []), body, null)).resolves.toMatchObject({ status: 403 });
    await expect(createCorrection(actor(employeeUser, []), body, null)).resolves.toMatchObject({ status: 403 });
    await expect(createCorrection(actor(manager, []), body, null)).resolves.toMatchObject({ status: 403 });

    const proposed = await createCorrection(managerActor, body, null);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    await expect(createCorrection(managerActor, body, null)).resolves.toMatchObject({ status: 409 });
    await expect(reviewCorrection(managerActor, proposed.data.id, "APPROVED", "Bukan wewenang.", null)).resolves.toMatchObject({ status: 403 });

    const lead = await reviewCorrection(hrActor, proposed.data.id, "APPROVED", "Team leader setuju.", null);
    expect(lead.ok).toBe(true);
    if (!lead.ok) return;
    expect(lead.data.status).toBe("PENDING");
    expect(lead.data.stage).toBe("OPERATION_MANAGER");
    expect((await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } })).clockInMin).toBe(613);

    const operations = await reviewCorrection(actor(superUser, []), proposed.data.id, "APPROVED", "Operation manager setuju.", null);
    expect(operations.ok).toBe(true);
    if (!operations.ok) return;
    expect(operations.data.stage).toBe("PROJECT_MANAGER");
    expect((await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } })).clockInMin).toBe(613);

    const approved = await reviewCorrection(projectActor, proposed.data.id, "APPROVED", "Project manager setuju.", null);
    expect(approved.ok).toBe(true);
    const stored = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(stored.clockInMin).toBe(480);
    expect(stored.lateMin).toBe(0);
    expect(await prisma.attendanceRevision.count({ where: { correctionId: proposed.data.id } })).toBe(1);
    await expect(reviewCorrection(hrActor, proposed.data.id, "REJECTED", "Sudah selesai.", null)).resolves.toMatchObject({ status: 409 });

    const second = await createCorrection(managerActor, { recordId: record.id, note: "Terlambat", reason: "Catatan salah." }, null);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const rejected = await reviewCorrection(hrActor, second.data.id, "REJECTED", "Tidak cukup bukti.", null);
    expect(rejected.ok).toBe(true);
    expect((await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } })).note).toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: proposed.data.id, action: "correction.approve" } })).toBe(1);
  });
});
