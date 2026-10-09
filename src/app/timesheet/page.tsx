import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ZodError } from "zod";
import { EmptyState } from "@/components/domain/empty-state";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate, formatMinutes } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { findDashboardEmployees } from "@/modules/dashboard/repo";
import { parseDashboardQuery } from "@/modules/dashboard/schema";
import { suggestPeriod } from "@/modules/dashboard/service";
import { firstParam } from "@/modules/master/query";
import { can, isCustomerViewer, scopeFor } from "@/modules/rbac/policy";
import { getTimesheet } from "@/modules/timesheet/service";

function clock(value: number | null): string {
  return value === null ? "—" : formatMinutes(value);
}

export default function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat timesheet...</p>}>
      <TimesheetContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TimesheetContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read") || isCustomerViewer(user)) forbidden();
  const raw = await searchParams;
  const scope = scopeFor(user);
  const employees = await findDashboardEmployees({ scope });
  const suggested = firstParam(raw.from) && firstParam(raw.to) ? null : await suggestPeriod(user);
  let period;
  try {
    period = parseDashboardQuery({
      from: firstParam(raw.from) ?? suggested?.from,
      to: firstParam(raw.to) ?? suggested?.to,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return (
        <MasterFrame title="Timesheet" user={user}>
          <p role="alert" className="text-sm text-danger">
            Periode tidak valid.
          </p>
        </MasterFrame>
      );
    }
    throw error;
  }
  const employeeId = firstParam(raw.employeeId) ?? user.employeeId ?? "";
  const selected = employees.find((employee) => employee.id === employeeId) ?? null;
  const sheet = selected ? await getTimesheet(user, selected.id, { from: period.from, to: period.to }) : null;
  if (sheet && !sheet.ok) forbidden();

  return (
    <MasterFrame title="Timesheet" user={user}>
      <form className="panel grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/timesheet">
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Dari
          <input type="date" name="from" required defaultValue={period.from} className="field" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Sampai
          <input type="date" name="to" required defaultValue={period.to} className="field" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Pegawai
          <select name="employeeId" required defaultValue={selected?.id ?? ""} className="field">
            <option value="">Pilih</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          Tampilkan
        </button>
      </form>
      {!selected || !sheet?.ok ? (
        <EmptyState title="Pilih pegawai untuk melihat timesheet." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              {sheet.data.employee.name} · {formatCalendarDate(period.from)} s.d. {formatCalendarDate(period.to)}
            </p>
            <a className="text-sm underline" href={`/api/timesheet/export?employeeId=${selected.id}&from=${period.from}&to=${period.to}`}>
              Unduh Excel
            </a>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-(--row-pad) pr-3 font-medium">Tanggal</th>
                  <th className="py-(--row-pad) pr-3 font-medium">Masuk</th>
                  <th className="py-(--row-pad) pr-3 font-medium">Keluar</th>
                  <th className="py-(--row-pad) pr-3 font-medium">Telat</th>
                  <th className="py-(--row-pad) pr-3 font-medium">Keterangan</th>
                  <th className="py-(--row-pad) font-medium">Lembur</th>
                </tr>
              </thead>
              <tbody>
                {sheet.data.days.map((day) => (
                  <tr key={day.date} className="border-b border-line">
                    <td className="py-(--row-pad) pr-3">{formatCalendarDate(day.date)}</td>
                    <td className="py-(--row-pad) pr-3">{clock(day.clockInMin)}</td>
                    <td className="py-(--row-pad) pr-3">{clock(day.clockOutMin)}</td>
                    <td className="py-(--row-pad) pr-3">{day.late ? formatMinutes(day.lateMin ?? 0) : "—"}</td>
                    <td className="py-(--row-pad) pr-3">{day.note ?? "—"}</td>
                    <td className="py-(--row-pad)">{day.overtimeMin === null ? "—" : formatMinutes(day.overtimeMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheet.data.days.length === 0 ? <EmptyState title="Tidak ada baris kehadiran pada periode ini." /> : null}
        </>
      )}
    </MasterFrame>
  );
}
