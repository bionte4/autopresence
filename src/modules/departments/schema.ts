import { z } from "zod";

const seatUser = z
  .union([z.string().trim().min(1).max(64), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const reviewersSchema = z.object({
  TEAM_LEADER: seatUser,
  OPERATION_MANAGER: seatUser,
  PROJECT_MANAGER: seatUser,
});

export const departmentBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  projectId: z
    .union([z.string().trim().max(64), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  reviewers: reviewersSchema.optional(),
});

export type DepartmentBody = z.infer<typeof departmentBodySchema>;
