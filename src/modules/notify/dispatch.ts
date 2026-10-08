import { findDispatchJob, listDueDispatchJobs, markJob } from "./repo";

/** Anomaly mail is no longer sent. Close a leftover job so the worker does not retry it. */
export async function dispatchUpload(uploadId: string): Promise<void> {
  const job = await findDispatchJob(uploadId);
  if (!job) return;
  await markJob(job.id, { status: "DONE", attempts: job.attempts, lastError: null });
}

export async function processDueDispatchJobs(now = new Date()): Promise<number> {
  const jobs = await listDueDispatchJobs(now);
  for (const job of jobs) {
    await markJob(job.id, { status: "DONE", attempts: job.attempts, lastError: null });
  }
  return jobs.length;
}
