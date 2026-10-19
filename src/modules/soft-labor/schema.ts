import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function inclusiveDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export const softLaborQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    departmentId: z.string().trim().min(1).max(64).optional(),
    employeeId: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => value.from <= value.to, { path: ["to"] })
  .refine((value) => inclusiveDays(value.from, value.to) <= 366, { path: ["to"] });

export type SoftLaborQuery = z.infer<typeof softLaborQuerySchema>;

export function parseSoftLaborQuery(params: Record<string, string | undefined>): SoftLaborQuery {
  return softLaborQuerySchema.parse({
    from: params.from,
    to: params.to,
    departmentId: params.departmentId || undefined,
    employeeId: params.employeeId || undefined,
  });
}
