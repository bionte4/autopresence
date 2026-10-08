import { z } from "zod";

const roleSchema = z.enum(["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR", "EMPLOYEE"]);

const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : null));

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .max(200)
    .regex(/^[^\s@]+@[^\s@]+$/)
    .transform((email) => email.toLowerCase()),
  name: z.string().trim().min(1).max(200),
  password: z.string().min(12).max(200),
  role: roleSchema,
  isActive: z.boolean().default(true),
  employeeId: optionalId,
  managedDepartmentIds: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({
    password: z.string().min(12).max(200).optional().or(z.literal("")),
  });

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
