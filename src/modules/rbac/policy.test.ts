import type { Role, Severity } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ACTIONS, can, scopeFor, type Action, type AuthUser, type Resource } from "./policy";

const ROLES: Role[] = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR", "EMPLOYEE", "CUSTOMER"];

const ALLOWED: Record<Action, readonly Role[]> = {
  "user.manage": ["SUPER_ADMIN"],
  "department.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "employee.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "schedule.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "upload.create": ["SUPER_ADMIN", "HR_ADMIN"],
  "upload.read": ["SUPER_ADMIN", "HR_ADMIN", "AUDITOR"],
  "upload.download": ["SUPER_ADMIN", "HR_ADMIN", "AUDITOR"],
  "upload.delete": ["SUPER_ADMIN", "HR_ADMIN"],
  "attendance.read": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR", "EMPLOYEE", "CUSTOMER"],
  "correction.create": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
  "correction.review": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
  "request.create": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
  "request.review": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
  "anomaly.read": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR"],
  "anomaly.resolve": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"],
  "rule.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "uploadSchedule.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "audit.read": ["SUPER_ADMIN", "AUDITOR"],
  "audit.verify": ["SUPER_ADMIN", "AUDITOR"],
  "notification.read": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR", "EMPLOYEE"],
};

function user(role: Role): AuthUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    role,
    employeeId: role === "EMPLOYEE" ? "emp-1" : null,
    managedDepartmentIds: role === "MANAGER" ? ["dept-1"] : [],
    customerDepartmentIds: role === "CUSTOMER" ? ["dept-1"] : [],
    reviewSeats: [{ departmentId: "dept-1", seat: "TEAM_LEADER" }],
  };
}

function resourceFor(action: Action, role: Role): Resource | undefined {
  if (action === "anomaly.resolve" && role === "MANAGER") {
    return { severity: "MEDIUM", departmentId: "dept-1" };
  }
  if (action === "correction.create" && role === "MANAGER") {
    return { departmentId: "dept-1" };
  }
  if (action === "correction.create" && role === "EMPLOYEE") {
    return { employeeId: "emp-1" };
  }
  if (action === "request.create" && role === "MANAGER") {
    return { departmentId: "dept-1" };
  }
  if (action === "request.create" && role === "EMPLOYEE") {
    return { employeeId: "emp-1" };
  }
  if (action === "request.review" || action === "correction.review") {
    return { departmentId: "dept-1", reviewSeat: "TEAM_LEADER", ownerUserId: "requester" };
  }
  if (action === "notification.read") {
    return { ownerUserId: "user-1" };
  }
  return undefined;
}

const matrix = ACTIONS.flatMap((action) =>
  ROLES.map((role) => ({
    action,
    role,
    allow: ALLOWED[action].includes(role),
    resource: resourceFor(action, role),
  })),
);

describe("RBAC matrix", () => {
  it.each(matrix)("$role $action -> $allow", ({ action, role, allow, resource }) => {
    expect(can(user(role), action, resource)).toBe(allow);
  });
});

describe("scoped denies", () => {
  const manager = user("MANAGER");
  const employee = user("EMPLOYEE");

  it("denies a manager resolving a high anomaly in their team", () => {
    expect(can(manager, "anomaly.resolve", { severity: "HIGH", departmentId: "dept-1" })).toBe(false);
  });

  it("denies a manager resolving a critical anomaly", () => {
    expect(can(manager, "anomaly.resolve", { severity: "CRITICAL", departmentId: "dept-1" })).toBe(
      false,
    );
  });

  it("allows a manager resolving a low anomaly in their team", () => {
    expect(can(manager, "anomaly.resolve", { severity: "LOW" satisfies Severity, departmentId: "dept-1" })).toBe(
      true,
    );
  });

  it("denies a manager resolving outside their departments", () => {
    expect(can(manager, "anomaly.resolve", { severity: "MEDIUM", departmentId: "dept-2" })).toBe(false);
  });

  it("denies a manager resolving without a resource", () => {
    expect(can(manager, "anomaly.resolve")).toBe(false);
  });

  it("denies a manager correcting outside their departments", () => {
    expect(can(manager, "correction.create", { departmentId: "dept-2" })).toBe(false);
  });

  it("denies an employee correcting someone else", () => {
    expect(can(employee, "correction.create", { employeeId: "emp-2" })).toBe(false);
  });

  it("denies an employee with no linked record from correcting", () => {
    expect(can({ ...employee, employeeId: null }, "correction.create", { employeeId: "emp-1" })).toBe(
      false,
    );
  });

  it("denies a reviewer approving their own submission", () => {
    expect(
      can(employee, "request.review", { departmentId: "dept-1", reviewSeat: "TEAM_LEADER", ownerUserId: employee.id }),
    ).toBe(false);
  });

  it("denies a team leader acting as operation manager", () => {
    expect(
      can(employee, "correction.review", { departmentId: "dept-1", reviewSeat: "OPERATION_MANAGER", ownerUserId: "requester" }),
    ).toBe(false);
  });

  it("denies review outside the assigned department", () => {
    expect(
      can(employee, "request.review", { departmentId: "dept-2", reviewSeat: "TEAM_LEADER", ownerUserId: "requester" }),
    ).toBe(false);
  });

  it("denies an auditor even when a seat is attached", () => {
    expect(can(user("AUDITOR"), "correction.review", { departmentId: "dept-1", reviewSeat: "TEAM_LEADER", ownerUserId: "requester" })).toBe(
      false,
    );
  });

  it("denies reading another user's notifications", () => {
    expect(can(employee, "notification.read", { ownerUserId: "user-2" })).toBe(false);
  });
});

describe("scopeFor", () => {
  it("gives organization-wide scope to admin, HR, and auditor", () => {
    expect(scopeFor(user("SUPER_ADMIN"))).toEqual({ kind: "all" });
    expect(scopeFor(user("HR_ADMIN"))).toEqual({ kind: "all" });
    expect(scopeFor(user("AUDITOR"))).toEqual({ kind: "all" });
  });

  it("limits an employee to their own employee id", () => {
    expect(scopeFor(user("EMPLOYEE"))).toEqual({ kind: "self", employeeId: "emp-1" });
  });

  it("limits a manager to departments they manage", () => {
    expect(scopeFor(user("MANAGER"))).toEqual({ kind: "departments", departmentIds: ["dept-1"] });
  });

  it("limits a customer to departments on their projects", () => {
    expect(scopeFor(user("CUSTOMER"))).toEqual({ kind: "departments", departmentIds: ["dept-1"] });
    expect(scopeFor({ ...user("CUSTOMER"), customerDepartmentIds: [] })).toEqual({
      kind: "departments",
      departmentIds: [],
    });
  });
});
