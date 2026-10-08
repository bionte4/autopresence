import { audit } from "@/modules/audit/service";
import { denied, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { isoDate } from "@/modules/uploads/dates";
import { listEnabledUploadSchedules } from "@/modules/upload-schedules/repo";
import { closeMissingAnomaly, insertMissingAnomaly, listUploadsOverlapping } from "./repo";
import { jakartaParts, scheduleSlots, shiftDate, uploadCovers, type PeriodSlot, type ScheduleClock } from "./periods";

export type MonitorRow = {
  scheduleId: string;
  granularity: ScheduleClock["granularity"];
  cutoffTime: string;
  from: string;
  to: string;
  state: "received" | "waiting" | "missing";
  uploadId: string | null;
};

const GRANULARITY_LABEL = { DAILY: "harian", WEEKLY: "mingguan", MONTHLY: "bulanan" } as const;

function covers(upload: { granularity: ScheduleClock["granularity"]; periodStart: Date; periodEnd: Date; status: string }, granularity: ScheduleClock["granularity"], slot: PeriodSlot) {
  return uploadCovers(
    { granularity: upload.granularity, periodStart: isoDate(upload.periodStart), periodEnd: isoDate(upload.periodEnd), status: upload.status },
    granularity,
    slot,
  );
}

export async function monitoringBoard(actor: AuthUser, now = new Date()): Promise<ServiceResult<MonitorRow[]>> {
  if (!can(actor, "upload.read")) return denied();
  const schedules = await listEnabledUploadSchedules();
  const clock = jakartaParts(now);
  const uploads = await listUploadsOverlapping(shiftDate(clock.date, -70), shiftDate(clock.date, 35));
  const rows: MonitorRow[] = [];
  for (const schedule of schedules) {
    const slots = scheduleSlots(schedule, now);
    for (const slot of [slots.due, slots.upcoming]) {
      if (!slot) continue;
      const match = uploads.find((upload) => covers(upload, schedule.granularity, slot));
      rows.push({
        scheduleId: schedule.id,
        granularity: schedule.granularity,
        cutoffTime: schedule.cutoffTime,
        from: slot.from,
        to: slot.to,
        state: match ? "received" : slot.due ? "missing" : "waiting",
        uploadId: match?.id ?? null,
      });
    }
  }
  return { ok: true, data: rows };
}

export async function checkDueSchedules(now = new Date()): Promise<{ created: number }> {
  const schedules = await listEnabledUploadSchedules();
  const clock = jakartaParts(now);
  const uploads = await listUploadsOverlapping(shiftDate(clock.date, -70), clock.date);
  let created = 0;
  for (const schedule of schedules) {
    const slot = scheduleSlots(schedule, now).due;
    if (!slot?.due) continue;
    const dedupeKey = `MISSING_UPLOAD|${schedule.id}|${slot.from}|${slot.to}`;
    if (uploads.some((upload) => covers(upload, schedule.granularity, slot))) {
      const closed = await closeMissingAnomaly(dedupeKey);
      if (closed) {
        await audit({
          actorId: null,
          action: "monitoring.received",
          entity: "Anomaly",
          entityId: closed.id,
          diff: { scheduleId: schedule.id, from: slot.from, to: slot.to },
          ip: null,
        });
      }
      continue;
    }
    const label = GRANULARITY_LABEL[schedule.granularity];
    const row = await insertMissingAnomaly({
      dedupeKey,
      message: `Upload ${label} periode ${slot.from} s.d. ${slot.to} belum diterima setelah pukul ${schedule.cutoffTime}.`,
      severity: "HIGH",
    });
    if (!row) continue;
    created += 1;
    await audit({
      actorId: null,
      action: "monitoring.missing",
      entity: "Anomaly",
      entityId: row.id,
      diff: { scheduleId: schedule.id, from: slot.from, to: slot.to },
      ip: null,
    });
  }
  return { created };
}

/** Ringkasan anomali tidak dikirim. Lonceng hanya untuk koreksi dan lembur. */
export async function sendDailyDigest(now = new Date()): Promise<boolean> {
  void now;
  return false;
}
