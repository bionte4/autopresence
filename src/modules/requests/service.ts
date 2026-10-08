import type { RequestKind, RequestStatus, ReviewSeat } from "@prisma/client";
import { transaction, type Db } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import { visiblePage } from "@/modules/master/query";
import { conflict, denied, invalid, missing, type ServiceResult } from "@/modules/master/result";
import { can, heldDepartmentIds, reviewsDepartment, scopeFor, type AuthUser } from "@/modules/rbac/policy";
import { notifyRequester, notifySeatHolder } from "@/modules/notify/review";
import { chainSteps, openingSeat, seatAfterApproval, type ChainStep } from "@/modules/review/chain";
import { guardSeat } from "@/modules/review/guard";
import { insertDecision } from "@/modules/review/repo";
import { dateOnly, isoDate } from "@/modules/uploads/dates";
import {
  findOverlap,
  findRecordsInRange,
  findRequest,
  findRequestEmployee,
  listRequestEmployees,
  listRequests,
} from "./repo";
import { requestBodySchema, type RequestListQuery } from "./schema";
import { overtimeMinutes, requestNote } from "./span";

function noticeKind(kind: "LEAVE" | "SICK" | "OVERTIME"): "leave" | "sick" | "overtime" {
  if (kind === "LEAVE") return "leave";
  if (kind === "SICK") return "sick";
  return "overtime";
}

export type RequestDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  kind: RequestKind;
  startDate: string;
  endDate: string;
  endMin: number | null;
  overtimeMin: number | null;
  reason: string;
  status: RequestStatus;
  stage: ReviewSeat;
  departmentId: string | null;
  requestedById: string;
  reviewNote?: string | null;
  steps?: ChainStep[];
  createdAt: string;
};

class AlreadyDecided extends Error {}

function toDto(row: {
  id: string;
  employeeId?: string;
  kind: RequestKind;
  startDate: Date;
  endDate: Date;
  endMin: number | null;
  overtimeMin: number | null;
  reason: string;
  status: RequestStatus;
  stage: ReviewSeat;
  requestedById: string;
  reviewNote?: string | null;
  createdAt: Date;
  employee: { id: string; name: string; departmentId?: string | null };
}): RequestDto {
  return {
    id: row.id,
    employeeId: row.employeeId ?? row.employee.id,
    employeeName: row.employee.name,
    kind: row.kind,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    endMin: row.endMin,
    overtimeMin: row.overtimeMin,
    reason: row.reason,
    status: row.status,
    stage: row.stage,
    departmentId: row.employee.departmentId ?? null,
    requestedById: row.requestedById,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
  };
}

export function canProposeRequest(actor: AuthUser): boolean {
  if (actor.role === "MANAGER") {
    return actor.managedDepartmentIds.some((departmentId) => can(actor, "request.create", { departmentId }));
  }
  if (actor.role === "EMPLOYEE") return can(actor, "request.create", { employeeId: actor.employeeId });
  return can(actor, "request.create");
}

export function canReviewRequest(
  actor: AuthUser,
  input: { departmentId: string | null; stage: ReviewSeat; requesterId: string },
): boolean {
  return can(actor, "request.review", {
    departmentId: input.departmentId,
    reviewSeat: input.stage,
    ownerUserId: input.requesterId,
  });
}

export async function listRequestPage(actor: AuthUser, query: RequestListQuery): Promise<
  ServiceResult<{
    items: RequestDto[];
    page: number;
    pageSize: number;
    total: number;
    employees: Array<{ id: string; name: string; pin: string }>;
  }>
> {
  if (!can(actor, "attendance.read")) return denied();
  const scope = scopeFor(actor);
  const { total, rows } = await listRequests(scope, query, heldDepartmentIds(actor));
  const page = visiblePage(query.page, query.pageSize, total);
  const employees = canProposeRequest(actor) ? await listRequestEmployees(scope) : [];
  return {
    ok: true,
    data: {
      items: rows.map((row) => toDto({ ...row, reviewNote: null })),
      page,
      pageSize: query.pageSize,
      total,
      employees,
    },
  };
}

export async function getRequest(actor: AuthUser, id: string): Promise<ServiceResult<RequestDto>> {
  if (!can(actor, "attendance.read")) return denied();
  const row = await findRequest(id);
  if (!row || !visible(actor, row.employee.id, row.employee.departmentId)) return missing("Pengajuan tidak ditemukan.");
  return {
    ok: true,
    data: {
      ...toDto(row),
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

function visible(actor: AuthUser, employeeId: string, departmentId: string | null): boolean {
  const scope = scopeFor(actor);
  if (scope.kind === "all") return true;
  if (reviewsDepartment(actor, departmentId)) return true;
  if (scope.kind === "self") return scope.employeeId === employeeId;
  return departmentId !== null && scope.departmentIds.includes(departmentId);
}

export async function createRequest(actor: AuthUser, input: unknown, ip: string | null): Promise<ServiceResult<RequestDto>> {
  const body = requestBodySchema.parse(input);
  const employee = await findRequestEmployee(body.employeeId);
  if (!employee) return missing("Pegawai tidak ditemukan.");
  if (!can(actor, "request.create", { employeeId: employee.id, departmentId: employee.departmentId })) return denied();
  const minutes = body.kind === "OVERTIME" ? overtimeMinutes(employee.schedule.endMin, body.endMin ?? 0) : null;
  if (body.kind === "OVERTIME" && minutes === null) return invalid("Jam selesai lembur harus setelah jam pulang jadwal.");
  const start = dateOnly(body.startDate);
  const end = dateOnly(body.endDate);
  try {
    const created = await transaction(async (tx) => {
      if (await findOverlap(tx, employee.id, start, end)) throw new AlreadyDecided();
      const seats = employee.departmentId ? await tx.departmentReviewer.findMany({ where: { departmentId: employee.departmentId }, select: { seat: true, userId: true } }) : [];
      const row = await tx.attendanceRequest.create({
        data: {
          employeeId: employee.id,
          kind: body.kind,
          startDate: start,
          endDate: end,
          endMin: body.kind === "OVERTIME" ? body.endMin : null,
          overtimeMin: minutes,
          reason: body.reason,
          requestedById: actor.id,
          stage: openingSeat(actor.id, seats),
        },
        include: { employee: { select: { id: true, name: true, departmentId: true } } },
      });
      await audit(
        {
          actorId: actor.id,
          action: "request.create",
          entity: "AttendanceRequest",
          entityId: row.id,
          diff: { kind: body.kind, startDate: body.startDate, endDate: body.endDate },
          ip,
        },
        tx,
      );
      return { row, holderId: seats.find((seat) => seat.seat === row.stage)?.userId ?? null };
    });
    await notifySeatHolder({
      userId: created.holderId,
      requesterId: actor.id,
      seat: created.row.stage,
      kind: noticeKind(created.row.kind),
      subjectId: created.row.id,
      employeeName: employee.name,
      detail: body.reason,
    });
    return { ok: true, data: toDto(created.row) };
  } catch (error) {
    if (error instanceof AlreadyDecided) return conflict("Pengajuan yang sama masih menunggu.");
    throw error;
  }
}

export async function reviewRequest(
  actor: AuthUser,
  id: string,
  outcome: "APPROVED" | "REJECTED",
  note: string,
  ip: string | null,
): Promise<ServiceResult<RequestDto>> {
  const existing = await findRequest(id);
  if (!existing || !visible(actor, existing.employee.id, existing.employee.departmentId)) return missing("Pengajuan tidak ditemukan.");
  if (existing.status !== "PENDING") return conflict("Pengajuan sudah diputuskan.");
  const guard = await guardSeat(actor, "request.review", {
    departmentId: existing.employee.departmentId,
    stage: existing.stage,
    requesterId: existing.requestedById,
  });
  if (!guard.ok) return guard;
  const next = outcome === "APPROVED" ? seatAfterApproval(existing.stage, existing.requestedById, guard.data) : null;
  const finished = outcome === "REJECTED" || next === null;
  try {
    await transaction(async (tx) => {
      const claimed = await tx.attendanceRequest.updateMany({
        where: { id, status: "PENDING", stage: existing.stage },
        data: {
          ...(finished ? { status: outcome } : { stage: next ?? existing.stage }),
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
        requestId: id,
      });
      if (finished && outcome === "APPROVED" && (existing.kind === "LEAVE" || existing.kind === "SICK")) {
        await applyAbsenceNote(tx, existing.employee.id, existing.startDate, existing.endDate, requestNote(existing.kind), existing.reason);
      }
      await audit(
        {
          actorId: actor.id,
          action: finished ? (outcome === "APPROVED" ? "request.approve" : "request.reject") : "request.advance",
          entity: "AttendanceRequest",
          entityId: id,
          diff: { seat: existing.stage, outcome, note },
          ip,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof AlreadyDecided) return conflict("Pengajuan sudah diputuskan atau masih ada koreksi terbuka.");
    throw error;
  }
  const kind = noticeKind(existing.kind);
  if (!finished && next) {
    const holder = guard.data.find((seat) => seat.seat === next);
    await notifySeatHolder({
      userId: holder?.userId ?? null,
      requesterId: existing.requestedById,
      seat: next,
      kind,
      subjectId: id,
      employeeName: existing.employee.name,
      detail: existing.reason,
    });
  } else if (finished) {
    await notifyRequester({
      userId: existing.requestedById,
      actorId: actor.id,
      seat: existing.stage,
      kind,
      subjectId: id,
      employeeName: existing.employee.name,
      outcome,
    });
  }
  return getRequest(actor, id);
}

async function applyAbsenceNote(
  tx: Db,
  employeeId: string,
  start: Date,
  end: Date,
  note: string,
  reason: string,
) {
  const records = await findRecordsInRange(tx, employeeId, start, end);
  for (const record of records) {
    if (record.note === note) continue;
    const pending = await tx.correction.findFirst({ where: { recordId: record.id, status: "PENDING" }, select: { id: true } });
    if (pending) throw new AlreadyDecided();
    await tx.attendanceRevision.create({
      data: {
        recordId: record.id,
        before: { note: record.note },
        after: { note },
        reason,
      },
    });
    await tx.attendanceRecord.update({ where: { id: record.id }, data: { note } });
  }
}
