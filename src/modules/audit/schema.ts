import { z } from "zod";

export const auditListQuerySchema = z.object({
  page: z.coerce.number().int().positive(),
  pageSize: z.coerce.number().int().positive().max(100),
  direction: z.enum(["asc", "desc"]),
});

export const verifyResponseSchema = z.object({
  valid: z.boolean(),
  checked: z.number().int().nonnegative(),
  brokenAtId: z.string().nullable(),
});
