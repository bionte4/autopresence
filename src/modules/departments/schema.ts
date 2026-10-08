import { z } from "zod";

export const departmentBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type DepartmentBody = z.infer<typeof departmentBodySchema>;
