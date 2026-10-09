import { visiblePage } from "@/modules/master/query";
import { denied, missing, type ServiceResult } from "@/modules/master/result";
import { can, isCustomerViewer, scopeFor, type AuthUser, type DataScope } from "@/modules/rbac/policy";
import { isoDate } from "@/modules/uploads/dates";
import {
  heatmap,
  rowIsLate,
  rowMissingPunch,
  rowNoReason,
  sortSummaries,
  summarizeEmployees,
  topLate,
  summarizeKpis,
  trend,
  type DashboardKpis,
  type DayRow,
  type EmployeeRef,
  type EmployeeSummary,
  type HeatCell,
  type TrendPoint,
} from "./aggregate";
import { attendanceWorkbook } from "./sheet";
import {
  countOpenAnomalies,
  findAnomalyDates,
  findAttendanceInRange,
  findDashboardEmployees,
  findEmployeeInScope,
  findLatestUpload,
  listDepartmentOptions,
  type EmployeeFilter,
} from "./repo";
import type { DashboardQuery } from "./schema";

export type DashboardDto = {
  period: { from: string; to: string };
  compare: { from: string; to: string } | null;
  kpis: DashboardKpis;
  comparison: { lateEvents: number; lateMinutes: number; missingPunch: number; noReason: number } | null;
  trend: TrendPoint[];
  heatmap: HeatCell[] | null;
  heatmapEmployeeId: string | null;
  anomalyDates: string[];
  ranking: EmployeeSummary[];
  rows: EmployeeSummary[];
  page: number;
  pageSize: number;
  total: number;
  integrity: {
    uploadId: string;
    originalName: string;
    status: "RECEIVED" | "PARSED" | "PARSED_WITH_ANOMALIES" | "REJECTED";
    periodStart: string;
    periodEnd: string;
    sha256: string;
    uploadedAt: string;
  } | null;
  departments: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string; pin: string }>;
};

export type EmployeeDashboardDto = {
  employee: EmployeeRef;
  period: { from: string; to: string };
  kpis: DashboardKpis;
  days: Array<{
    date: string;
    clockInMin: number | null;
    clockOutMin: number | null;
    lateMin: number | null;
    actualLateMin: number | null;
    note: string | null;
    late: boolean;
    missingPunch: boolean;
    noReason: boolean;
  }>;
  heatmap: HeatCell[];
  anomalyDates: string[];
};

type ScopeDecision = { ok: true; scope: DataScope } | { ok: false; error: ServiceResult<never> };

function decideScope(actor: AuthUser, query: Pick<DashboardQuery, "departmentId" | "employeeId">): ScopeDecision {
  const scope = scopeFor(actor);
  if (query.departmentId && scope.kind === "self") return { ok: false, error: denied() };
  if (query.departmentId && scope.kind === "departments" && !scope.departmentIds.includes(query.departmentId)) {
    return { ok: false, error: denied() };
  }
  if (query.employeeId && scope.kind === "self" && query.employeeId !== scope.employeeId) {
    return { ok: false, error: denied() };
  }
  return { ok: true, scope };
}

function toRef(employee: {
  id: string;
  name: string;
  pin: string;
  department: { name: string } | null;
}): EmployeeRef {
  return { id: employee.id, name: employee.name, pin: employee.pin, departmentName: employee.department?.name ?? null };
}

function toDayRows(
  records: Array<{
    employeeId: string;
    date: Date;
    lateMin: number | null;
    actualLateMin: number | null;
    note: string | null;
    isWorkday: boolean;
    clockInMin: number | null;
    clockOutMin: number | null;
  }>,
  tolerance: Map<string, number>,
): DayRow[] {
  return records.map((record) => ({
    employeeId: record.employeeId,
    date: isoDate(record.date),
    lateMin: record.lateMin,
    actualLateMin: record.actualLateMin,
    note: record.note,
    isWorkday: record.isWorkday,
    clockInMin: record.clockInMin,
    clockOutMin: record.clockOutMin,
    lateToleranceMin: tolerance.get(record.employeeId) ?? 0,
  }));
}

async function loadSlice(filter: EmployeeFilter, from: string, to: string, includeUnassigned: boolean) {
  const employees = await findDashboardEmployees(filter);
  const ids = employees.map((employee) => employee.id);
  const [records, openAnomalies] = await Promise.all([
    findAttendanceInRange(ids, from, to),
    countOpenAnomalies(ids, from, to, includeUnassigned),
  ]);
  const tolerance = new Map(employees.map((employee) => [employee.id, employee.schedule.lateToleranceMin]));
  const rows = toDayRows(records, tolerance);
  const summaries = summarizeEmployees(employees.map(toRef), rows);
  return { employees, ids, rows, summaries, openAnomalies };
}

function currentMonth(): { from: string; to: string } {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month] = today.split("-");
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(last).padStart(2, "0")}` };
}

export async function suggestPeriod(actor: AuthUser): Promise<{ from: string; to: string }> {
  if (!can(actor, "attendance.read")) return currentMonth();
  const scope = scopeFor(actor);
  const latest = await findLatestUpload(scope.kind === "all" ? "all" : scope.kind === "self" ? (scope.employeeId ? [scope.employeeId] : []) : scope.departmentIds.length ? await scopedIds(scope) : []);
  if (!latest) return currentMonth();
  return { from: isoDate(latest.periodStart), to: isoDate(latest.periodEnd) };
}

async function scopedIds(scope: DataScope): Promise<string[]> {
  const employees = await findDashboardEmployees({ scope });
  return employees.map((employee) => employee.id);
}

export async function getDashboard(actor: AuthUser, query: DashboardQuery): Promise<ServiceResult<DashboardDto>> {
  if (!can(actor, "attendance.read")) return denied();
  const decision = decideScope(actor, query);
  if (!decision.ok) return decision.error;
  const scope = decision.scope;
  const includeUnassigned = scope.kind === "all" && !query.departmentId && !query.employeeId && query.q === "";
  const filter: EmployeeFilter = {
    scope,
    departmentId: query.departmentId,
    employeeId: query.employeeId,
    q: query.q,
    matchPin: !isCustomerViewer(actor),
  };
  const [{ summaries, rows, openAnomalies }, options, departments, integrity] = await Promise.all([
    loadSlice(filter, query.from, query.to, includeUnassigned),
    findDashboardEmployees({ scope, departmentId: query.departmentId }),
    listDepartmentOptions(scope),
    findLatestUpload(scope.kind === "all" && !query.departmentId && !query.employeeId ? "all" : await matchingIds(filter)),
  ]);
  const comparisonSlice = query.compareFrom && query.compareTo
    ? await loadSlice(filter, query.compareFrom, query.compareTo, includeUnassigned)
    : null;
  const kpis = summarizeKpis(summaries, openAnomalies);
  const compared = comparisonSlice ? summarizeKpis(comparisonSlice.summaries, comparisonSlice.openAnomalies) : null;
  const sorted = sortSummaries(summaries, query.sort, query.direction);
  const page = visiblePage(query.page, query.pageSize, sorted.length);
  const single = summaries.length === 1 ? summaries[0] : undefined;
  const anomalyDates = single && can(actor, "anomaly.read") ? await findAnomalyDates(single.employeeId, query.from, query.to) : [];
  const data: DashboardDto = {
      period: { from: query.from, to: query.to },
      compare: query.compareFrom && query.compareTo ? { from: query.compareFrom, to: query.compareTo } : null,
      kpis,
      comparison: compared
        ? {
            lateEvents: compared.lateEvents,
            lateMinutes: compared.lateMinutes,
            missingPunch: compared.missingPunch,
            noReason: compared.noReason,
          }
        : null,
      trend: trend(rows, query.grain),
      heatmap: single ? heatmap(query.from, query.to, rows.filter((row) => row.employeeId === single.employeeId)) : null,
      heatmapEmployeeId: single?.employeeId ?? null,
      anomalyDates,
      ranking: topLate(summaries),
      rows: sorted.slice((page - 1) * query.pageSize, page * query.pageSize),
      page,
      pageSize: query.pageSize,
      total: sorted.length,
      integrity: integrity
        ? {
            uploadId: integrity.id,
            originalName: integrity.originalName,
            status: integrity.status,
            periodStart: isoDate(integrity.periodStart),
            periodEnd: isoDate(integrity.periodEnd),
            sha256: integrity.sha256,
            uploadedAt: integrity.createdAt.toISOString(),
          }
        : null,
      departments,
      employees: options.map((employee) => ({ id: employee.id, name: employee.name, pin: employee.pin })),
  };
  return { ok: true, data: presentDashboard(actor, data) };
}

function hidePin<T extends { pin: string }>(row: T): T {
  return { ...row, pin: "" };
}

/** The customer dashboard is attendance only: no file hash, no open-anomaly count, no PIN. */
function presentDashboard(actor: AuthUser, data: DashboardDto): DashboardDto {
  if (!isCustomerViewer(actor)) return data;
  return {
    ...data,
    kpis: { ...data.kpis, openAnomalies: 0 },
    integrity: null,
    ranking: data.ranking.map(hidePin),
    rows: data.rows.map(hidePin),
    employees: data.employees.map(hidePin),
  };
}

async function matchingIds(filter: EmployeeFilter): Promise<string[]> {
  const employees = await findDashboardEmployees(filter);
  return employees.map((employee) => employee.id);
}

export async function getEmployeeDashboard(
  actor: AuthUser,
  employeeId: string,
  period: { from: string; to: string },
): Promise<ServiceResult<EmployeeDashboardDto>> {
  if (!can(actor, "attendance.read")) return denied();
  const decision = decideScope(actor, { employeeId });
  if (!decision.ok) return decision.error;
  const employee = await findEmployeeInScope(employeeId, decision.scope);
  if (!employee) return missing("Pegawai tidak ditemukan.");
  const records = await findAttendanceInRange([employee.id], period.from, period.to);
  const rows = toDayRows(records, new Map([[employee.id, employee.schedule.lateToleranceMin]]));
  const summaries = summarizeEmployees([toRef(employee)], rows);
  const openAnomalies = await countOpenAnomalies([employee.id], period.from, period.to, false);
  const anomalyDates = can(actor, "anomaly.read") ? await findAnomalyDates(employee.id, period.from, period.to) : [];
  const ref = toRef(employee);
  return {
    ok: true,
    data: {
      employee: isCustomerViewer(actor) ? hidePin(ref) : ref,
      period,
      kpis: summarizeKpis(summaries, isCustomerViewer(actor) ? 0 : openAnomalies),
      days: rows
        .slice()
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((row) => ({
          date: row.date,
          clockInMin: row.clockInMin,
          clockOutMin: row.clockOutMin,
          lateMin: row.lateMin,
          actualLateMin: row.actualLateMin,
          note: row.note,
          late: rowIsLate(row),
          missingPunch: rowMissingPunch(row),
          noReason: rowNoReason(row.note),
        })),
      heatmap: heatmap(period.from, period.to, rows),
      anomalyDates,
    },
  };
}

export async function exportAttendanceWorkbook(
  actor: AuthUser,
  query: DashboardQuery,
): Promise<ServiceResult<{ filename: string; body: Buffer }>> {
  if (!can(actor, "attendance.read")) return denied();
  const decision = decideScope(actor, query);
  if (!decision.ok) return decision.error;
  const { summaries } = await loadSlice(
    { scope: decision.scope, departmentId: query.departmentId, employeeId: query.employeeId, q: query.q },
    query.from,
    query.to,
    false,
  );
  const sorted = sortSummaries(summaries, query.sort, query.direction);
  return {
    ok: true,
    data: {
      filename: `kehadiran-${query.from}-${query.to}.xlsx`,
      body: attendanceWorkbook(sorted, { includePin: !isCustomerViewer(actor) }),
    },
  };
}
