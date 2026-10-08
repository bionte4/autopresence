import { z } from "zod";

export const projectBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  customerId: z.string().trim().min(1).max(64),
});

export type ProjectBody = z.infer<typeof projectBodySchema>;
