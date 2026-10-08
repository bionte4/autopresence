import { transaction, UniqueConflict } from "@/lib/prisma";
import { audit } from "@/modules/audit/service";
import type { ListQuery } from "@/modules/master/query";
import { conflict, denied, invalid, missing, type ServiceResult } from "@/modules/master/result";
import { can, type AuthUser } from "@/modules/rbac/policy";
import {
  departmentExists,
  findEmployee,
  insertEmployee,
  listEmployeeOptions,
  listEmployees,
  scheduleExists,
  softDeleteEmployee,
  updateEmployee,
  type EmployeeRow,
} from "./repo";
import { employeeBodySchema, type EmployeeBody } from "./schema";

export type EmployeeDto = {
  id: string;
  pin: string;
  name: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
  scheduleId: string;
  scheduleName: string;
};

function toDto(row: EmployeeRow): EmployeeDto {
  return {
    id: row.id,
    pin: row.pin,
    name: row.name,
    isActive: row.isActive,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    scheduleId: row.scheduleId,
    scheduleName: row.schedule.name,
  };
}

function createData(body: EmployeeBody) {
  return {
    pin: body.pin,
    name: body.name,
    isActive: body.isActive,
    schedule: { connect: { id: body.scheduleId } },
    ...(body.departmentId ? { department: { connect: { id: body.departmentId } } } : {}),
  };
}

function updateData(body: EmployeeBody) {
  return {
    ...createData(body),
    department: body.departmentId ? { connect: { id: body.departmentId } } : { disconnect: true },
  };
}

async function referencesExist(body: EmployeeBody) {
  if (body.departmentId && !(await departmentExists(body.departmentId))) {
    return "Departemen tidak ditemukan.";
  }
  if (!(await scheduleExists(body.scheduleId))) return "Jadwal tidak ditemukan.";
  return null;
}

export async function listEmployeePage(
  actor: AuthUser,
  query: ListQuery,
): Promise<ServiceResult<{ items: EmployeeDto[]; page: number; pageSize: number; total: number }>> {
  if (!can(actor, "employee.manage")) return denied();
  const { total, rows, page } = await listEmployees(query);
  return { ok: true, data: { items: rows.map(toDto), page, pageSize: query.pageSize, total } };
}

export async function employeeChoices(
  actor: AuthUser,
): Promise<ServiceResult<Array<{ id: string; name: string; pin: string }>>> {
  if (!can(actor, "employee.manage") && !can(actor, "user.manage")) return denied();
  return { ok: true, data: await listEmployeeOptions() };
}

export async function getEmployee(actor: AuthUser, id: string): Promise<ServiceResult<EmployeeDto>> {
  if (!can(actor, "employee.manage")) return denied();
  const row = await findEmployee(id);
  if (!row) return missing("Pegawai tidak ditemukan.");
  return { ok: true, data: toDto(row) };
}

export async function createEmployee(
  actor: AuthUser,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<EmployeeDto>> {
  if (!can(actor, "employee.manage")) return denied();
  const body = employeeBodySchema.parse(input);
  const referenceError = await referencesExist(body);
  if (referenceError) return invalid(referenceError);
  try {
    const row = await transaction(async (tx) => {
      const created = await insertEmployee(tx, createData(body));
      await audit(
        {
          actorId: actor.id,
          action: "employee.create",
          entity: "Employee",
          entityId: created.id,
          diff: toDto(created),
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

export async function editEmployee(
  actor: AuthUser,
  id: string,
  input: unknown,
  ip: string | null,
): Promise<ServiceResult<EmployeeDto>> {
  if (!can(actor, "employee.manage")) return denied();
  const body = employeeBodySchema.parse(input);
  const existing = await findEmployee(id);
  if (!existing) return missing("Pegawai tidak ditemukan.");
  const referenceError = await referencesExist(body);
  if (referenceError) return invalid(referenceError);
  try {
    const row = await transaction(async (tx) => {
      const updated = await updateEmployee(tx, id, updateData(body));
      await audit(
        {
          actorId: actor.id,
          action: "employee.update",
          entity: "Employee",
          entityId: id,
          diff: { before: toDto(existing), after: toDto(updated) },
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

export async function removeEmployee(
  actor: AuthUser,
  id: string,
  ip: string | null,
): Promise<ServiceResult<{ id: string }>> {
  if (!can(actor, "employee.manage")) return denied();
  const existing = await findEmployee(id);
  if (!existing) return missing("Pegawai tidak ditemukan.");
  await transaction(async (tx) => {
    await softDeleteEmployee(tx, id);
    await audit(
      {
        actorId: actor.id,
        action: "employee.delete",
        entity: "Employee",
        entityId: id,
        diff: { pin: existing.pin, name: existing.name },
        ip,
      },
      tx,
    );
  });
  return { ok: true, data: { id } };
}
