import { z } from "zod";

const minute = z.number().int().min(0).max(24 * 60);

export const correctionBodySchema = z
  .object({
    recordId: z.string().trim().min(1).max(64),
    clockInMin: minute.nullable().optional(),
    clockOutMin: minute.nullable().optional(),
    note: z.string().trim().max(200).nullable().optional(),
    reason: z.string().trim().min(3).max(500),
    evidenceNote: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.clockInMin === undefined && value.clockOutMin === undefined && value.note === undefined) {
      ctx.addIssue({ code: "custom", message: "minimal satu field" });
    }
    if (
      value.clockInMin != null &&
      value.clockOutMin != null &&
      value.clockOutMin < value.clockInMin
    ) {
      ctx.addIssue({ code: "custom", message: "jam keluar" });
    }
  });

export const reviewCorrectionSchema = z.object({
  note: z.string().trim().min(3).max(500),
});

export type CorrectionListQuery = {
  page: number;
  pageSize: number;
  q: string;
  sort: "createdAt" | "status";
  direction: "asc" | "desc";
  status?: "PENDING" | "APPROVED" | "REJECTED";
};

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().max(100).default(""),
  sort: z.enum(["createdAt", "status"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().optional(),
});

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export function parseCorrectionListQuery(params: Record<string, string | undefined>): CorrectionListQuery {
  const parsed = listSchema.parse({
    page: params.page || undefined,
    pageSize: params.pageSize || undefined,
    q: params.q ?? "",
    sort: params.sort || undefined,
    direction: params.direction || undefined,
    status: params.status,
  });
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    q: parsed.q,
    sort: parsed.sort,
    direction: parsed.direction,
    status: STATUSES.find((item) => item === parsed.status),
  };
}
