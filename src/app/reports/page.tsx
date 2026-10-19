import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { MasterFrame } from "@/app/master/master-frame";
import { AttendancePreview, SoftLaborPreview, TimesheetPreview, exportHrefFor } from "@/app/reports/previews";
import { getCurrentUser } from "@/modules/auth/current-user";
import { findDashboardEmployees, listDepartmentOptions } from "@/modules/dashboard/repo";
import { dashboardQuerySchema, type DashboardQuery } from "@/modules/dashboard/schema";
import { previewAttendance, suggestPeriod } from "@/modules/dashboard/service";
import { firstParam } from "@/modules/master/query";
import { can, isCustomerViewer, scopeFor } from "@/modules/rbac/policy";
import { softLaborQuerySchema, type SoftLaborQuery } from "@/modules/soft-labor/schema";
import { previewSoftLabor } from "@/modules/soft-labor/service";
import { getTimesheet } from "@/modules/timesheet/service";

type ReportKind = "attendance" | "timesheet" | "soft-labor";

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat laporan...</p>}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read") || isCustomerViewer(user)) forbidden();
  const scope = scopeFor(user);
  const raw = await searchParams;
  const kind = parseReportKind(raw);
  const [period, employees, departments] = await Promise.all([
    suggestPeriod(user),
    findDashboardEmployees({ scope }),
    listDepartmentOptions(scope),
  ]);
  const ownEmployee = employees.find((employee) => employee.id === user.employeeId) ?? null;

  const attendanceQuery = kind === "attendance" ? parseDashboardPreview(raw, period) : null;
  const timesheetQuery = kind === "timesheet" ? parseTimesheetPreview(raw, period) : null;
  const softQuery = kind === "soft-labor" ? parseSoftPreviewQuery(raw, period) : null;

  const attendancePreview =
    attendanceQuery && !attendanceQuery.error ? await previewAttendance(user, attendanceQuery.query) : null;
  if (attendancePreview && !attendancePreview.ok) forbidden();

  const timesheetPreview =
    timesheetQuery && !timesheetQuery.error && timesheetQuery.query.employeeId
      ? await getTimesheet(user, timesheetQuery.query.employeeId, {
          from: timesheetQuery.query.from,
          to: timesheetQuery.query.to,
        })
      : null;
  if (timesheetPreview && !timesheetPreview.ok) forbidden();

  const softPreview = softQuery && !softQuery.error ? await previewSoftLabor(user, softQuery.query) : null;
  if (softPreview && !softPreview.ok) forbidden();

  const attendanceDefaults = attendanceQuery?.query ?? { from: period.from, to: period.to };
  const timesheetDefaults = timesheetQuery?.query ?? {
    from: period.from,
    to: period.to,
    employeeId: ownEmployee?.id ?? "",
  };
  const softDefaults = softQuery?.query ?? { from: period.from, to: period.to };

  return (
    <MasterFrame title="Laporan" user={user}>
      <p className="text-sm text-ink-2">
        Pratinjau dulu di layar, lalu unduh Excel dari data yang sudah tersimpan. Angka dihitung ulang dari baris
        harian.
      </p>

      <form className="panel grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/reports" method="get">
        <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Rekap kehadiran</h2>
        <input type="hidden" name="report" value="attendance" />
        <PeriodFields from={attendanceDefaults.from} to={attendanceDefaults.to} />
        {departments.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            Departemen
            <select
              name="departmentId"
              className="field font-normal"
              defaultValue={"departmentId" in attendanceDefaults ? (attendanceDefaults.departmentId ?? "") : ""}
            >
              <option value="">Semua</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Pegawai
          <select
            name="employeeId"
            className="field font-normal"
            defaultValue={"employeeId" in attendanceDefaults ? (attendanceDefaults.employeeId ?? "") : ""}
          >
            <option value="">Semua</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn btn-primary">
            Pratinjau
          </button>
          <button type="submit" className="btn" formAction="/api/attendance/export">
            Unduh Excel
          </button>
        </div>
        {attendanceQuery?.error ? (
          <p className="text-sm text-danger sm:col-span-2 lg:col-span-4">{attendanceQuery.error}</p>
        ) : null}
      </form>

      <form className="panel grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/reports" method="get">
        <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Timesheet</h2>
        <input type="hidden" name="report" value="timesheet" />
        <PeriodFields from={timesheetDefaults.from} to={timesheetDefaults.to} />
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Pegawai
          <select
            name="employeeId"
            required
            className="field font-normal"
            defaultValue={timesheetDefaults.employeeId ?? ""}
          >
            <option value="">Pilih</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn btn-primary" disabled={employees.length === 0}>
            Pratinjau
          </button>
          <button
            type="submit"
            className="btn"
            formAction="/api/timesheet/export"
            disabled={employees.length === 0}
          >
            Unduh Excel
          </button>
        </div>
        {timesheetQuery?.error ? (
          <p className="text-sm text-danger sm:col-span-2 lg:col-span-4">{timesheetQuery.error}</p>
        ) : null}
      </form>

      <form className="panel grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/reports" method="get">
        <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Laporan lembur (pembinaan)</h2>
        <p className="text-xs text-ink-2 sm:col-span-2 lg:col-span-4">
          Bahan diskusi internal: jam aktual vs acuan 40 jam/minggu, rentetan kerja tanpa istirahat tercatat, dan
          lembur teramati vs pengajuan yang disetujui. Bukan putusan hukum atau sanksi otomatis.
        </p>
        <input type="hidden" name="report" value="soft-labor" />
        <PeriodFields from={softDefaults.from} to={softDefaults.to} />
        {departments.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            Departemen
            <select
              name="departmentId"
              className="field font-normal"
              defaultValue={"departmentId" in softDefaults ? (softDefaults.departmentId ?? "") : ""}
            >
              <option value="">Semua</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Pegawai
          <select
            name="employeeId"
            className="field font-normal"
            defaultValue={"employeeId" in softDefaults ? (softDefaults.employeeId ?? "") : ""}
          >
            <option value="">Semua</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn btn-primary">
            Pratinjau
          </button>
          <button type="submit" className="btn" formAction="/api/reports/soft-labor/export">
            Unduh Excel
          </button>
        </div>
        {softQuery?.error ? <p className="text-sm text-danger sm:col-span-2 lg:col-span-4">{softQuery.error}</p> : null}
      </form>

      {attendancePreview?.ok && attendanceQuery && !attendanceQuery.error ? (
        <AttendancePreview
          data={attendancePreview.data}
          exportHref={exportHrefFor("attendance", attendanceQuery.query)}
        />
      ) : null}
      {timesheetPreview?.ok && timesheetQuery && !timesheetQuery.error && timesheetQuery.query.employeeId ? (
        <TimesheetPreview
          data={timesheetPreview.data}
          from={timesheetQuery.query.from}
          to={timesheetQuery.query.to}
          exportHref={exportHrefFor("timesheet", timesheetQuery.query)}
        />
      ) : null}
      {softPreview?.ok && softQuery && !softQuery.error ? (
        <SoftLaborPreview report={softPreview.data} query={softQuery.query} />
      ) : null}
    </MasterFrame>
  );
}

function PeriodFields({ from, to }: { from: string; to: string }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Dari
        <input type="date" name="from" required defaultValue={from} className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Sampai
        <input type="date" name="to" required defaultValue={to} className="field font-normal" />
      </label>
    </>
  );
}

function parseReportKind(raw: Record<string, string | string[] | undefined>): ReportKind | null {
  const value = firstParam(raw.report);
  if (value === "attendance" || value === "timesheet" || value === "soft-labor") return value;
  if (firstParam(raw.softLabor) === "1") return "soft-labor";
  return null;
}

function periodError(): string {
  return "Periode pratinjau tidak valid. Periksa tanggal Dari dan Sampai (maks. 366 hari).";
}

function parseDashboardPreview(
  raw: Record<string, string | string[] | undefined>,
  fallback: { from: string; to: string },
): { query: DashboardQuery; error?: undefined } | { query: DashboardQuery; error: string } {
  const parsed = dashboardQuerySchema.safeParse({
    from: firstParam(raw.from) || fallback.from,
    to: firstParam(raw.to) || fallback.to,
    departmentId: firstParam(raw.departmentId) || undefined,
    employeeId: firstParam(raw.employeeId) || undefined,
  });
  if (!parsed.success) {
    return {
      query: dashboardQuerySchema.parse({ from: fallback.from, to: fallback.to }),
      error: periodError(),
    };
  }
  return { query: parsed.data };
}

function parseTimesheetPreview(
  raw: Record<string, string | string[] | undefined>,
  fallback: { from: string; to: string },
): {
  query: { from: string; to: string; employeeId: string };
  error?: undefined;
} | {
  query: { from: string; to: string; employeeId: string };
  error: string;
} {
  const employeeId = firstParam(raw.employeeId)?.trim() ?? "";
  const parsed = dashboardQuerySchema.safeParse({
    from: firstParam(raw.from) || fallback.from,
    to: firstParam(raw.to) || fallback.to,
    employeeId: employeeId || undefined,
  });
  if (!parsed.success) {
    return { query: { from: fallback.from, to: fallback.to, employeeId }, error: periodError() };
  }
  if (!employeeId) {
    return {
      query: { from: parsed.data.from, to: parsed.data.to, employeeId: "" },
      error: "Pilih pegawai untuk pratinjau timesheet.",
    };
  }
  return { query: { from: parsed.data.from, to: parsed.data.to, employeeId } };
}

function parseSoftPreviewQuery(
  raw: Record<string, string | string[] | undefined>,
  fallback: { from: string; to: string },
): { query: SoftLaborQuery; error?: undefined } | { query: SoftLaborQuery; error: string } {
  const parsed = softLaborQuerySchema.safeParse({
    from: firstParam(raw.from) || fallback.from,
    to: firstParam(raw.to) || fallback.to,
    departmentId: firstParam(raw.departmentId) || undefined,
    employeeId: firstParam(raw.employeeId) || undefined,
  });
  if (!parsed.success) {
    return { query: { from: fallback.from, to: fallback.to }, error: periodError() };
  }
  return { query: parsed.data };
}
