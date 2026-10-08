import { transaction, UniqueConflict } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, invalid, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import {
  countLinkedDepartments,
  customerIsActive,
  findProject,
  insertProject,
  listLinkableProjects,
  listProjects,
  softDeleteProject,
  updateProject,
  type ProjectRow,
} from "./repo";
import { projectBodySchema } from "./schema";

export type ProjectDto = { id: string; name: string; customerId: string; customerName: string };

function toDto(row: ProjectRow): ProjectDto {
  return { id: row.id, name: row.name, customerId: row.customerId, customerName: row.customer.name };
}

async function referencesExist(customerId: string): Promise<ServiceResult<ProjectDto> | null> {
  if (!(await customerIsActive(customerId))) return invalid("Pelanggan tidak ditemukan.");
  return null;
}

export async function listProjectPage(
  actor: AuthUser,
  query: ListQuery,
): Promise<ServiceResult<{ items: ProjectDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "department.manage")) return denied();
  const { total, rows, page } = await listProjects(query);
  return { ok: true, data: { items: rows.map(toDto), page, pageSize: query.pageSize, total } };
}

export async function linkableProjectChoices(
  actor: AuthUser,
  currentProjectId: string | null,
): Promise<ServiceResult<ProjectDto[]>> {
  if (!can(actor, "department.manage")) return denied();
  const rows = await listLinkableProjects(currentProjectId);
  return { ok: true, data: rows.map(toDto) };
}

export async function getProject(actor: AuthUser, id: string): Promise<ServiceResult<ProjectDto>> {
  if (!can(actor, "department.manage")) return denied();
  const row = await findProject(id);
  if (!row) return missing("Proyek tidak ditemukan.");
  return { ok: true, data: toDto(row) };
}

export async function createProject(
  actor: AuthUser,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<ProjectDto>> {
  if (!can(actor, "department.manage")) return denied();
  const body = projectBodySchema.parse(input);
  const invalidRef = await referencesExist(body.customerId);
  if (invalidRef) return invalidRef;
  try {
    const row = await transaction(async (tx) => {
      const created = await insertProject(tx, body);
      await audit(
        {
          actorId: actor.id,
          action: "project.create",
          entity: "Project",
          entityId: created.id,
          diff: { name: created.name, customerId: created.customerId },
          ip,
        },
        tx,
      );
      return created;
    });
    return { ok: true, data: toDto(row) };
  } catch (error) {
    if (error instanceof UniqueConflict) return conflict(error.message);
    throw error;
  }
}

export async function editProject(
  actor: AuthUser,
  id: string,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<ProjectDto>> {
  if (!can(actor, "department.manage")) return denied();
  const body = projectBodySchema.parse(input);
  const existing = await findProject(id);
  if (!existing) return missing("Proyek tidak ditemukan.");
  const invalidRef = await referencesExist(body.customerId);
  if (invalidRef) return invalidRef;
  try {
    const row = await transaction(async (tx) => {
      const updated = await updateProject(tx, id, body);
      await audit(
        {
          actorId: actor.id,
          action: "project.update",
          entity: "Project",
          entityId: id,
          diff: {
            before: { name: existing.name, customerId: existing.customerId },
            after: { name: updated.name, customerId: updated.customerId },
          },
          ip,
        },
        tx,
      );
      return updated;
    });
    return { ok: true, data: toDto(row) };
  } catch (error) {
    if (error instanceof UniqueConflict) return conflict(error.message);
    throw error;
  }
}

export async function removeProject(
  actor: AuthUser,
  id: string,
  ip: string | null,
): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "department.manage")) return denied();
  const existing = await findProject(id);
  if (!existing) return missing("Proyek tidak ditemukan.");
  if ((await countLinkedDepartments(id)) > 0) return conflict("Proyek masih ditautkan ke departemen.");
  await transaction(async (tx) => {
    await softDeleteProject(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "project.delete",
        entity: "Project",
        entityId: id,
        diff: { name: existing.name, customerId: existing.customerId },
        ip,
      },
      tx,
    );
  });
  return { ok: true, data: { id } };
}
