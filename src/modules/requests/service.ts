import type { RequestKind, RequestStatus } from "@prisma/client";
import { transaction, type Db } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import { visiblePage } from "@/modules/master/query";
import { conflict, denied, invalid, missing, type ServiceResult } from "@/modules/master/result";
import { can, scopeFor, type AuthUser } from "@/modules/rbac/policy";
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
  reviewNote?: string | null;
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
  reviewNote?: string | null;
  createdAt: Date;
  employee: { id: string; name: string };
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

export function canReviewRequest(actor: AuthUser, employeeId: string, departmentId: string | null): boolean {
  return can(actor, "request.review", { employeeId, departmentId });
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
  const { total, rows } = await listRequests(scope, query);
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
  return { ok: true, data: toDto(row) };
}

function visible(actor: AuthUser, employeeId: string, departmentId: string | null): boolean {
  const scope = scopeFor(actor);
  if (scope.kind === "all") return true;
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
        },
        include: { employee: { select: { id: true, name: true } } },
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
      return row;
    });
    return { ok: true, data: toDto(created) };
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
  if (!canReviewRequest(actor, existing.employee.id, existing.employee.departmentId)) return denied();
  if (existing.status !== "PENDING") return conflict("Pengajuan sudah diputuskan.");
  try {
    await transaction(async (tx) => {
      const claimed = await tx.attendanceRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: outcome, reviewedById: actor.id, reviewNote: note, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) throw new AlreadyDecided();
      if (outcome === "APPROVED" && (existing.kind === "LEAVE" || existing.kind === "SICK")) {
        await applyAbsenceNote(tx, existing.employee.id, existing.startDate, existing.endDate, requestNote(existing.kind), existing.reason);
      }
      await audit(
        {
          actorId: actor.id,
          action: outcome === "APPROVED" ? "request.approve" : "request.reject",
          entity: "AttendanceRequest",
          entityId: id,
          diff: { outcome, note },
          ip,
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof AlreadyDecided) return conflict("Pengajuan sudah diputuskan atau masih ada koreksi terbuka.");
    throw error;
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
