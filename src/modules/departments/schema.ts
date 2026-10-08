import { z } from "zod";

export const departmentBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  projectId: z
    .union([z.string().trim().max(64), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
});

export type DepartmentBody = z.infer<typeof departmentBodySchema>;
