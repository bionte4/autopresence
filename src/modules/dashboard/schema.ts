import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function inclusiveDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export const dashboardQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    compareFrom: isoDate.optional(),
    compareTo: isoDate.optional(),
    departmentId: z.string().trim().min(1).max(64).optional(),
    employeeId: z.string().trim().min(1).max(64).optional(),
    q: z.string().trim().max(100).default(""),
    sort: z.enum(["name", "lateCount", "lateMinutes", "missingPunch", "noReason"]).default("lateCount"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    grain: z.enum(["week", "month"]).default("week"),
  })
  .refine((value) => value.from <= value.to, { path: ["to"] })
  .refine((value) => inclusiveDays(value.from, value.to) <= 366, { path: ["to"] })
  .refine((value) => Boolean(value.compareFrom) === Boolean(value.compareTo), { path: ["compareFrom"] })
  .refine((value) => !value.compareFrom || !value.compareTo || value.compareFrom <= value.compareTo, { path: ["compareTo"] })
  .refine(
    (value) => !value.compareFrom || !value.compareTo || inclusiveDays(value.compareFrom, value.compareTo) <= 366,
    { path: ["compareTo"] },
  );

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export function parseDashboardQuery(params: Record<string, string | undefined>): DashboardQuery {
  return dashboardQuerySchema.parse({
    from: params.from,
    to: params.to,
    compareFrom: params.compareFrom || undefined,
    compareTo: params.compareTo || undefined,
    departmentId: params.departmentId || undefined,
    employeeId: params.employeeId || undefined,
    q: params.q ?? "",
    sort: params.sort || undefined,
    direction: params.direction || undefined,
    page: params.page || undefined,
    pageSize: params.pageSize || undefined,
    grain: params.grain || undefined,
  });
}
