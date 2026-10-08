import type { Role } from "@prisma/client";

export type NotifyRule = {
  enabled: boolean;
  notifyRoles: readonly Role[];
  notifyManager: boolean;
  channels: readonly string[];
};

export type NotifyUser = {
  id: string;
  role: Role;
  managedDepartmentIds: readonly string[];
};

export type DeliveryChannel = "IN_APP" | "EMAIL";

/** In-app is mandatory. Email follows the rule. Telegram stays optional and is not sent in v1. */
export function channelsFor(rule: NotifyRule): DeliveryChannel[] {
  if (!rule.enabled) return [];
  const channels: DeliveryChannel[] = ["IN_APP"];
  if (rule.channels.includes("EMAIL")) channels.push("EMAIL");
  return channels;
}

export function recipientsFor(rule: NotifyRule, users: readonly NotifyUser[], employeeDepartmentId: string | null): NotifyUser[] {
  if (!rule.enabled) return [];
  return users.filter((user) => {
    if (rule.notifyRoles.includes(user.role)) return true;
    return (
      rule.notifyManager &&
      user.role === "MANAGER" &&
      employeeDepartmentId !== null &&
      user.managedDepartmentIds.includes(employeeDepartmentId)
    );
  });
}
