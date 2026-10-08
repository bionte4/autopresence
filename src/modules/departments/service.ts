import { transaction, UniqueConflict } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import { REVIEW_CHAIN, type ReviewSeatName } from "@/modules/review/chain";
import {
  countActiveUsers,
  findActiveProject,
  findDepartment,
  insertDepartment,
  listDepartmentOptions,
  listDepartments,
  listReviewerOptions,
  replaceReviewers,
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
  reviewers: Record<ReviewSeatName, { userId: string; name: string } | null>;
};

function toDto(row: DepartmentRow): DepartmentDto {
  const reviewers = Object.fromEntries(REVIEW_CHAIN.map((seat) => [seat, null])) as DepartmentDto["reviewers"];
  for (const reviewer of row.reviewers) {
    reviewers[reviewer.seat] = { userId: reviewer.userId, name: reviewer.user.name };
  }
  return {
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    customerId: row.project?.customerId ?? null,
    customerName: row.project?.customer.name ?? null,
    reviewers,
  };
}

async function reviewersError(reviewers: Partial<Record<ReviewSeatName, string | null>> | undefined): Promise<ServiceResult<DepartmentDto> | null> {
  if (!reviewers) return null;
  const ids = REVIEW_CHAIN.flatMap((seat) => {
    const id = reviewers[seat];
    return id ? [id] : [];
  });
  if ((await countActiveUsers(ids)) !== new Set(ids).size) return missing("Salah satu peninjau tidak ditemukan.");
  return null;
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
  const peopleError = await reviewersError(body.reviewers);
  if (peopleError) return peopleError;
  try {
    const row = await transaction(async (tx) => {
      const created = await insertDepartment(tx, body);
      if (body.reviewers) await replaceReviewers(tx, created.id, body.reviewers);
      const stored = body.reviewers ? await findDepartment(created.id, tx) : created;
      if (!stored) throw new Error("Departemen tidak ditemukan setelah dibuat.");
      await audit(
        {
          actorId: actor.id,
          action: "department.create",
          entity: "Department",
          entityId: created.id,
          diff: { name: stored.name, projectId: stored.projectId, reviewers: body.reviewers ?? null },
          ip,
        },
        tx,
      );
      return stored;
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
  const peopleError = await reviewersError(body.reviewers);
  if (peopleError) return peopleError;
  try {
    const row = await transaction(async (tx) => {
      const updated = await updateDepartment(tx, id, body);
      if (body.reviewers) await replaceReviewers(tx, id, body.reviewers);
      const stored = body.reviewers ? await findDepartment(id, tx) : updated;
      if (!stored) throw new Error("Departemen tidak ditemukan setelah diubah.");
      await audit(
        {
          actorId: actor.id,
          action: "department.update",
          entity: "Department",
          entityId: id,
          diff: {
            before: { name: existing.name, projectId: existing.projectId, reviewers: existing.reviewers },
            after: { name: stored.name, projectId: stored.projectId, reviewers: stored.reviewers },
          },
          ip,
        },
        tx,
      );
      return stored;
    });
    return { ok: true, data: toDto(row) };
  } catch (error) {
    if (error instanceof UniqueConflict) return conflict(error.message);
    throw error;
  }
}

export async function reviewerChoices(actor: AuthUser): Promise<ServiceResult<Array<{ id: string; name: string; email: string }>>> {
  if (!can(actor, "department.manage")) return denied();
  return { ok: true, data: await listReviewerOptions() };
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
