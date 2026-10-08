import { audit } from "@/modules/audit/service";
import { denied, type ServiceResult } from "@/modules/master/result";
import { safeNotifyAnomaly } from "@/modules/notify/dispatch";
import { insertNotification } from "@/modules/notify/repo";
import { resolveMailer } from "@/modules/notify/mailer";
import { getEnv } from "@/lib/env";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { isoDate } from "@/modules/uploads/dates";
import { listEnabledUploadSchedules } from "@/modules/upload-schedules/repo";
import { closeMissingAnomaly, digestFacts, findDigestJob, insertDigestJob, insertMissingAnomaly, listUploadsOverlapping, markDigestEmail } from "./repo";
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
    await safeNotifyAnomaly(row.id);
  }
  return { created };
}

export async function sendDailyDigest(now = new Date()): Promise<boolean> {
  const clock = jakartaParts(now);
  if (clock.minutes < 7 * 60) return false;
  if (await findDigestJob(clock.date)) return false;
  const facts = await digestFacts(shiftDate(clock.date, -35), clock.date, 3);
  const names = facts.repeated.slice(0, 10).map((item) => `${item.name} (${item.late} kali)`);
  const body = [
    `Anomali terbuka: ${facts.openAnomalies}.`,
    `Upload terlambat: ${facts.missingUploads}.`,
    names.length > 0 ? `Terlambat berulang: ${names.join(", ")}.` : "Tidak ada pegawai dengan terlambat berulang.",
  ].join(" ");
  const title = `Ringkasan ${clock.date}`;
  for (const user of facts.hr) {
    await insertNotification({ userId: user.id, anomalyId: null, title, body, channel: "IN_APP", status: "SENT" });
    const email = await insertNotification({ userId: user.id, anomalyId: null, title, body, channel: "EMAIL", status: "PENDING" });
    if (email === "created") {
      try {
        await resolveMailer().send({ to: user.email, subject: title, text: `${body}\n\n${getEnv().APP_URL}/monitoring` });
        await markDigestEmail(user.id, title, "SENT");
      } catch {
        await markDigestEmail(user.id, title, "FAILED");
      }
    }
  }
  await insertDigestJob(clock.date);
  return true;
}
