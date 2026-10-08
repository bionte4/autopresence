import { getEnv } from "@/lib/env";
import { resolveMailer, type Mailer } from "./mailer";
import {
  findAnomalyForNotify,
  findDispatchJob,
  insertNotification,
  listAnomalyRules,
  listChannelNotifications,
  listDispatchAnomalies,
  listDueDispatchJobs,
  listNotifyUsers,
  listPendingEmails,
  markJob,
  markNotification,
} from "./repo";
import { channelsFor, recipientsFor } from "./recipients";

const MAX_ATTEMPTS = 5;

function backoff(attempts: number): Date {
  return new Date(Date.now() + 60_000 * 2 ** Math.max(0, attempts - 1));
}

async function ensureNotifications(uploadId: string): Promise<void> {
  const [anomalies, rules, users] = await Promise.all([listDispatchAnomalies(uploadId), listAnomalyRules(), listNotifyUsers()]);
  const ruleByType = new Map(rules.map((rule) => [rule.type, rule]));
  const notifyUsers = users.map((user) => ({
    id: user.id,
    role: user.role,
    email: user.email,
    managedDepartmentIds: user.managedDepartments.map((department) => department.id),
  }));
  for (const anomaly of anomalies) {
    const rule = ruleByType.get(anomaly.type);
    if (!rule) continue;
    const channels = channelsFor(rule);
    const recipients = recipientsFor(rule, notifyUsers, anomaly.employee?.departmentId ?? null);
    for (const recipient of recipients) {
      for (const channel of channels) {
        await insertNotification({
          userId: recipient.id,
          anomalyId: anomaly.id,
          title: `Anomali ${anomaly.severity}`,
          body: anomaly.message,
          channel,
          status: channel === "IN_APP" ? "SENT" : "PENDING",
        });
      }
    }
  }
}

async function sendEmails(uploadId: string, sender: Mailer, statuses: string[]): Promise<{ attempted: number; failed: boolean }> {
  const pending = await listChannelNotifications(uploadId, "EMAIL", statuses);
  if (pending.length === 0) return { attempted: 0, failed: false };
  let failed = false;
  const appUrl = getEnv().APP_URL;
  for (const notice of pending) {
    try {
      await sender.send({
        to: notice.user.email,
        subject: notice.title,
        text: `${notice.body}\n\n${appUrl}/anomalies/${notice.anomalyId ?? ""}`,
      });
      await markNotification(notice.id, { status: "SENT", attempts: notice.attempts + 1 });
    } catch {
      failed = true;
      await markNotification(notice.id, { status: "FAILED", attempts: notice.attempts + 1 });
    }
  }
  return { attempted: pending.length, failed };
}

export async function dispatchUpload(uploadId: string, sender?: Mailer, options?: { retry?: boolean }): Promise<void> {
  await ensureNotifications(uploadId);
  const outcome = await sendEmails(uploadId, resolveMailer(sender), options?.retry ? ["PENDING", "FAILED"] : ["PENDING"]);
  const job = await findDispatchJob(uploadId);
  if (!job) return;
  const stillOpen = await listChannelNotifications(uploadId, "EMAIL", ["PENDING", "FAILED"]);
  if (stillOpen.length === 0) {
    await markJob(job.id, { status: "DONE", attempts: job.attempts, lastError: null });
    return;
  }
  if (outcome.attempted === 0) return;
  const attempts = job.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await markJob(job.id, { status: "FAILED", attempts, lastError: "Email gagal setelah beberapa percobaan." });
    return;
  }
  await markJob(job.id, { status: "PENDING", attempts, runAt: backoff(attempts), lastError: "Email gagal dikirim." });
}

export async function notifyAnomaly(anomalyId: string, sender?: Mailer): Promise<void> {
  const anomaly = await findAnomalyForNotify(anomalyId);
  if (!anomaly) return;
  const [rules, users] = await Promise.all([listAnomalyRules(), listNotifyUsers()]);
  const rule = rules.find((item) => item.type === anomaly.type);
  if (!rule) return;
  const notifyUsers = users.map((user) => ({
    id: user.id,
    role: user.role,
    email: user.email,
    managedDepartmentIds: user.managedDepartments.map((department) => department.id),
  }));
  for (const recipient of recipientsFor(rule, notifyUsers, anomaly.employee?.departmentId ?? null)) {
    for (const channel of channelsFor(rule)) {
      await insertNotification({
        userId: recipient.id,
        anomalyId: anomaly.id,
        title: `Anomali ${anomaly.severity}`,
        body: anomaly.message,
        channel,
        status: channel === "IN_APP" ? "SENT" : "PENDING",
      });
    }
  }
  const pending = await listPendingEmails(anomalyId);
  const mailer = resolveMailer(sender);
  const appUrl = getEnv().APP_URL;
  for (const notice of pending) {
    try {
      await mailer.send({ to: notice.user.email, subject: notice.title, text: `${notice.body}\n\n${appUrl}/anomalies/${anomalyId}` });
      await markNotification(notice.id, { status: "SENT", attempts: notice.attempts + 1 });
    } catch {
      await markNotification(notice.id, { status: "FAILED", attempts: notice.attempts + 1 });
    }
  }
}

export async function safeNotifyAnomaly(anomalyId: string): Promise<void> {
  try {
    await notifyAnomaly(anomalyId);
  } catch {
    // The missing-upload row is already stored. A mail failure must not undo it.
  }
}

export async function safeDispatch(uploadId: string): Promise<void> {
  try {
    await dispatchUpload(uploadId);
  } catch {
    // A notifier bug must not roll back an upload that is already committed.
  }
}

export async function processDueDispatchJobs(now = new Date()): Promise<number> {
  const jobs = await listDueDispatchJobs(now);
  for (const job of jobs) {
    try {
      await dispatchUpload(job.uploadId, undefined, { retry: true });
    } catch {
      await markJob(job.id, { status: "PENDING", attempts: job.attempts + 1, runAt: backoff(job.attempts + 1), lastError: "Pengiriman gagal." });
    }
  }
  return jobs.length;
}
