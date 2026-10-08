import { z } from "zod";

const cutoff = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const uploadScheduleBodySchema = z
  .object({
    granularity: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    cutoffTime: cutoff.default("10:00"),
    dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    enabled: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.granularity === "WEEKLY" && !value.dayOfWeek) {
      ctx.addIssue({ code: "custom", path: ["dayOfWeek"], message: "Hari mingguan wajib diisi." });
    }
    if (value.granularity === "MONTHLY" && !value.dayOfMonth) {
      ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "Tanggal bulanan wajib diisi." });
    }
  })
  .transform((value) => ({
    granularity: value.granularity,
    cutoffTime: value.cutoffTime,
    dayOfWeek: value.granularity === "WEEKLY" ? (value.dayOfWeek ?? null) : null,
    dayOfMonth: value.granularity === "MONTHLY" ? (value.dayOfMonth ?? null) : null,
    enabled: value.enabled,
  }));

export type UploadScheduleBody = z.infer<typeof uploadScheduleBodySchema>;
