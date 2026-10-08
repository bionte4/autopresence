import { transaction } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import {
  countScheduleEmployees,
  deleteSchedule,
  findSchedule,
  insertSchedule,
  listScheduleOptions,
  listSchedules,
  updateSchedule,
} from "./repo";
import { scheduleBodySchema } from "./schema";

export type ScheduleDto = {
  id: string;
  name: string;
  startMin: number;
  endMin: number;
  lateToleranceMin: number;
};

function toDto(row: ScheduleDto): ScheduleDto {
  return {
    id: row.id,
    name: row.name,
    startMin: row.startMin,
    endMin: row.endMin,
    lateToleranceMin: row.lateToleranceMin,
  };
}

export async function listSchedulePage(
  actor: AuthUser,
  query: ListQuery,
): Promise<ServiceResult<{ items: ScheduleDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "schedule.manage")) return denied();
  const { total, rows, page } = await listSchedules(query);
  return { ok: true, data: { items: rows.map(toDto), page, pageSize: query.pageSize, total } };
}

export async function scheduleChoices(
  actor: AuthUser,
): Promise<ServiceResult<Array<{ id: string; name: string; startMin: number; endMin: number }>>> {
  if (!can(actor, "schedule.manage") && !can(actor, "employee.manage")) return denied();
  return { ok: true, data: await listScheduleOptions() };
}

export async function getSchedule(actor: AuthUser, id: string): Promise<ServiceResult<ScheduleDto>> {
  if (!can(actor, "schedule.manage")) return denied();
  const row = await findSchedule(id);
  if (!row) return missing("Jadwal tidak ditemukan.");
  return { ok: true, data: toDto(row) };
}

export async function createSchedule(
  actor: AuthUser,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<ScheduleDto>> {
  if (!can(actor, "schedule.manage")) return denied();
  const body = scheduleBodySchema.parse(input);
  const row = await transaction(async (tx) => {
    const created = await insertSchedule(tx, {
      name: body.name,
      startMin: body.start,
      endMin: body.end,
      lateToleranceMin: body.lateToleranceMin,
    });
    await audit(
      {
        actorId: actor.id,
        action: "schedule.create",
        entity: "WorkSchedule",
        entityId: created.id,
        diff: toDto(created),
        ip,
      },
      tx,
    );
    return created;
  });
  return { ok: true, data: toDto(row) };
}

export async function editSchedule(
  actor: AuthUser,
  id: string,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<ScheduleDto>> {
  if (!can(actor, "schedule.manage")) return denied();
  const body = scheduleBodySchema.parse(input);
  const existing = await findSchedule(id);
  if (!existing) return missing("Jadwal tidak ditemukan.");
  const row = await transaction(async (tx) => {
    const updated = await updateSchedule(tx, id, {
      name: body.name,
      startMin: body.start,
      endMin: body.end,
      lateToleranceMin: body.lateToleranceMin,
    });
    await audit(
      {
        actorId: actor.id,
        action: "schedule.update",
        entity: "WorkSchedule",
        entityId: id,
        diff: { before: toDto(existing), after: toDto(updated) },
        ip,
      },
      tx,
    );
    return updated;
  });
  return { ok: true, data: toDto(row) };
}

export async function removeSchedule(
  actor: AuthUser,
  id: string,
  ip: string | null,
): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "schedule.manage")) return denied();
  const existing = await findSchedule(id);
  if (!existing) return missing("Jadwal tidak ditemukan.");
  if ((await countScheduleEmployees(id)) > 0) {
    return conflict("Jadwal masih terhubung ke data pegawai.");
  }
  await transaction(async (tx) => {
    await deleteSchedule(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "schedule.delete",
        entity: "WorkSchedule",
        entityId: id,
        diff: { name: existing.name },
        ip,
      },
      tx,
    );
  });
  return { ok: true, data: { id } };
}
