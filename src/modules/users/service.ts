import type { Role } from "@prisma/client";
import { hash } from "argon2";
import { transaction, UniqueConflict } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, invalid, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import {
  countDepartments,
  customerIsActive,
  employeeIsFree,
  findUser,
  insertUser,
  listUsers,
  softDeleteUser,
  updateUser,
  type UserRow,
} from "./repo";
import { createUserSchema, updateUserSchema, type CreateUserBody, type UpdateUserBody } from "./schema";

export type UserDto = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  employeeId: string | null;
  employeeName: string | null;
  employeePin: string | null;
  managedDepartmentIds: string[];
  customerId: string | null;
  customerName: string | null;
};

function toDto(row: UserRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.isActive,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    employeePin: row.employee?.pin ?? null,
    managedDepartmentIds: row.managedDepartments.map((department) => department.id),
    customerId: row.customerId,
    customerName: row.customer?.name ?? null,
  };
}

function publicDiff(row: UserDto) {
  return row;
}

async function validateLinks(
  body: { employeeId: string | null; managedDepartmentIds: string[]; customerId: string | null; role: Role },
  userId: string | null,
) {
  if (body.role === "CUSTOMER") {
    if (!body.customerId) return "Pilih pelanggan untuk akun ini.";
    if (!(await customerIsActive(body.customerId))) return "Pelanggan tidak ditemukan.";
    return null;
  }
  if (body.employeeId) {
    const state = await employeeIsFree(body.employeeId, userId);
    if (state === "missing") return "Pegawai tidak ditemukan.";
    if (state === "taken") return "Pegawai sudah tertaut ke pengguna lain.";
  }
  const departmentIds = body.role === "MANAGER" ? body.managedDepartmentIds : [];
  if (departmentIds.length > 0 && (await countDepartments(departmentIds)) !== new Set(departmentIds).size) {
    return "Departemen yang dipilih tidak ditemukan.";
  }
  return null;
}

function linksFor(body: { employeeId: string | null; managedDepartmentIds: string[]; customerId: string | null; role: Role }) {
  if (body.role === "CUSTOMER") {
    return { employeeId: null, managedDepartmentIds: [] as string[], customerId: body.customerId };
  }
  return {
    employeeId: body.employeeId,
    managedDepartmentIds: body.role === "MANAGER" ? body.managedDepartmentIds : [],
    customerId: null,
  };
}

export async function listUserPage(
  actor: AuthUser,
  query: ListQuery,
): Promise<ServiceResult<{ items: UserDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "user.manage")) return denied();
  const { total, rows, page } = await listUsers(query);
  return { ok: true, data: { items: rows.map(toDto), page, pageSize: query.pageSize, total } };
}

export async function getUser(actor: AuthUser, id: string): Promise<ServiceResult<UserDto>> {
  if (!can(actor, "user.manage")) return denied();
  const row = await findUser(id);
  if (!row) return missing("Pengguna tidak ditemukan.");
  return { ok: true, data: toDto(row) };
}

export async function createUser(
  actor: AuthUser,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<UserDto>> {
  if (!can(actor, "user.manage")) return denied();
  const body: CreateUserBody = createUserSchema.parse(input);
  const linkError = await validateLinks(body, null);
  if (linkError) return invalid(linkError);
  const passwordHash = await hash(body.password);
  try {
    const row = await transaction(async (tx) => {
      const created = await insertUser(tx, {
        email: body.email,
        name: body.name,
        passwordHash,
        role: body.role,
        isActive: body.isActive,
        ...linksFor(body),
      });
      await audit(
        {
          actorId: actor.id,
          action: "user.create",
          entity: "User",
          entityId: created.id,
          diff: publicDiff(toDto(created)),
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

export async function editUser(
  actor: AuthUser,
  id: string,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<UserDto>> {
  if (!can(actor, "user.manage")) return denied();
  const body: UpdateUserBody = updateUserSchema.parse(input);
  const existing = await findUser(id);
  if (!existing) return missing("Pengguna tidak ditemukan.");
  if (actor.id === id && (body.role !== existing.role || body.isActive === false)) {
    return invalid("Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.");
  }
  const linkError = await validateLinks(body, id);
  if (linkError) return invalid(linkError);
  const passwordHash = body.password ? await hash(body.password) : undefined;
  try {
    const row = await transaction(async (tx) => {
      const updated = await updateUser(tx, id, {
        email: body.email,
        name: body.name,
        passwordHash,
        role: body.role,
        isActive: body.isActive,
        ...linksFor(body),
      });
      await audit(
        {
          actorId: actor.id,
          action: "user.update",
          entity: "User",
          entityId: id,
          diff: {
            before: publicDiff(toDto(existing)),
            after: publicDiff(toDto(updated)),
            passwordChanged: Boolean(passwordHash),
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

export async function removeUser(
  actor: AuthUser,
  id: string,
  ip: string | null,
): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "user.manage")) return denied();
  if (actor.id === id) return invalid("Anda tidak dapat menghapus akun sendiri.");
  const existing = await findUser(id);
  if (!existing) return missing("Pengguna tidak ditemukan.");
  await transaction(async (tx) => {
    await softDeleteUser(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "user.delete",
        entity: "User",
        entityId: id,
        diff: { email: existing.email, role: existing.role },
        ip,
      },
      tx,
    );
  });
  return { ok: true, data: { id } };
}
