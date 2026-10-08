import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .max(200)
    .regex(/^[^\s@]+@[^\s@]+$/)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(200),
});
