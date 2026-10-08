import { createHash } from "node:crypto";
import { AnomalyType, Prisma, Severity, UploadStatus, type Granularity } from "@prisma/client";
import { prisma, UniqueConflict, transaction } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import { parseReport } from "@/modules/ingest/parser/parse";
import type { ParsedDay, ParsedReport } from "@/modules/ingest/parser/types";
import { sheetsFromWorkbook } from "@/modules/ingest/workbook";
import type { AnomalyCode, AttendanceIssue } from "@/modules/ingest/validator/issues";
import {
  fileMetadataSuspicious,
  granularityMismatch,
  validateReport,
  type FileMetadata,
  type Granularity as ChosenGranularity,
} from "@/modules/ingest/validator/rules";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { decideConflict, type PunchFields } from "./conflict";
import { dateOnly, isoDate } from "./dates";
import { inspectWorkbook } from "./inspect";
import { readWorkbookMeta } from "./metadata";
import {
  findAnomalyByKey,
  findAttendance,
  findDefaultSchedule,
  findEmployeesByPins,
  insertEmployeeFromReport,
  findUpload,
  findUploadByHash,
  findUploadByKey,
  deleteUploadData,
  insertAnomaly,
  insertAttendance,
  insertJob,
  insertRevision,
  insertUpload,
  listAnomalyRules,
  listUploads,
  markUpload,
  updateAttendance,
  uploadHasHistory,
} from "./repo";
import { safeDispatch } from "@/modules/notify/dispatch";
import { newStorageKey, readOriginal, removeOriginal, storeOriginal } from "./storage";

const DEFAULT_SEVERITY: Record<AnomalyCode, Severity> = {
  ROW_MISMATCH: Severity.HIGH,
  TOTAL_MISMATCH: Severity.HIGH,
  DAYS_MISMATCH: Severity.MEDIUM,
  DATA_CHANGED: Severity.CRITICAL,
  DUPLICATE_FILE: Severity.LOW,
  MISSING_UPLOAD: Severity.HIGH,
  MISSING_PUNCH: Severity.LOW,
  REPEATED_LATE: Severity.MEDIUM,
  NO_REASON: Severity.MEDIUM,
  FORMAT_UNKNOWN: Severity.HIGH,
  GRANULARITY_MISMATCH: Severity.LOW,
  FILE_METADATA_SUSPICIOUS: Severity.MEDIUM,
  UNKNOWN_EMPLOYEE: Severity.MEDIUM,
  UNKNOWN_NOTE: Severity.LOW,
};

export type UploadStats = {
  employees: number;
  inserted: number;
  unchanged: number;
  completed: number;
  conflicts: number;
  held: number;
  anomalies: number;
};

export type UploadDto = {
  id: string;
  originalName: string;
  granularity: Granularity;
  periodStart: string;
  periodEnd: string;
  status: UploadStatus;
  sizeBytes: number;
  sha256?: string;
  stats: UploadStats | null;
  createdAt: string;
  anomalies?: Array<{
    id: string;
    type: AnomalyType;
    severity: Severity;
    message: string;
    employeeId: string | null;
    employeeName: string | null;
    date: string | null;
    details: Prisma.JsonValue;
  }>;
};

export type IngestResult =
  | { ok: true; data: UploadDto }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409 | 500;
      error: string;
      code?: "DUPLICATE_FILE" | "GRANULARITY_MISMATCH";
      uploadId?: string;
      period?: { start: string; end: string };
    };

type Prepared = {
  report: ParsedReport | null;
  issues: AttendanceIssue[];
  meta: FileMetadata;
  status: UploadStatus;
};

export async function listUploadPage(actor: AuthUser, query: ListQuery): Promise<ServiceResult<{ items: UploadDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "upload.read")) return denied();
  const { total, rows, page } = await listUploads(query);
  return {
    ok: true,
    data: { items: rows.map((row) => toDto(row)), page, pageSize: query.pageSize, total },
  };
}

export async function getUpload(actor: AuthUser, id: string): Promise<ServiceResult<UploadDto>> {
  if (!can(actor, "upload.read")) return denied();
  const row = await findUpload(id);
  if (!row) return { ok: false, status: 404, error: "Upload tidak ditemukan." };
  return {
    ok: true,
    data: {
      ...toDto(row),
      anomalies: row.anomalies.map((anomaly) => ({
        id: anomaly.id,
        type: anomaly.type,
        severity: anomaly.severity,
        message: anomaly.message,
        employeeId: anomaly.employeeId,
        employeeName: anomaly.employee?.name ?? null,
        date: anomaly.date ? isoDate(anomaly.date) : null,
        details: anomaly.details,
      })),
    },
  };
}

export async function removeUpload(
  actor: AuthUser,
  id: string,
  ip: string | null,
): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "upload.delete")) return denied();
  const row = await findUpload(id);
  if (!row) return missing("Upload tidak ditemukan.");
  if (await uploadHasHistory(prisma, id)) return conflict("Berkas ini punya riwayat koreksi dan tidak dapat dihapus.");
  await transaction(async (tx) => {
    await deleteUploadData(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "upload.delete",
        entity: "Upload",
        entityId: id,
        diff: { originalName: row.originalName, sha256: row.sha256 },
        ip,
      },
      tx,
    );
  });
  await removeOriginal(row.storageKey);
  return { ok: true, data: { id } };
}

export async function openUploadFile(
  actor: AuthUser,
  id: string,
): Promise<ServiceResult<{ filename: string; bytes: Buffer }>> {
  if (!can(actor, "upload.download")) return denied();
  const row = await findUpload(id);
  if (!row) return { ok: false, status: 404, error: "Upload tidak ditemukan." };
  return { ok: true, data: { filename: row.originalName, bytes: await readOriginal(row.storageKey) } };
}

export async function ingestUpload(
  actor: AuthUser,
  input: { filename: string; mime: string; bytes: Uint8Array; granularity: Granularity; confirm: boolean },
  ip: string | null,
): Promise<IngestResult> {
  if (!can(actor, "upload.create")) return denied();
  const inspected = inspectWorkbook(input);
  if (!inspected.ok) return { ok: false, status: 400, error: inspected.error };
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const duplicate = await findUploadByHash(sha256);
  if (duplicate) {
    await rememberDuplicate(actor, duplicate.id, sha256, ip);
    return {
      ok: false,
      status: 409,
      code: "DUPLICATE_FILE",
      uploadId: duplicate.id,
      error: "Berkas yang sama sudah pernah diunggah.",
    };
  }

  let prepared: Prepared;
  try {
    prepared = prepare(input.bytes, input.granularity, input.confirm);
  } catch {
    return { ok: false, status: 400, error: "Berkas tidak dapat dibaca." };
  }
  if (prepared.status === "RECEIVED") {
    const period = prepared.report?.period;
    return {
      ok: false,
      status: 409,
      code: "GRANULARITY_MISMATCH",
      period,
      error: "Rentang periode pada berkas tidak sesuai jenis upload yang dipilih. Kirim ulang dengan konfirmasi untuk tetap menyimpan.",
    };
  }

  const storageKey = newStorageKey();
  const originalName = safeName(input.filename);
  try {
    await storeOriginal(storageKey, input.bytes);
    const saved = await transaction((tx) =>
      persistUpload(tx, {
        actor,
        ip,
        storageKey,
        sha256,
        originalName,
        sizeBytes: input.bytes.byteLength,
        granularity: input.granularity,
        prepared,
      }),
    );
    await safeDispatch(saved.id);
    return { ok: true, data: saved };
  } catch (error) {
    if (error instanceof UniqueConflict) {
      const winner = await findUploadByHash(sha256);
      return {
        ok: false,
        status: 409,
        code: "DUPLICATE_FILE",
        uploadId: winner?.id,
        error: error.message,
      };
    }
    await recoverRejected({
      actor,
      ip,
      storageKey,
      sha256,
      originalName,
      sizeBytes: input.bytes.byteLength,
      granularity: input.granularity,
      prepared,
      reason: "Penyimpanan absensi gagal dan dibatalkan.",
    });
    return { ok: false, status: 500, error: "Penyimpanan absensi gagal dan dibatalkan." };
  }
}

async function registerReportEmployees(
  tx: Prisma.TransactionClient,
  employees: Array<{ pin: string; name: string }>,
  actorId: string,
  ip: string | null,
) {
  const existing = await findEmployeesByPins(
    employees.map((employee) => employee.pin),
    tx,
  );
  const known = new Set(existing.map((employee) => employee.pin));
  const missing = employees.filter((employee) => !known.has(employee.pin));
  if (missing.length === 0) return;
  const schedule = await findDefaultSchedule(tx);
  if (!schedule) return;
  for (const employee of missing) {
    const created = await insertEmployeeFromReport(tx, { pin: employee.pin, name: employee.name, scheduleId: schedule.id });
    await audit(
      {
        actorId,
        action: "employee.create",
        entity: "Employee",
        entityId: created.id,
        diff: { pin: created.pin, name: created.name, source: "upload" },
        ip,
      },
      tx,
    );
  }
}

function prepare(bytes: Uint8Array, granularity: Granularity, confirm: boolean): Prepared {
  const meta = readWorkbookMeta(bytes);
  const parsed = parseReport(sheetsFromWorkbook(bytes).map((sheet) => sheet.cells));
  if (!parsed.ok) {
    return {
      report: null,
      meta,
      status: UploadStatus.REJECTED,
      issues: parsed.issues.map((issue) => ({
        type: "FORMAT_UNKNOWN" as const,
        severity: "HIGH" as const,
        message: issue.message,
      })),
    };
  }
  const mismatch = granularityMismatch(parsed.report.period, granularity as ChosenGranularity);
  if (mismatch && !confirm) {
    return { report: parsed.report, meta, status: UploadStatus.RECEIVED, issues: [mismatch] };
  }
  return { report: parsed.report, meta, status: UploadStatus.PARSED, issues: mismatch ? [mismatch] : [] };
}

async function persistUpload(
  tx: Prisma.TransactionClient,
  input: {
    actor: AuthUser;
    ip: string | null;
    storageKey: string;
    sha256: string;
    originalName: string;
    sizeBytes: number;
    granularity: Granularity;
    prepared: Prepared;
  },
): Promise<UploadDto> {
  const report = input.prepared.report;
  const period = report?.period ?? { start: "1970-01-01", end: "1970-01-01" };
  const upload = await insertUpload(tx, {
    originalName: input.originalName,
    storageKey: input.storageKey,
    sha256: input.sha256,
    sizeBytes: input.sizeBytes,
    granularity: input.granularity,
    periodStart: dateOnly(period.start),
    periodEnd: dateOnly(period.end),
    status: UploadStatus.RECEIVED,
    fileMeta: input.prepared.meta,
    stats: undefined,
    uploadedById: input.actor.id,
  });

  const issues = [...input.prepared.issues];
  const stats: UploadStats = { employees: 0, inserted: 0, unchanged: 0, completed: 0, conflicts: 0, held: 0, anomalies: 0 };
  if (report) {
    const metaIssue = fileMetadataSuspicious(input.prepared.meta);
    if (metaIssue) issues.push(metaIssue);
    await registerReportEmployees(tx, report.employees, input.actor.id, input.ip);
    const masters = await findEmployeesByPins(report.employees.map((employee) => employee.pin), tx);
    const byPin = new Map(masters.map((employee) => [employee.pin, employee]));
    const rules = await listAnomalyRules(tx);
    const threshold = rules.find((rule) => rule.type === AnomalyType.REPEATED_LATE)?.threshold ?? 3;
    stats.employees = report.employees.length;
    for (const employee of report.employees) {
      const master = byPin.get(employee.pin);
      issues.push(
        ...validateReport(
          { period: report.period, employees: [employee] },
          { lateToleranceMin: master?.schedule.lateToleranceMin ?? 0, repeatedLateThreshold: threshold, knownPins: new Set(byPin.keys()) },
        ).filter((issue) => issue.type !== "GRANULARITY_MISMATCH"),
      );
      if (!master) continue;
      for (const day of employee.days) {
        const incoming = punchFromDay(day);
        const current = await findAttendance(tx, master.id, dateOnly(day.date));
        const existing = current ? punchFromRecord(current) : null;
        const decision = decideConflict(existing, incoming);
        if (decision === "insert") {
          await insertAttendance(tx, { ...incoming, employeeId: master.id, date: dateOnly(day.date), sourceUploadId: upload.id });
          stats.inserted += 1;
        } else if (decision === "unchanged") {
          stats.unchanged += 1;
        } else if (decision === "complete" && current) {
          await insertRevision(tx, {
            recordId: current.id,
            before: existing as Prisma.InputJsonValue,
            after: incoming as Prisma.InputJsonValue,
            reason: "Melengkapi presensi keluar dari upload.",
            uploadId: upload.id,
          });
          await updateAttendance(tx, current.id, { ...incoming, sourceUploadId: upload.id });
          stats.completed += 1;
        } else if (decision === "conflict") {
          issues.push({
            type: "DATA_CHANGED",
            severity: "CRITICAL",
            message: "Data kehadiran yang sudah lengkap berubah.",
            pin: employee.pin,
            date: day.date,
            details: { before: existing, after: incoming },
          });
          stats.conflicts += 1;
        } else {
          stats.held += 1;
        }
      }
    }
  }

  const ruleMap = new Map((await listAnomalyRules(tx)).map((rule) => [rule.type, rule]));
  const masters = report ? await findEmployeesByPins(report.employees.map((employee) => employee.pin), tx) : [];
  const pinToId = new Map(masters.map((employee) => [employee.pin, employee.id]));
  for (const issue of issues) {
    const rule = ruleMap.get(issue.type as AnomalyType);
    if (rule && !rule.enabled) continue;
    const created = await insertAnomaly(tx, {
      type: issue.type as AnomalyType,
      severity: rule?.severity ?? DEFAULT_SEVERITY[issue.type],
      uploadId: upload.id,
      employeeId: issue.pin ? (pinToId.get(issue.pin) ?? null) : null,
      date: issue.date ? dateOnly(issue.date) : null,
      message: issue.message,
      details: (issue.details ?? {}) as Prisma.InputJsonValue,
      dedupeKey: dedupeKey(issue, upload.id),
    });
    if (created === "created") stats.anomalies += 1;
  }

  const status = input.prepared.status === UploadStatus.REJECTED
    ? UploadStatus.REJECTED
    : stats.anomalies > 0
      ? UploadStatus.PARSED_WITH_ANOMALIES
      : UploadStatus.PARSED;
  const saved = await markUpload(tx, upload.id, { status, stats });
  await insertJob(tx, upload.id);
  await audit(
    {
      actorId: input.actor.id,
      action: "upload.create",
      entity: "Upload",
      entityId: upload.id,
      diff: { status, stats, sha256: input.sha256 },
      ip: input.ip,
    },
    tx,
  );
  return toDto({ ...saved, stats });
}

async function rememberDuplicate(actor: AuthUser, uploadId: string, sha256: string, ip: string | null) {
  let notify = false;
  await transaction(async (tx) => {
    const rules = await listAnomalyRules(tx);
    const rule = rules.find((item) => item.type === AnomalyType.DUPLICATE_FILE);
    const dedupeKey = `DUPLICATE_FILE|${uploadId}|||${sha256.slice(0, 16)}`;
    const existing = await findAnomalyByKey(tx, dedupeKey);
    if (!existing && (!rule || rule.enabled)) {
      await insertAnomaly(tx, {
        type: AnomalyType.DUPLICATE_FILE,
        severity: rule?.severity ?? Severity.LOW,
        uploadId,
        employeeId: null,
        date: null,
        message: "Berkas yang sama sudah pernah diunggah.",
        details: { sha256 },
        dedupeKey,
      });
      await insertJob(tx, uploadId);
      notify = true;
    }
    await audit(
      { actorId: actor.id, action: "upload.duplicate", entity: "Upload", entityId: uploadId, diff: { sha256 }, ip },
      tx,
    );
  });
  if (notify) await safeDispatch(uploadId);
}

async function recoverRejected(input: {
  actor: AuthUser;
  ip: string | null;
  storageKey: string;
  sha256: string;
  originalName: string;
  sizeBytes: number;
  granularity: Granularity;
  prepared: Prepared;
  reason: string;
}) {
  const period = input.prepared.report?.period ?? { start: "1970-01-01", end: "1970-01-01" };
  const existing = await findUploadByKey(input.storageKey);
  if (existing) {
    await markUpload(prisma, existing.id, { status: UploadStatus.REJECTED, stats: { error: input.reason } });
    return;
  }
  try {
    const upload = await insertUpload(prisma, {
      originalName: input.originalName,
      storageKey: input.storageKey,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      granularity: input.granularity,
      periodStart: dateOnly(period.start),
      periodEnd: dateOnly(period.end),
      status: UploadStatus.REJECTED,
      fileMeta: input.prepared.meta,
      stats: { error: input.reason },
      uploadedById: input.actor.id,
    });
    await audit({
      actorId: input.actor.id,
      action: "upload.reject",
      entity: "Upload",
      entityId: upload.id,
      diff: { reason: input.reason },
      ip: input.ip,
    });
  } catch {
    // The original file stays on disk. A later retry with the same bytes is reported as a duplicate once a row exists.
  }
}

function punchFromDay(day: ParsedDay): PunchFields {
  return {
    isWorkday: day.isWorkday,
    scheduleInMin: day.scheduleIn,
    scheduleOutMin: day.scheduleOut,
    clockInMin: day.clockIn,
    clockOutMin: day.clockOut,
    earlyArrivalMin: day.earlyArrivalMin,
    lateMin: day.lateMin,
    earlyLeaveMin: day.earlyLeaveMin,
    lateLeaveMin: day.lateLeaveMin,
    actualLateMin: day.actualLateMin,
    effectiveMin: day.effectiveMin,
    actualMin: day.actualMin,
    locIn: day.locIn,
    locOut: day.locOut,
    note: day.note,
  };
}

function punchFromRecord(record: {
  isWorkday: boolean;
  scheduleInMin: number | null;
  scheduleOutMin: number | null;
  clockInMin: number | null;
  clockOutMin: number | null;
  earlyArrivalMin: number | null;
  lateMin: number | null;
  earlyLeaveMin: number | null;
  lateLeaveMin: number | null;
  actualLateMin: number | null;
  effectiveMin: number | null;
  actualMin: number | null;
  locIn: string | null;
  locOut: string | null;
  note: string | null;
}): PunchFields {
  return {
    isWorkday: record.isWorkday,
    scheduleInMin: record.scheduleInMin,
    scheduleOutMin: record.scheduleOutMin,
    clockInMin: record.clockInMin,
    clockOutMin: record.clockOutMin,
    earlyArrivalMin: record.earlyArrivalMin,
    lateMin: record.lateMin,
    earlyLeaveMin: record.earlyLeaveMin,
    lateLeaveMin: record.lateLeaveMin,
    actualLateMin: record.actualLateMin,
    effectiveMin: record.effectiveMin,
    actualMin: record.actualMin,
    locIn: record.locIn,
    locOut: record.locOut,
    note: record.note,
  };
}

function dedupeKey(issue: AttendanceIssue, uploadId: string): string {
  const detail = createHash("sha256").update(JSON.stringify(issue.details ?? null)).digest("hex").slice(0, 16);
  return [issue.type, uploadId, issue.pin ?? "", issue.date ?? "", detail].join("|");
}

function safeName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "laporan.xlsx";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").slice(0, 180);
  return cleaned === "" ? "laporan.xlsx" : cleaned;
}

function toDto(row: {
  id: string;
  originalName: string;
  granularity: Granularity;
  periodStart: Date;
  periodEnd: Date;
  status: UploadStatus;
  sizeBytes: number;
  sha256?: string;
  stats: Prisma.JsonValue;
  createdAt: Date;
}): UploadDto {
  return {
    id: row.id,
    originalName: row.originalName,
    granularity: row.granularity,
    periodStart: isoDate(row.periodStart),
    periodEnd: isoDate(row.periodEnd),
    status: row.status,
    sizeBytes: row.sizeBytes,
    ...(row.sha256 ? { sha256: row.sha256 } : {}),
    stats: isStats(row.stats) ? row.stats : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function isStats(value: Prisma.JsonValue): value is UploadStats {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "inserted" in value);
}
