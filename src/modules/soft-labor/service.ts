import { findDashboardEmployees } from "@/modules/dashboard/repo";
import { denied, type ServiceResult } from "@/modules/master/result";
import { can, isCustomerViewer, scopeFor, type AuthUser, type DataScope } from "@/modules/rbac/policy";
import {
  buildSoftLaborReport,
  type OvertimeRow,
  type SoftSummary,
  type WeekRow,
} from "./aggregate";
import { findApprovedOvertimeMinutes, findSoftLaborDays } from "./repo";
import type { SoftLaborQuery } from "./schema";
import { softLaborWorkbook } from "./sheet";

export type SoftLaborReportDto = {
  from: string;
  to: string;
  summaries: SoftSummary[];
  weeks: WeekRow[];
  overtime: OvertimeRow[];
};

type ScopeDecision = { ok: true; scope: DataScope } | { ok: false; error: ServiceResult<never> };

function decideScope(actor: AuthUser, query: SoftLaborQuery): ScopeDecision {
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

async function loadSoftLaborReport(
  actor: AuthUser,
  query: SoftLaborQuery,
): Promise<ServiceResult<SoftLaborReportDto>> {
  if (!can(actor, "attendance.read") || isCustomerViewer(actor)) return denied();
  const decision = decideScope(actor, query);
  if (!decision.ok) return decision.error;
  const employees = await findDashboardEmployees({
    scope: decision.scope,
    departmentId: query.departmentId,
    employeeId: query.employeeId,
  });
  const ids = employees.map((employee) => employee.id);
  const [days, approved] = await Promise.all([
    findSoftLaborDays(ids, query.from, query.to),
    findApprovedOvertimeMinutes(ids, query.from, query.to),
  ]);
  const report = buildSoftLaborReport(
    employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      pin: employee.pin,
      departmentName: employee.department?.name ?? null,
    })),
    query.from,
    query.to,
    days,
    approved,
  );
  return { ok: true, data: { from: query.from, to: query.to, ...report } };
}

export async function previewSoftLabor(
  actor: AuthUser,
  query: SoftLaborQuery,
): Promise<ServiceResult<SoftLaborReportDto>> {
  return loadSoftLaborReport(actor, query);
}

export async function exportSoftLaborWorkbook(
  actor: AuthUser,
  query: SoftLaborQuery,
): Promise<ServiceResult<{ filename: string; body: Buffer }>> {
  const loaded = await loadSoftLaborReport(actor, query);
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    data: {
      filename: `laporan-lembur-${query.from}-${query.to}.xlsx`,
      body: softLaborWorkbook(loaded.data),
    },
  };
}
