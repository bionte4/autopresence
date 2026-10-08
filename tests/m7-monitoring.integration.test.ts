import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { monitoringBoard, checkDueSchedules, sendDailyDigest } from "@/modules/monitoring/service";
import type { AuthUser } from "@/modules/rbac/policy";
import { dateOnly } from "@/modules/uploads/dates";
import { createUploadSchedule } from "@/modules/upload-schedules/service";

const created = { schedules: [] as string[], uploads: [] as string[] };

function atJakarta(iso: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, 0));
}

function actor(role: AuthUser["role"], id = `${role}-actor`): AuthUser {
  return { id, email: `${role}@test`, name: role, role, employeeId: null, managedDepartmentIds: [] };
}

afterAll(async () => {
  const anomalies = await prisma.anomaly.findMany({
    where: { dedupeKey: { startsWith: "MISSING_UPLOAD|" } },
    select: { id: true, dedupeKey: true },
  });
  const owned = anomalies.filter((row) => created.schedules.some((id) => row.dedupeKey.includes(`|${id}|`)));
  if (owned.length) {
    await prisma.notification.deleteMany({ where: { anomalyId: { in: owned.map((row) => row.id) } } });
    await prisma.anomaly.deleteMany({ where: { id: { in: owned.map((row) => row.id) } } });
  }
  await prisma.notification.deleteMany({ where: { title: "Ringkasan 2026-10-08" } });
  await prisma.job.deleteMany({ where: { type: "digest.daily", payload: { path: ["date"], equals: "2026-10-08" } } });
  if (created.uploads.length) await prisma.upload.deleteMany({ where: { id: { in: created.uploads } } });
  if (created.schedules.length) await prisma.uploadSchedule.deleteMany({ where: { id: { in: created.schedules } } });
});

describe("upload monitoring", () => {
  it("flags a missed daily upload once and notifies HR", async () => {
    const hr = await prisma.user.findUniqueOrThrow({ where: { email: "hr.admin@local" } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } });
    const hrActor = actor("HR_ADMIN", hr.id);
    await expect(createUploadSchedule(actor("EMPLOYEE"), { granularity: "DAILY", cutoffTime: "10:00" }, null)).resolves.toMatchObject({ status: 403 });
    await expect(createUploadSchedule(actor("AUDITOR"), { granularity: "DAILY", cutoffTime: "10:00" }, null)).resolves.toMatchObject({ status: 403 });
    const schedule = await createUploadSchedule(hrActor, { granularity: "DAILY", cutoffTime: "10:00", enabled: true }, null);
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;
    created.schedules.push(schedule.data.id);

    const now = atJakarta("2026-10-08", "11:00");
    const key = `MISSING_UPLOAD|${schedule.data.id}|2026-10-08|2026-10-08`;
    await checkDueSchedules(now);
    await checkDueSchedules(now);
    expect(await prisma.anomaly.count({ where: { dedupeKey: key } })).toBe(1);
    const anomaly = await prisma.anomaly.findUniqueOrThrow({ where: { dedupeKey: key } });
    const notice = await prisma.notification.findFirst({ where: { anomalyId: anomaly.id, userId: hr.id, channel: "IN_APP" } });
    expect(notice?.status).toBe("SENT");

    const before = await monitoringBoard(hrActor, now);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data.find((row) => row.scheduleId === schedule.data.id && row.from === "2026-10-08")?.state).toBe("missing");

    const upload = await prisma.upload.create({
      data: {
        originalName: "harian-uji.xlsx",
        storageKey: `uji-${schedule.data.id}.xlsx`,
        sha256: createHash("sha256").update(schedule.data.id).digest("hex"),
        sizeBytes: 1,
        granularity: "DAILY",
        periodStart: dateOnly("2026-10-08"),
        periodEnd: dateOnly("2026-10-08"),
        status: "PARSED",
        fileMeta: {},
        uploadedById: admin.id,
      },
    });
    created.uploads.push(upload.id);
    await checkDueSchedules(now);
    expect((await prisma.anomaly.findUniqueOrThrow({ where: { dedupeKey: key } })).status).toBe("RESOLVED");
    const after = await monitoringBoard(hrActor, now);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data.find((row) => row.scheduleId === schedule.data.id && row.from === "2026-10-08")?.state).toBe("received");
    await expect(monitoringBoard(actor("EMPLOYEE"), now)).resolves.toMatchObject({ status: 403 });
  });

  it("sends the HR digest once after 07:00 Jakarta", async () => {
    const hr = await prisma.user.findUniqueOrThrow({ where: { email: "hr.admin@local" } });
    expect(await sendDailyDigest(atJakarta("2026-10-08", "06:59"))).toBe(false);
    expect(await sendDailyDigest(atJakarta("2026-10-08", "07:05"))).toBe(true);
    expect(await sendDailyDigest(atJakarta("2026-10-08", "08:00"))).toBe(false);
    expect(await prisma.notification.count({ where: { userId: hr.id, title: "Ringkasan 2026-10-08", channel: "IN_APP" } })).toBe(1);
  });
});
