export type DashboardLinkState = {
  from: string;
  to: string;
  compareFrom?: string;
  compareTo?: string;
  departmentId?: string;
  employeeId?: string;
  q?: string;
  sort: string;
  direction: "asc" | "desc";
  page?: number;
  grain: "week" | "month";
};

export function dashboardHref(state: DashboardLinkState, patch: Partial<DashboardLinkState> = {}): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  params.set("from", next.from);
  params.set("to", next.to);
  if (next.compareFrom) params.set("compareFrom", next.compareFrom);
  if (next.compareTo) params.set("compareTo", next.compareTo);
  if (next.departmentId) params.set("departmentId", next.departmentId);
  if (next.employeeId) params.set("employeeId", next.employeeId);
  if (next.q) params.set("q", next.q);
  params.set("sort", next.sort);
  params.set("direction", next.direction);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  params.set("grain", next.grain);
  return `/dashboard?${params.toString()}`;
}

export function exportHref(state: DashboardLinkState): string {
  const page = dashboardHref(state).slice("/dashboard".length);
  return `/api/attendance/export${page}`;
}
