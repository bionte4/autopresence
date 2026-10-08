export type CellValue = string | number | boolean | null | undefined;
export type SheetGrid = CellValue[][];

export type ParsedDay = {
  date: string;
  isWorkday: boolean;
  scheduleIn: number | null;
  scheduleOut: number | null;
  clockIn: number | null;
  clockOut: number | null;
  earlyArrivalMin: number | null;
  lateMin: number | null;
  earlyLeaveMin: number | null;
  lateLeaveMin: number | null;
  actualLateMin: number | null;
  effectiveMin: number | null;
  actualMin: number | null;
  locIn: string | null;
  locOut: string | null;
  note: string | null;
};

export type ReportedTotals = {
  dayCount: number;
  earlyArrivalMin: number | null;
  lateMin: number | null;
  earlyLeaveMin: number | null;
  lateLeaveMin: number | null;
  actualLateMin: number | null;
  effectiveMin: number | null;
  actualMin: number | null;
};

export type ParsedEmployee = {
  name: string;
  pin: string;
  days: ParsedDay[];
  reportedTotals: ReportedTotals;
};

export type ParsedReport = {
  period: { start: string; end: string };
  employees: ParsedEmployee[];
};

export type ParseIssue = {
  code: "FORMAT_UNKNOWN" | "UNKNOWN_NOTE";
  severity: "LOW" | "HIGH";
  message: string;
  pin?: string;
  date?: string;
};

export type ParseResult =
  | { ok: true; report: ParsedReport; issues: ParseIssue[] }
  | { ok: false; issues: ParseIssue[] };
