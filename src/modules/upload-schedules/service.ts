import { transaction } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { denied, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { deleteUploadSchedule, findUploadSchedule, insertUploadSchedule, listUploadSchedules, updateUploadSchedule } from "./repo";
import { uploadScheduleBodySchema, type UploadScheduleBody } from "./schema";

export type UploadScheduleDto = {
  id: string;
  granularity: "DAILY" | "WEEKLY" | "MONTHLY";
  cutoffTime: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  enabled: boolean;
};

function toDto(row: UploadScheduleDto): UploadScheduleDto {
  return { ...row };
}

export async function listUploadSchedulePage(
  actor: AuthUser,
  query: ListQuery,
): Promise<ServiceResult<{ items: UploadScheduleDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "uploadSchedule.manage") && !can(actor, "upload.read")) return denied();
  const { total, rows, page } = await listUploadSchedules(query);
  return { ok: true, data: { items: rows.map(toDto), page, pageSize: query.pageSize, total } };
}

export async function getUploadSchedule(actor: AuthUser, id: string): Promise<ServiceResult<UploadScheduleDto>> {
  if (!can(actor, "uploadSchedule.manage") && !can(actor, "upload.read")) return denied();
  const row = await findUploadSchedule(id);
  if (!row) return missing("Jadwal upload tidak ditemukan.");
  return { ok: true, data: toDto(row) };
}

export async function createUploadSchedule(actor: AuthUser, input: unknown, ip: string | null): Promise<ServiceResult<UploadScheduleDto>> {
  if (!can(actor, "uploadSchedule.manage")) return denied();
  const body = uploadScheduleBodySchema.parse(input);
  const row = await transaction(async (tx) => {
    const created = await insertUploadSchedule(tx, body);
    await audit({ actorId: actor.id, action: "uploadSchedule.create", entity: "UploadSchedule", entityId: created.id, diff: created, ip }, tx);
    return created;
  });
  return { ok: true, data: toDto(row) };
}

export async function editUploadSchedule(
  actor: AuthUser,
  id: string,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<UploadScheduleDto>> {
  if (!can(actor, "uploadSchedule.manage")) return denied();
  const existing = await findUploadSchedule(id);
  if (!existing) return missing("Jadwal upload tidak ditemukan.");
  const body: UploadScheduleBody = uploadScheduleBodySchema.parse(input);
  const row = await transaction(async (tx) => {
    const updated = await updateUploadSchedule(tx, id, body);
    await audit({ actorId: actor.id, action: "uploadSchedule.update", entity: "UploadSchedule", entityId: id, diff: { before: existing, after: updated }, ip }, tx);
    return updated;
  });
  return { ok: true, data: toDto(row) };
}

export async function removeUploadSchedule(actor: AuthUser, id: string, ip: string | null): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "uploadSchedule.manage")) return denied();
  const existing = await findUploadSchedule(id);
  if (!existing) return missing("Jadwal upload tidak ditemukan.");
  await transaction(async (tx) => {
    await deleteUploadSchedule(tx, id);
    await audit({ actorId: actor.id, action: "uploadSchedule.delete", entity: "UploadSchedule", entityId: id, diff: existing, ip }, tx);
  });
  return { ok: true, data: { id } };
}
