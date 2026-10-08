import { z } from "zod";

const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : null));

export const employeeBodySchema = z.object({
  pin: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  departmentId: optionalId,
  scheduleId: z.string().trim().min(1).max(64),
  isActive: z.boolean().default(true),
});

export type EmployeeBody = z.infer<typeof employeeBodySchema>;
