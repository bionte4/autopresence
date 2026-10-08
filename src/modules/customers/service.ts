import { transaction, UniqueConflict } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import {
  countActiveProjects,
  findCustomer,
  insertCustomer,
  listCustomerOptions,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
} from "./repo";
import { customerBodySchema } from "./schema";

export type CustomerDto = { id: string; name: string };

function toDto(row: { id: string; name: string }): CustomerDto {
  return { id: row.id, name: row.name };
}

export async function listCustomerPage(
  actor: AuthUser,
  query: ListQuery,
): Promise<ServiceResult<{ items: CustomerDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "department.manage")) return denied();
  const { total, rows, page } = await listCustomers(query);
  return { ok: true, data: { items: rows.map(toDto), page, pageSize: query.pageSize, total } };
}

export async function customerChoices(actor: AuthUser): Promise<ServiceResult<CustomerDto[]>> {
  if (!can(actor, "department.manage")) return denied();
  return { ok: true, data: await listCustomerOptions() };
}

export async function getCustomer(actor: AuthUser, id: string): Promise<ServiceResult<CustomerDto>> {
  if (!can(actor, "department.manage")) return denied();
  const row = await findCustomer(id);
  if (!row) return missing("Pelanggan tidak ditemukan.");
  return { ok: true, data: toDto(row) };
}

export async function createCustomer(
  actor: AuthUser,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<CustomerDto>> {
  if (!can(actor, "department.manage")) return denied();
  const body = customerBodySchema.parse(input);
  try {
    const row = await transaction(async (tx) => {
      const created = await insertCustomer(tx, body.name);
      await audit(
        {
          actorId: actor.id,
          action: "customer.create",
          entity: "Customer",
          entityId: created.id,
          diff: { name: created.name },
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

export async function editCustomer(
  actor: AuthUser,
  id: string,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<CustomerDto>> {
  if (!can(actor, "department.manage")) return denied();
  const body = customerBodySchema.parse(input);
  const existing = await findCustomer(id);
  if (!existing) return missing("Pelanggan tidak ditemukan.");
  try {
    const row = await transaction(async (tx) => {
      const updated = await updateCustomer(tx, id, body.name);
      await audit(
        {
          actorId: actor.id,
          action: "customer.update",
          entity: "Customer",
          entityId: id,
          diff: { before: { name: existing.name }, after: { name: updated.name } },
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

export async function removeCustomer(
  actor: AuthUser,
  id: string,
  ip: string | null,
): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "department.manage")) return denied();
  const existing = await findCustomer(id);
  if (!existing) return missing("Pelanggan tidak ditemukan.");
  if ((await countActiveProjects(id)) > 0) return conflict("Pelanggan masih punya proyek.");
  await transaction(async (tx) => {
    await softDeleteCustomer(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "customer.delete",
        entity: "Customer",
        entityId: id,
        diff: { name: existing.name },
        ip,
      },
      tx,
    );
  });
  return { ok: true, data: { id } };
}
