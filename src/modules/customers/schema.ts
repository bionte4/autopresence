import { z } from "zod";

export const customerBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type CustomerBody = z.infer<typeof customerBodySchema>;
