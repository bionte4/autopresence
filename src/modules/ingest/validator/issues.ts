export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const ANOMALY_TYPES = [
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

export type AnomalyCode = (typeof ANOMALY_TYPES)[number];

export type AttendanceIssue = {
  type: AnomalyCode;
  severity: Severity;
  message: string;
  pin?: string;
  date?: string;
  details?: Record<string, unknown>;
};
