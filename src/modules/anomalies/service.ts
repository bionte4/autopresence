import type { AnomalyStatus, AnomalyType, Prisma, Severity } from "@prisma/client";
import { audit } from "@/modules/audit/service";
import { visiblePage } from "@/modules/master/query";
import { conflict, denied, invalid, missing, type ServiceResult } from "@/modules/master/result";
import { can, scopeFor, type AuthUser } from "@/modules/rbac/policy";
import { isoDate } from "@/modules/uploads/dates";
import { findAnomaly, listAnomalies, listEmployeeOptions, markAnomaly } from "./repo";
import type { AnomalyListQuery } from "./schema";

export type AnomalyDto = {
  id: string;
  type: AnomalyType;
  severity: Severity;
  status: AnomalyStatus;
  message: string;
  date: string | null;
  employeeId: string | null;
  employeeName: string | null;
  departmentId: string | null;
  uploadId: string | null;
  createdAt: string;
  details?: Prisma.JsonValue;
  resolvedNote?: string | null;
};

type AnomalyRow = {
  id: string;
  type: AnomalyType;
  severity: Severity;
  status: AnomalyStatus;
  message: string;
  date: Date | null;
  employeeId: string | null;
  uploadId: string | null;
  createdAt: Date;
  details?: Prisma.JsonValue;
  resolvedNote?: string | null;
  employee: { name: string; departmentId: string | null; pin?: string } | null;
};

function toDto(row: AnomalyRow, withDetails: boolean): AnomalyDto {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    message: row.message,
    date: row.date ? isoDate(row.date) : null,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    departmentId: row.employee?.departmentId ?? null,
    uploadId: row.uploadId,
    createdAt: row.createdAt.toISOString(),
    ...(withDetails ? { details: row.details ?? null, resolvedNote: row.resolvedNote ?? null } : {}),
  };
}

function inScope(actor: AuthUser, departmentId: string | null): boolean {
  if (!can(actor, "anomaly.read")) return false;
  const scope = scopeFor(actor);
  if (scope.kind === "all") return true;
  if (scope.kind !== "departments" || !departmentId) return false;
  return scope.departmentIds.includes(departmentId);
}

export async function listAnomalyPage(actor: AuthUser, query: AnomalyListQuery): Promise<ServiceResult<{ items: AnomalyDto[]; page: number; pageSize: number; total: number; employees: Array<{ id: string; name: string }> }>> {
  if (!can(actor, "anomaly.read")) return denied();
  const scope = scopeFor(actor);
  const [{ total, rows }, employees] = await Promise.all([listAnomalies(scope, query), listEmployeeOptions(scope)]);
  const page = visiblePage(query.page, query.pageSize, total);
  const items = page === query.page ? rows : (await listAnomalies(scope, { ...query, page })).rows;
  return { ok: true, data: { items: items.map((row) => toDto(row, false)), page, pageSize: query.pageSize, total, employees } };
}

export async function getAnomaly(actor: AuthUser, id: string): Promise<ServiceResult<AnomalyDto>> {
  if (!can(actor, "anomaly.read")) return denied();
  const row = await findAnomaly(id);
  if (!row || !inScope(actor, row.employee?.departmentId ?? null)) return missing("Anomali tidak ditemukan.");
  return { ok: true, data: toDto(row, true) };
}

async function loadForDecision(actor: AuthUser, id: string): Promise<{ ok: true; row: NonNullable<Awaited<ReturnType<typeof findAnomaly>>> } | { ok: false; error: ServiceResult<AnomalyDto> }> {
  const row = await findAnomaly(id);
  if (!row || !inScope(actor, row.employee?.departmentId ?? null)) return { ok: false, error: missing("Anomali tidak ditemukan.") };
  if (!can(actor, "anomaly.resolve", { departmentId: row.employee?.departmentId, severity: row.severity })) {
    return { ok: false, error: denied() };
  }
  return { ok: true, row };
}

export async function acknowledgeAnomaly(actor: AuthUser, id: string, ip: string | null): Promise<ServiceResult<AnomalyDto>> {
  const loaded = await loadForDecision(actor, id);
  if (!loaded.ok) return loaded.error;
  if (loaded.row.status !== "OPEN") return conflict("Anomali tidak bisa diakui dari status ini.");
  const updated = await markAnomaly(id, { status: "ACKNOWLEDGED" });
  await audit({
    actorId: actor.id,
    action: "anomaly.acknowledge",
    entity: "Anomaly",
    entityId: id,
    diff: { from: "OPEN", to: "ACKNOWLEDGED" },
    ip,
  });
  return { ok: true, data: toDto(updated, true) };
}

export async function resolveAnomaly(
  actor: AuthUser,
  id: string,
  input: { outcome: "RESOLVED" | "FALSE_POSITIVE"; note: string },
  ip: string | null,
): Promise<ServiceResult<AnomalyDto>> {
  const note = input.note.trim();
  if (note.length < 3) return invalid("Catatan penyelesaian wajib diisi.");
  const loaded = await loadForDecision(actor, id);
  if (!loaded.ok) return loaded.error;
  if (loaded.row.status !== "OPEN" && loaded.row.status !== "ACKNOWLEDGED") {
    return conflict("Anomali sudah ditutup.");
  }
  const updated = await markAnomaly(id, {
    status: input.outcome,
    resolvedById: actor.id,
    resolvedNote: note,
    resolvedAt: new Date(),
  });
  await audit({
    actorId: actor.id,
    action: "anomaly.resolve",
    entity: "Anomaly",
    entityId: id,
    diff: { from: loaded.row.status, to: input.outcome, note },
    ip,
  });
  return { ok: true, data: toDto(updated, true) };
}
