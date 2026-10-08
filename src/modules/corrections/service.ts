import type { CorrectionStatus, Prisma, ReviewSeat } from "@prisma/client";
import { transaction } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import { visiblePage } from "@/modules/master/query";
import { conflict, denied, invalid, missing, type ServiceResult } from "@/modules/master/result";
import { can, heldDepartmentIds, reviewsDepartment, scopeFor, type AuthUser } from "@/modules/rbac/policy";
import { chainSteps, openingSeat, seatAfterApproval, type ChainStep } from "@/modules/review/chain";
import { guardSeat } from "@/modules/review/guard";
import { insertDecision } from "@/modules/review/repo";
import { isoDate } from "@/modules/uploads/dates";
import { applyCorrectionPatch, type CorrectionPatch } from "./derive";
import {
  findCorrection,
  findPendingCorrection,
  findRecordScope,
  insertCorrection,
  listCorrectableRecords,
  listCorrections,
} from "./repo";
import { correctionBodySchema, type CorrectionListQuery } from "./schema";

export type CorrectionDto = {
  id: string;
  recordId: string;
  employeeName: string | null;
  date: string | null;
  reason: string;
  status: CorrectionStatus;
  stage: ReviewSeat;
  departmentId: string | null;
  requestedById: string;
  createdAt: string;
  changes?: Prisma.JsonValue;
  reviewNote?: string | null;
  evidenceNote?: string | null;
  steps?: ChainStep[];
};

type ListRow = {
  id: string;
  recordId: string;
  reason: string;
  status: CorrectionStatus;
  stage: ReviewSeat;
  requestedById: string;
  createdAt: Date;
  record: { date: Date; employee: { name: string; departmentId: string | null } | null };
};

function toListDto(row: ListRow): CorrectionDto {
  return {
    id: row.id,
    recordId: row.recordId,
    employeeName: row.record.employee?.name ?? null,
    date: isoDate(row.record.date),
    reason: row.reason,
    status: row.status,
    stage: row.stage,
    departmentId: row.record.employee?.departmentId ?? null,
    requestedById: row.requestedById,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Role checks need a row. The form is shown when the actor could propose one inside their scope. */
export function canProposeCorrection(actor: AuthUser): boolean {
  if (actor.role === "MANAGER") {
    return actor.managedDepartmentIds.some((departmentId) => can(actor, "correction.create", { departmentId }));
  }
  if (actor.role === "EMPLOYEE") return can(actor, "correction.create", { employeeId: actor.employeeId });
  return can(actor, "correction.create");
}

function inScope(actor: AuthUser, employeeId: string, departmentId: string | null): boolean {
  if (!can(actor, "attendance.read")) return false;
  const scope = scopeFor(actor);
  if (scope.kind === "all") return true;
  if (reviewsDepartment(actor, departmentId)) return true;
  if (scope.kind === "self") return scope.employeeId === employeeId;
  return departmentId !== null && scope.departmentIds.includes(departmentId);
}

export async function listCorrectionPage(
  actor: AuthUser,
  query: CorrectionListQuery,
): Promise<
  ServiceResult<{
    items: CorrectionDto[];
    page: number;
    pageSize: number;
    total: number;
    records: Array<{ id: string; employeeName: string; date: string; clockInMin: number | null; clockOutMin: number | null }>;
  }>
> {
  if (!can(actor, "attendance.read")) return denied();
  const scope = scopeFor(actor);
  const departments = heldDepartmentIds(actor);
  const [{ total, rows }, records] = await Promise.all([
    listCorrections(scope, query, departments),
    canProposeCorrection(actor) ? listCorrectableRecords(scope) : Promise.resolve([]),
  ]);
  const page = visiblePage(query.page, query.pageSize, total);
  const items = page === query.page ? rows : (await listCorrections(scope, { ...query, page }, departments)).rows;
  return {
    ok: true as const,
    data: {
      items: items.map(toListDto),
      page,
      pageSize: query.pageSize,
      total,
      records: records.map((row) => ({
        id: row.id,
        employeeName: row.employee.name,
        date: isoDate(row.date),
        clockInMin: row.clockInMin,
        clockOutMin: row.clockOutMin,
      })),
    },
  };
}

export async function getCorrection(actor: AuthUser, id: string): Promise<ServiceResult<CorrectionDto>> {
  if (!can(actor, "attendance.read")) return denied();
  const row = await findCorrection(id);
  if (!row || !inScope(actor, row.record.employeeId, row.record.employee.departmentId)) {
    return missing("Koreksi tidak ditemukan.");
  }
  const changes = row.changes;
  const evidenceNote =
    changes && typeof changes === "object" && !Array.isArray(changes) && "evidenceNote" in changes
      ? String((changes as { evidenceNote?: unknown }).evidenceNote ?? "")
      : null;
  return {
    ok: true,
    data: {
      id: row.id,
      recordId: row.recordId,
      employeeName: row.record.employee.name,
      date: isoDate(row.record.date),
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      changes: row.changes,
      reviewNote: row.reviewNote,
      evidenceNote: evidenceNote || null,
      stage: row.stage,
      departmentId: row.record.employee.departmentId,
      requestedById: row.requestedById,
      steps: chainSteps({
        status: row.status,
        stage: row.stage,
        decisions: row.decisions.map((decision) => ({
          seat: decision.seat,
          outcome: decision.outcome,
          reviewerName: decision.reviewer.name,
          note: decision.note,
        })),
      }),
    },
  };
}

export async function createCorrection(actor: AuthUser, input: unknown, ip: string | null): Promise<ServiceResult<CorrectionDto>> {
  const body = correctionBodySchema.parse(input);
  const record = await findRecordScope(body.recordId);
  if (!record) return missing("Baris kehadiran tidak ditemukan.");
  if (!can(actor, "correction.create", { employeeId: record.employeeId, departmentId: record.employee.departmentId })) {
    return denied();
  }
  const pending = await findPendingCorrection(body.recordId);
  if (pending) return conflict("Masih ada koreksi yang menunggu untuk baris ini.");
  const changes: Prisma.InputJsonObject = {
    ...(body.clockInMin !== undefined ? { clockInMin: body.clockInMin } : {}),
    ...(body.clockOutMin !== undefined ? { clockOutMin: body.clockOutMin } : {}),
    ...(body.note !== undefined ? { note: body.note } : {}),
    ...(body.evidenceNote ? { evidenceNote: body.evidenceNote } : {}),
  };
  const created = await transaction(async (tx) => {
    const again = await findPendingCorrection(body.recordId, tx);
    if (again) return null;
    const seats = record.employee.departmentId
      ? await tx.departmentReviewer.findMany({ where: { departmentId: record.employee.departmentId }, select: { seat: true, userId: true } })
      : [];
    const row = await insertCorrection(tx, {
      recordId: body.recordId,
      requestedById: actor.id,
      changes,
      reason: body.reason,
      stage: openingSeat(actor.id, seats),
    });
    await audit(
      { actorId: actor.id, action: "correction.create", entity: "Correction", entityId: row.id, diff: { recordId: body.recordId, changes, reason: body.reason }, ip },
      tx,
    );
    return row;
  });
  if (!created) return conflict("Masih ada koreksi yang menunggu untuk baris ini.");
  const loaded = await getCorrection(actor, created.id);
  return loaded.ok ? loaded : missing("Koreksi tidak ditemukan.");
}

class AlreadyDecided extends Error {}

function patchFromChanges(changes: Prisma.JsonValue): CorrectionPatch | null {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;
  const value = changes as { clockInMin?: unknown; clockOutMin?: unknown; note?: unknown };
  const patch: CorrectionPatch = {};
  if ("clockInMin" in value) {
    if (value.clockInMin !== null && typeof value.clockInMin !== "number") return null;
    patch.clockInMin = value.clockInMin;
  }
  if ("clockOutMin" in value) {
    if (value.clockOutMin !== null && typeof value.clockOutMin !== "number") return null;
    patch.clockOutMin = value.clockOutMin;
  }
  if ("note" in value) {
    if (value.note !== null && typeof value.note !== "string") return null;
    patch.note = value.note;
  }
  if (patch.clockInMin === undefined && patch.clockOutMin === undefined && patch.note === undefined) return null;
  return patch;
}

export async function reviewCorrection(
  actor: AuthUser,
  id: string,
  outcome: "APPROVED" | "REJECTED",
  note: string,
  ip: string | null,
): Promise<ServiceResult<CorrectionDto>> {
  const existing = await findCorrection(id);
  if (!existing || !inScope(actor, existing.record.employeeId, existing.record.employee.departmentId)) {
    return missing("Koreksi tidak ditemukan.");
  }
  if (existing.status !== "PENDING") return conflict("Koreksi sudah diputuskan.");
  const guard = await guardSeat(actor, "correction.review", {
    departmentId: existing.record.employee.departmentId,
    stage: existing.stage,
    requesterId: existing.requestedById,
  });
  if (!guard.ok) return guard;
  const nextSeat = outcome === "APPROVED" ? seatAfterApproval(existing.stage, existing.requestedById, guard.data) : null;
  const finished = outcome === "REJECTED" || nextSeat === null;
  const patch = finished && outcome === "APPROVED" ? patchFromChanges(existing.changes) : null;
  if (finished && outcome === "APPROVED" && !patch) return invalid("Perubahan tersimpan tidak valid.");

  try {
    await transaction(async (tx) => {
      const claimed = await tx.correction.updateMany({
        where: { id, status: "PENDING", stage: existing.stage },
        data: {
          ...(finished ? { status: outcome } : { stage: nextSeat ?? existing.stage }),
          reviewedById: actor.id,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count !== 1) throw new AlreadyDecided();
      await insertDecision(tx, {
        seat: existing.stage,
        outcome,
        note,
        reviewerId: actor.id,
        correctionId: id,
      });
      if (finished && outcome === "APPROVED" && patch) {
        const before = {
          clockInMin: existing.record.clockInMin,
          clockOutMin: existing.record.clockOutMin,
          note: existing.record.note,
          earlyArrivalMin: existing.record.earlyArrivalMin,
          lateMin: existing.record.lateMin,
          earlyLeaveMin: existing.record.earlyLeaveMin,
          lateLeaveMin: existing.record.lateLeaveMin,
          actualMin: existing.record.actualMin,
          effectiveMin: existing.record.effectiveMin,
        };
        const next = applyCorrectionPatch(
          { ...before, scheduleInMin: existing.record.scheduleInMin, scheduleOutMin: existing.record.scheduleOutMin },
          patch,
        );
        const after = {
          clockInMin: next.clockInMin,
          clockOutMin: next.clockOutMin,
          note: next.note,
          earlyArrivalMin: next.earlyArrivalMin,
          lateMin: next.lateMin,
          earlyLeaveMin: next.earlyLeaveMin,
          lateLeaveMin: next.lateLeaveMin,
          actualMin: next.actualMin,
          effectiveMin: next.effectiveMin,
        };
        await tx.attendanceRecord.update({ where: { id: existing.recordId }, data: after });
        await tx.attendanceRevision.create({
          data: { recordId: existing.recordId, before, after, reason: existing.reason, correctionId: id },
        });
      }
      await audit(
        {
          actorId: actor.id,
          action: finished ? (outcome === "APPROVED" ? "correction.approve" : "correction.reject") : "correction.advance",
          entity: "Correction",
          entityId: id,
          diff: { seat: existing.stage, outcome, note },
          ip,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof AlreadyDecided) return conflict("Koreksi sudah diputuskan.");
    throw error;
  }
  return getCorrection(actor, id);
}
