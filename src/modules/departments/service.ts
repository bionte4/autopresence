import { transaction, UniqueConflict } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import {
  findActiveProject,
  findDepartment,
  insertDepartment,
  listDepartmentOptions,
  listDepartments,
  softDeleteDepartment,
  updateDepartment,
  type DepartmentRow,
} from "./repo";
import { departmentBodySchema } from "./schema";

export type DepartmentDto = {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  customerId: string | null;
  customerName: string | null;
};

function toDto(row: DepartmentRow): DepartmentDto {
  return {
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    customerId: row.project?.customerId ?? null,
    customerName: row.project?.customer.name ?? null,
  };
}

async function projectLinkError(projectId: string | null): Promise<ServiceResult<DepartmentDto> | null> {
  if (!projectId) return null;
  if (!(await findActiveProject(projectId))) return missing("Proyek tidak ditemukan.");
  return null;
}

export async function listDepartmentPage(
  actor: AuthUser,
  query: ListQuery,
): Promise<ServiceResult<{ items: DepartmentDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "department.manage")) return denied();
  const { total, rows, page } = await listDepartments(query);
  return { ok: true, data: { items: rows.map(toDto), page, pageSize: query.pageSize, total } };
}

export async function departmentChoices(
  actor: AuthUser,
): Promise<ServiceResult<Array<{ id: string; name: string }>>> {
  if (!can(actor, "department.manage") && !can(actor, "employee.manage") && !can(actor, "user.manage")) {
    return denied();
  }
  return { ok: true, data: await listDepartmentOptions() };
}

export async function getDepartment(actor: AuthUser, id: string): Promise<ServiceResult<DepartmentDto>> {
  if (!can(actor, "department.manage")) return denied();
  const row = await findDepartment(id);
  if (!row) return missing("Departemen tidak ditemukan.");
  return { ok: true, data: toDto(row) };
}

export async function createDepartment(
  actor: AuthUser,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<DepartmentDto>> {
  if (!can(actor, "department.manage")) return denied();
  const body = departmentBodySchema.parse(input);
  const linkError = await projectLinkError(body.projectId);
  if (linkError) return linkError;
  try {
    const row = await transaction(async (tx) => {
      const created = await insertDepartment(tx, body);
      await audit(
        {
          actorId: actor.id,
          action: "department.create",
          entity: "Department",
          entityId: created.id,
          diff: { name: created.name, projectId: created.projectId },
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

export async function editDepartment(
  actor: AuthUser,
  id: string,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<DepartmentDto>> {
  if (!can(actor, "department.manage")) return denied();
  const body = departmentBodySchema.parse(input);
  const existing = await findDepartment(id);
  if (!existing) return missing("Departemen tidak ditemukan.");
  const linkError = await projectLinkError(body.projectId);
  if (linkError) return linkError;
  try {
    const row = await transaction(async (tx) => {
      const updated = await updateDepartment(tx, id, body);
      await audit(
        {
          actorId: actor.id,
          action: "department.update",
          entity: "Department",
          entityId: id,
          diff: {
            before: { name: existing.name, projectId: existing.projectId },
            after: { name: updated.name, projectId: updated.projectId },
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

export async function removeDepartment(
  actor: AuthUser,
  id: string,
  ip: string | null,
): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "department.manage")) return denied();
  const existing = await findDepartment(id);
  if (!existing) return missing("Departemen tidak ditemukan.");
  await transaction(async (tx) => {
    await softDeleteDepartment(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "department.delete",
        entity: "Department",
        entityId: id,
        diff: { name: existing.name },
        ip,
      },
      tx,
    );
  });
  return { ok: true, data: { id } };
}
