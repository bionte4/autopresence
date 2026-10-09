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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">
          {user.role === "CUSTOMER" ? "" : `PIN ${data.employee.pin} · `}
          {data.employee.departmentName ?? "Tanpa departemen"} · {formatCalendarDate(data.period.from)} s.d.{" "}
          {formatCalendarDate(data.period.to)}
        </p>
        <Link href={`/dashboard?from=${data.period.from}&to=${data.period.to}`} className="text-sm font-semibold text-primary">
          Kembali ke dasbor
        </Link>
      </div>
      <dl className="grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-3">
        {(
          [
            ["Kejadian terlambat", String(data.kpis.lateEvents)],
            ["Total jam telat", formatMinutes(data.kpis.lateMinutes)],
            ["Kurang presensi", String(data.kpis.missingPunch)],
          ] as const
        ).map(([label, value], index) => (
          <div
            key={label}
            className={`border-line px-4 py-4 ${index === 2 ? "border-b-0" : "border-b"} sm:border-b-0 ${index === 2 ? "sm:border-r-0" : "sm:border-r"}`}
          >
            <dt className="text-xs leading-5 text-ink-2">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="panel flex flex-col gap-3">
        <h2 className="font-semibold">Kalender keterlambatan</h2>
        <Heatmap
          cells={data.heatmap}
          anomalyDates={data.anomalyDates}
          anomalyHref={
            can(user, "anomaly.read")
              ? (date) => `/anomalies?employeeId=${id}&from=${date}&to=${date}&dated=1`
              : undefined
          }
        />
        {data.anomalyDates.length > 0 ? (
          <p className="text-xs text-ink-2">Titik menandai hari yang punya anomali. Klik hari itu untuk membuka daftarnya.</p>
        ) : null}
      </section>
      {data.days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm text-ink-2">Tidak ada baris absensi pada periode ini.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-xs text-ink-2">
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Masuk</th>
                <th className="px-4 py-3 font-medium">Keluar</th>
                <th className="px-4 py-3 text-right font-medium">Telat</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.date} className="border-b border-line last:border-b-0 hover:bg-surface-2">
                  <td className="px-4 py-(--row-pad)">{formatCalendarDate(day.date)}</td>
                  <td className="px-4 py-(--row-pad) tabular-nums">{clock(day.clockInMin)}</td>
                  <td className="px-4 py-(--row-pad) tabular-nums">{clock(day.clockOutMin)}</td>
                  <td className={`px-4 py-(--row-pad) text-right tabular-nums ${day.lateMin ? "font-semibold" : "text-ink-2"}`}>
                    {day.lateMin === null ? "—" : formatMinutes(day.lateMin)}
                  </td>
                  <td className="px-4 py-(--row-pad)">{day.note ?? (day.late ? "Terlambat" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MasterFrame>
  );
}
