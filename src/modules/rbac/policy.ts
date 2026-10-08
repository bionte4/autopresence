import type { Role, Severity } from "@prisma/client";

export const ACTIONS = [
  "user.manage",
  "department.manage",
  "employee.manage",
  "schedule.manage",
  "upload.create",
  "upload.read",
  "upload.download",
  "upload.delete",
  "attendance.read",
  "correction.create",
  "correction.review",
  "request.create",
  "request.review",
  "anomaly.read",
  "anomaly.resolve",
  "rule.manage",
  "uploadSchedule.manage",
  "audit.read",
  "audit.verify",
  "notification.read",
] as const;

export type Action = (typeof ACTIONS)[number];

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  employeeId: string | null;
  managedDepartmentIds: string[];
};

export type Resource = {
  employeeId?: string | null;
  departmentId?: string | null;
  severity?: Severity;
  ownerUserId?: string | null;
};

export type DataScope =
  | { kind: "all" }
  | { kind: "self"; employeeId: string | null }
  | { kind: "departments"; departmentIds: string[] };

const ALLOWED: Record<Action, readonly Role[]> = {
  "user.manage": ["SUPER_ADMIN"],
  "department.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "employee.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "schedule.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "upload.create": ["SUPER_ADMIN", "HR_ADMIN"],
  "upload.read": ["SUPER_ADMIN", "HR_ADMIN", "AUDITOR"],
  "upload.download": ["SUPER_ADMIN", "HR_ADMIN", "AUDITOR"],
  "upload.delete": ["SUPER_ADMIN", "HR_ADMIN"],
  "attendance.read": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR", "EMPLOYEE"],
  "correction.create": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
  "correction.review": ["SUPER_ADMIN", "HR_ADMIN"],
  "request.create": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"],
  "request.review": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"],
  "anomaly.read": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR"],
  "anomaly.resolve": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"],
  "rule.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "uploadSchedule.manage": ["SUPER_ADMIN", "HR_ADMIN"],
  "audit.read": ["SUPER_ADMIN", "AUDITOR"],
  "audit.verify": ["SUPER_ADMIN", "AUDITOR"],
  "notification.read": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR", "EMPLOYEE"],
};

const MANAGER_RESOLVE_SEVERITY: ReadonlySet<Severity> = new Set(["LOW", "MEDIUM"]);

export function can(user: AuthUser, action: Action, resource?: Resource): boolean {
  if (!ALLOWED[action].includes(user.role)) return false;
  return resourceAllows(user, action, resource);
}

/**
 * Row scope for list/detail queries.
 * EMPLOYEE without a linked employee sees nothing. MANAGER without departments sees nothing.
 */
export function scopeFor(user: AuthUser): DataScope {
  switch (user.role) {
    case "SUPER_ADMIN":
    case "HR_ADMIN":
    case "AUDITOR":
      return { kind: "all" };
    case "EMPLOYEE":
      return { kind: "self", employeeId: user.employeeId };
    case "MANAGER":
      return { kind: "departments", departmentIds: user.managedDepartmentIds };
    default: {
      const unreachable: never = user.role;
      return unreachable;
    }
  }
}

function resourceAllows(user: AuthUser, action: Action, resource: Resource | undefined): boolean {
  if (action === "anomaly.resolve" && user.role === "MANAGER") {
    if (!resource?.departmentId || !resource.severity) return false;
    if (!MANAGER_RESOLVE_SEVERITY.has(resource.severity)) return false;
    return user.managedDepartmentIds.includes(resource.departmentId);
  }

  if (action === "correction.create" && user.role === "MANAGER") {
    if (!resource?.departmentId) return false;
    return user.managedDepartmentIds.includes(resource.departmentId);
  }

  if (action === "correction.create" && user.role === "EMPLOYEE") {
    if (!resource?.employeeId || !user.employeeId) return false;
    return resource.employeeId === user.employeeId;
  }

  if (action === "request.create" && user.role === "MANAGER") {
    if (!resource?.departmentId) return false;
    return user.managedDepartmentIds.includes(resource.departmentId);
  }

  if (action === "request.create" && user.role === "EMPLOYEE") {
    if (!resource?.employeeId || !user.employeeId) return false;
    return resource.employeeId === user.employeeId;
  }

  if (action === "request.review" && user.role === "MANAGER") {
    if (!resource?.departmentId || resource.employeeId === user.employeeId) return false;
    return user.managedDepartmentIds.includes(resource.departmentId);
  }

  if (action === "notification.read" && resource?.ownerUserId) {
    return resource.ownerUserId === user.id;
  }

  return true;
}
