import { z } from "zod";

const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .transform((value) => {
    const [hours, minutes] = value.split(":");
    return Number(hours) * 60 + Number(minutes);
  });

export const scheduleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    start: clock,
    end: clock,
    lateToleranceMin: z.coerce.number().int().min(0).max(24 * 60),
  })
  .refine((value) => value.end > value.start, {
    message: "Jam pulang harus setelah jam masuk.",
    path: ["end"],
  });

export type ScheduleBody = z.infer<typeof scheduleBodySchema>;
