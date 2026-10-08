import { Role } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createDepartment, listDepartmentPage, removeDepartment } from "@/modules/departments/service";
import { createEmployee, listEmployeePage, removeEmployee } from "@/modules/employees/service";
import type { ListQuery } from "@/modules/master/query";
import type { AuthUser } from "@/modules/rbac/policy";
import { createSchedule, listSchedulePage, removeSchedule } from "@/modules/schedules/service";
import { createUser, listUserPage, removeUser } from "@/modules/users/service";

const query: ListQuery = { page: 1, pageSize: 20, q: "", sort: "name", direction: "asc" };
const deniedRoles: Role[] = [Role.MANAGER, Role.AUDITOR, Role.EMPLOYEE];
const createdIds: { departments: string[]; employees: string[]; schedules: string[]; users: string[] } = {
  departments: [],
  employees: [],
  schedules: [],
  users: [],
};

function actor(role: Role, id = `actor-${role}`): AuthUser {
  return {
    id,
    email: `${role}@example.com`,
    name: role,
    role,
    employeeId: null,
    managedDepartmentIds: [],
  };
}

afterAll(async () => {
  if (createdIds.users.length) await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
  if (createdIds.employees.length) {
    await prisma.employee.deleteMany({ where: { id: { in: createdIds.employees } } });
  }
  if (createdIds.departments.length) {
    await prisma.department.deleteMany({ where: { id: { in: createdIds.departments } } });
  }
  if (createdIds.schedules.length) {
    await prisma.workSchedule.deleteMany({ where: { id: { in: createdIds.schedules } } });
  }
});

describe("master data access", () => {
  it.each(deniedRoles)("%s cannot list or create master data", async (role) => {
    const user = actor(role);
    await expect(listDepartmentPage(user, query)).resolves.toMatchObject({ status: 403 });
    await expect(listEmployeePage(user, { ...query, sort: "name" })).resolves.toMatchObject({ status: 403 });
    await expect(listSchedulePage(user, query)).resolves.toMatchObject({ status: 403 });
    await expect(listUserPage(user, query)).resolves.toMatchObject({ status: 403 });
    await expect(createDepartment(user, { name: "Terlarang" }, null)).resolves.toMatchObject({ status: 403 });
  });

  it("lets HR manage departments, employees, and schedules, but not users", async () => {
    const hr = actor(Role.HR_ADMIN);
    const stamp = Date.now();
    const department = await createDepartment(hr, { name: `Dept ${stamp}` }, null);
    expect(department.ok).toBe(true);
    if (!department.ok) return;
    createdIds.departments.push(department.data.id);

    const schedule = await createSchedule(
      hr,
      { name: `Shift ${stamp}`, start: "09:00", end: "17:00", lateToleranceMin: 0 },
      null,
    );
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;
    createdIds.schedules.push(schedule.data.id);

    const employee = await createEmployee(
      hr,
      { pin: `P${stamp}`, name: `Pegawai ${stamp}`, departmentId: department.data.id, scheduleId: schedule.data.id, isActive: true },
      null,
    );
    expect(employee.ok).toBe(true);
    if (!employee.ok) return;
    createdIds.employees.push(employee.data.id);

    await expect(listUserPage(hr, query)).resolves.toMatchObject({ status: 403 });
    const overflow = await listDepartmentPage(hr, { ...query, page: 99 });
    expect(overflow.ok && overflow.data.page).toBe(1);
    expect(overflow.ok && overflow.data.items.some((item) => item.id === department.data.id)).toBe(true);
    await expect(removeSchedule(hr, schedule.data.id, null)).resolves.toMatchObject({ status: 409 });
    await expect(removeEmployee(hr, employee.data.id, null)).resolves.toMatchObject({ ok: true });
    await expect(removeSchedule(hr, schedule.data.id, null)).resolves.toMatchObject({ status: 409 });
    await prisma.employee.delete({ where: { id: employee.data.id } });
    await expect(removeSchedule(hr, schedule.data.id, null)).resolves.toMatchObject({ ok: true });
    await expect(removeDepartment(hr, department.data.id, null)).resolves.toMatchObject({ ok: true });

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: department.data.id, action: "department.create" },
    });
    expect(audit).not.toBeNull();
  });

  it("lets only a super admin manage users and blocks self-delete", async () => {
    const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: "super.admin@local" } });
    const actorUser = actor(Role.SUPER_ADMIN, superAdmin.id);
    await expect(removeUser(actorUser, superAdmin.id, null)).resolves.toMatchObject({ status: 400 });

    const created = await createUser(
      actorUser,
      {
        email: `temp.${Date.now()}@example.com`,
        name: "Pengguna Sementara",
        password: "TemporaryPass123",
        role: "AUDITOR",
        isActive: true,
        employeeId: "",
        managedDepartmentIds: [],
      },
      null,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdIds.users.push(created.data.id);
    expect(created.data).not.toHaveProperty("passwordHash");
    await expect(removeUser(actorUser, created.data.id, null)).resolves.toMatchObject({ ok: true });
  });
});
