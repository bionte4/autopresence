import { z } from "zod";
import { periodLength } from "./span";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const requestBodySchema = z
  .object({
    employeeId: z.string().trim().min(1).max(64),
    kind: z.enum(["LEAVE", "SICK", "OVERTIME"]),
    startDate: iso,
    endDate: iso,
    endMin: z.number().int().min(0).max(24 * 60).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((value, ctx) => {
    const length = periodLength(value.startDate, value.endDate);
    if (length === null || length > 31) {
      ctx.addIssue({ code: "custom", message: "Rentang tanggal tidak valid." });
    }
    if (value.kind === "OVERTIME" && value.startDate !== value.endDate) {
      ctx.addIssue({ code: "custom", message: "Lembur hanya untuk satu tanggal." });
    }
    if (value.kind === "OVERTIME" && value.endMin === undefined) {
      ctx.addIssue({ code: "custom", message: "Jam selesai lembur wajib diisi." });
    }
    if (value.kind !== "OVERTIME" && value.endMin !== undefined) {
      ctx.addIssue({ code: "custom", message: "Jam selesai hanya untuk lembur." });
    }
  });

export const reviewRequestSchema = z.object({
  note: z.string().trim().min(3).max(500),
});

export type RequestListQuery = {
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

export function parseRequestListQuery(params: Record<string, string | undefined>): RequestListQuery {
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
