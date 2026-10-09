import { z } from "zod";

export type AnomalyListQuery = {
  page: number;
  pageSize: number;
  q: string;
  sort: "createdAt" | "severity";
  direction: "asc" | "desc";
  status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "FALSE_POSITIVE";
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type?:
    | "ROW_MISMATCH"
    | "TOTAL_MISMATCH"
    | "DAYS_MISMATCH"
    | "DATA_CHANGED"
    | "DUPLICATE_FILE"
    | "MISSING_UPLOAD"
    | "MISSING_PUNCH"
    | "REPEATED_LATE"
    | "NO_REASON"
    | "FORMAT_UNKNOWN"
    | "GRANULARITY_MISMATCH"
    | "FILE_METADATA_SUSPICIOUS"
    | "UNKNOWN_EMPLOYEE"
    | "UNKNOWN_NOTE";
  employeeId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
  /** When set with a date range, undated findings stay out of the list. */
  dated?: boolean;
};

const anomalyListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().max(100).default(""),
  sort: z.enum(["createdAt", "severity"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().optional(),
  severity: z.string().optional(),
  type: z.string().optional(),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const TYPES = [
  "ROW_MISMATCH",
  "TOTAL_MISMATCH",
  "DAYS_MISMATCH",
  "DATA_CHANGED",
  "DUPLICATE_FILE",
  "MISSING_UPLOAD",
  "MISSING_PUNCH",
  "REPEATED_LATE",
  "NO_REASON",
  "FORMAT_UNKNOWN",
  "GRANULARITY_MISMATCH",
  "FILE_METADATA_SUSPICIOUS",
  "UNKNOWN_EMPLOYEE",
  "UNKNOWN_NOTE",
] as const;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return allowed.find((item) => item === value);
}

export function parseAnomalyListQuery(params: Record<string, string | undefined>): AnomalyListQuery {
  const parsed = anomalyListSchema.parse({
    page: params.page || undefined,
    pageSize: params.pageSize || undefined,
    q: params.q ?? "",
    sort: params.sort || undefined,
    direction: params.direction || undefined,
    status: params.status,
    severity: params.severity,
    type: params.type,
    employeeId: params.employeeId,
    departmentId: params.departmentId,
    from: params.from,
    to: params.to,
  });
  const from = parsed.from && /^\d{4}-\d{2}-\d{2}$/.test(parsed.from) ? parsed.from : undefined;
  const to = parsed.to && /^\d{4}-\d{2}-\d{2}$/.test(parsed.to) ? parsed.to : undefined;
  const employeeId = parsed.employeeId?.trim() || undefined;
  const departmentId = parsed.departmentId?.trim() || undefined;
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    q: parsed.q,
    sort: parsed.sort,
    direction: parsed.direction,
    status: oneOf(parsed.status, STATUSES),
    severity: oneOf(parsed.severity, SEVERITIES),
    type: oneOf(parsed.type, TYPES),
    employeeId,
    departmentId,
    from,
    to,
    dated: params.dated === "1" && Boolean(from || to),
  };
}

export const resolveAnomalySchema = z.object({
  outcome: z.enum(["RESOLVED", "FALSE_POSITIVE"]),
  note: z.string().trim().min(3).max(500),
});
