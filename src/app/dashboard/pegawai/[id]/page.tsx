import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { ZodError } from "zod";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate, formatMinutes } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { parseDashboardQuery } from "@/modules/dashboard/schema";
import { getEmployeeDashboard, suggestPeriod } from "@/modules/dashboard/service";
import { Heatmap } from "../../heatmap";

function clock(value: number | null): string {
  return value === null ? "—" : formatMinutes(value);
}

export default function EmployeeDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pegawai...</p>}>
      <EmployeeContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeeContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read")) forbidden();
  const { id } = await params;
  const raw = await searchParams;
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
        <MasterFrame title="Detail pegawai" user={user}>
          <p role="alert" className="text-sm text-danger">
            Periode tidak valid.
          </p>
        </MasterFrame>
      );
    }
    throw error;
  }
  const result = await getEmployeeDashboard(user, id, { from: period.from, to: period.to });
  if (!result.ok) {
    if (result.status === 404) notFound();
    forbidden();
  }
  const data = result.data;

  return (
    <MasterFrame title={data.employee.name} user={user}>
      <p className="text-sm text-ink-2">
        PIN {data.employee.pin} · {data.employee.departmentName ?? "Tanpa departemen"} · {formatCalendarDate(data.period.from)} s.d.{" "}
        {formatCalendarDate(data.period.to)}
      </p>
      <Link href={`/dashboard?from=${data.period.from}&to=${data.period.to}`} className="text-sm underline">
        Kembali ke dasbor
      </Link>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <li className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs text-ink-2">Kejadian terlambat</p>
          <p className="text-xl font-semibold">{data.kpis.lateEvents}</p>
        </li>
        <li className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs text-ink-2">Total jam telat</p>
          <p className="text-xl font-semibold">{formatMinutes(data.kpis.lateMinutes)}</p>
        </li>
        <li className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs text-ink-2">Kurang presensi</p>
          <p className="text-xl font-semibold">{data.kpis.missingPunch}</p>
        </li>
      </ul>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Kalender keterlambatan</h2>
        <Heatmap cells={data.heatmap} />
      </section>
      {data.days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">Tidak ada baris absensi pada periode ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">Tanggal</th>
                <th className="py-2 pr-3 font-medium">Masuk</th>
                <th className="py-2 pr-3 font-medium">Keluar</th>
                <th className="py-2 pr-3 font-medium">Telat</th>
                <th className="py-2 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.date} className="border-b border-line">
                  <td className="py-2 pr-3">{formatCalendarDate(day.date)}</td>
                  <td className="py-2 pr-3">{clock(day.clockInMin)}</td>
                  <td className="py-2 pr-3">{clock(day.clockOutMin)}</td>
                  <td className="py-2 pr-3">{day.lateMin === null ? "—" : formatMinutes(day.lateMin)}</td>
                  <td className="py-2">{day.note ?? (day.late ? "Terlambat" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MasterFrame>
  );
}
