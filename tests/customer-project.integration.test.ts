import { Role } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCustomer, removeCustomer } from "@/modules/customers/service";
import { createDepartment, removeDepartment } from "@/modules/departments/service";
import { createProject, removeProject } from "@/modules/projects/service";
import type { AuthUser } from "@/modules/rbac/policy";

const created = { customers: [] as string[], projects: [] as string[], departments: [] as string[] };

function actor(role: Role): AuthUser {
  return {
    id: `actor-${role}`,
    email: `${role}@example.com`,
    name: role,
    role,
    employeeId: null,
    managedDepartmentIds: [],
  };
}

afterAll(async () => {
  if (created.departments.length) {
    await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
  }
  if (created.projects.length) await prisma.project.deleteMany({ where: { id: { in: created.projects } } });
  if (created.customers.length) await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
});

describe("customer and project", () => {
  it("keeps one project on one department and blocks deletion while linked", async () => {
    const hr = actor(Role.HR_ADMIN);
    const manager = actor(Role.MANAGER);
    const stamp = Date.now();
    await expect(createCustomer(manager, { name: `Pelanggan ${stamp}` }, null)).resolves.toMatchObject({ status: 403 });

    const customer = await createCustomer(hr, { name: `Pelanggan ${stamp}` }, null);
    expect(customer.ok).toBe(true);
    if (!customer.ok) return;
    created.customers.push(customer.data.id);

    const first = await createProject(hr, { name: `Proyek ${stamp}`, customerId: customer.data.id }, null);
    const second = await createProject(hr, { name: `Proyek lain ${stamp}`, customerId: customer.data.id }, null);
    const duplicate = await createProject(hr, { name: `Proyek ${stamp}`, customerId: customer.data.id }, null);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(duplicate).toMatchObject({ status: 409 });
    if (!first.ok || !second.ok) return;
    created.projects.push(first.data.id, second.data.id);

    const department = await createDepartment(hr, { name: `Dept ${stamp}`, projectId: first.data.id }, null);
    expect(department.ok).toBe(true);
    if (!department.ok) return;
    created.departments.push(department.data.id);
    expect(department.data.customerName).toBe(customer.data.name);
    expect(department.data.projectName).toBe(first.data.name);

    await expect(createDepartment(hr, { name: `Dept lain ${stamp}`, projectId: first.data.id }, null)).resolves.toMatchObject({
      status: 409,
    });
    await expect(removeProject(hr, first.data.id, null)).resolves.toMatchObject({ status: 409 });
    await expect(removeCustomer(hr, customer.data.id, null)).resolves.toMatchObject({ status: 409 });
    await expect(removeDepartment(hr, department.data.id, null)).resolves.toMatchObject({ ok: true });
    await expect(removeProject(hr, first.data.id, null)).resolves.toMatchObject({ ok: true });
    await expect(removeProject(hr, second.data.id, null)).resolves.toMatchObject({ ok: true });
    await expect(removeCustomer(hr, customer.data.id, null)).resolves.toMatchObject({ ok: true });

    const audit = await prisma.auditLog.findFirst({ where: { entityId: customer.data.id, action: "customer.create" } });
    expect(audit).not.toBeNull();
  });
});
