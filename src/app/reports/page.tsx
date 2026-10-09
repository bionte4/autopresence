import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { findDashboardEmployees, listDepartmentOptions } from "@/modules/dashboard/repo";
import { suggestPeriod } from "@/modules/dashboard/service";
import { can, isCustomerViewer, scopeFor } from "@/modules/rbac/policy";

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat laporan...</p>}>
      <ReportsContent />
    </Suspense>
  );
}

async function ReportsContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read") || isCustomerViewer(user)) forbidden();
  const scope = scopeFor(user);
  const [period, employees, departments] = await Promise.all([
    suggestPeriod(user),
    findDashboardEmployees({ scope }),
    listDepartmentOptions(scope),
  ]);
  const ownEmployee = employees.find((employee) => employee.id === user.employeeId) ?? null;

  return (
    <MasterFrame title="Laporan" user={user}>
      <p className="text-sm text-ink-2">Unduh Excel dari data yang sudah tersimpan. Angka dihitung ulang dari baris harian.</p>
      <form className="panel grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/api/attendance/export" method="get">
        <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Rekap kehadiran</h2>
        <PeriodFields from={period.from} to={period.to} />
        {departments.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            Departemen
            <select name="departmentId" className="field font-normal" defaultValue="">
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
          <select name="employeeId" className="field font-normal" defaultValue="">
            <option value="">Semua</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          Unduh Excel
        </button>
      </form>
      <form className="panel grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/api/timesheet/export" method="get">
        <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Timesheet</h2>
        <PeriodFields from={period.from} to={period.to} />
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Pegawai
          <select name="employeeId" required className="field font-normal" defaultValue={ownEmployee?.id ?? ""}>
            <option value="">Pilih</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={employees.length === 0}>
          Unduh Excel
        </button>
      </form>
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
