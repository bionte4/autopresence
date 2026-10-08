import { describe, expect, it } from "vitest";
import { channelsFor, recipientsFor, type NotifyRule, type NotifyUser } from "./recipients";

const rule: NotifyRule = {
  enabled: true,
  notifyRoles: ["SUPER_ADMIN", "HR_ADMIN"],
  notifyManager: true,
  channels: ["IN_APP", "EMAIL"],
};

const users: NotifyUser[] = [
  { id: "hr", role: "HR_ADMIN", managedDepartmentIds: [] },
  { id: "super", role: "SUPER_ADMIN", managedDepartmentIds: [] },
  { id: "lead", role: "MANAGER", managedDepartmentIds: ["ops"] },
  { id: "other", role: "MANAGER", managedDepartmentIds: ["finance"] },
  { id: "audit", role: "AUDITOR", managedDepartmentIds: [] },
  { id: "staff", role: "EMPLOYEE", managedDepartmentIds: [] },
];

describe("notification recipients", () => {
  it("notifies the rule roles and the manager of that department", () => {
    expect(recipientsFor(rule, users, "ops").map((user) => user.id)).toEqual(["hr", "super", "lead"]);
    expect(channelsFor(rule)).toEqual(["IN_APP", "EMAIL"]);
  });

  it("skips everyone when the rule is disabled", () => {
    expect(recipientsFor({ ...rule, enabled: false }, users, "ops")).toEqual([]);
    expect(channelsFor({ ...rule, enabled: false })).toEqual([]);
  });
});
