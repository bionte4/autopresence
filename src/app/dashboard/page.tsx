import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ZodError } from "zod";
import { EmptyState } from "@/components/domain/empty-state";
import { IntegritySeal } from "@/components/domain/integrity-seal";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate, formatDateTime, formatMinutes } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { parseDashboardQuery } from "@/modules/dashboard/schema";
import { getDashboard, suggestPeriod } from "@/modules/dashboard/service";
import { Heatmap } from "./heatmap";
import { dashboardHref, exportHref, openAnomalyHref, type DashboardLinkState } from "./links";
import { TrendChart } from "./trend-chart";
import { trendAxisLabel } from "./trend-label";

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat dasbor...</p>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read")) forbidden();
  const raw = await searchParams;
  const suggested = firstParam(raw.from) && firstParam(raw.to) ? null : await suggestPeriod(user);
  let query;
  try {
    query = parseDashboardQuery({
      from: firstParam(raw.from) ?? suggested?.from,
      to: firstParam(raw.to) ?? suggested?.to,
      compareFrom: firstParam(raw.compareFrom),
      compareTo: firstParam(raw.compareTo),
      departmentId: firstParam(raw.departmentId),
      employeeId: firstParam(raw.employeeId),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction),
      page: firstParam(raw.page),
      grain: firstParam(raw.grain),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return (
        <MasterFrame title="Dasbor" user={user}>
          <p role="alert" className="text-sm text-danger">
            Filter periode tidak valid. Gunakan tanggal dan rentang paling lama 366 hari.
          </p>
        </MasterFrame>
      );
    }
    throw error;
  }
  const result = await getDashboard(user, query);
  if (!result.ok) forbidden();
  const data = result.data;
  const state: DashboardLinkState = {
    from: data.period.from,
    to: data.period.to,
    compareFrom: data.compare?.from,
    compareTo: data.compare?.to,
    departmentId: query.departmentId,
    employeeId: query.employeeId,
    q: query.q,
    sort: query.sort,
    direction: query.direction,
    grain: query.grain,
  };
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const summary = "#ringkasan";
  const sortedSummary = (sort: DashboardLinkState["sort"]) => `${dashboardHref(state, { sort, direction: "desc", page: 1 })}${summary}`;
  const anomalyHref = can(user, "anomaly.read") ? openAnomalyHref(state) : undefined;
  const kpis = [
    { label: "Pegawai", value: String(data.kpis.employees), href: data.kpis.employees > 0 ? summary : undefined },
    { label: "Kejadian terlambat", value: String(data.kpis.lateEvents), href: data.kpis.lateEvents > 0 ? sortedSummary("lateCount") : undefined },
    { label: "Total jam telat", value: formatMinutes(data.kpis.lateMinutes), href: data.kpis.lateMinutes > 0 ? sortedSummary("lateMinutes") : undefined },
    { label: "Kurang presensi", value: String(data.kpis.missingPunch), href: data.kpis.missingPunch > 0 ? sortedSummary("missingPunch") : undefined },
    { label: "Tanpa keterangan", value: String(data.kpis.noReason), href: data.kpis.noReason > 0 ? sortedSummary("noReason") : undefined },
    { label: "Anomali terbuka", value: String(data.kpis.openAnomalies), href: data.kpis.openAnomalies > 0 ? anomalyHref : undefined },
  ];

  return (
    <MasterFrame title="Dasbor" user={user}>
      <form className="panel flex flex-col gap-3" action="/dashboard">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold">
            {formatCalendarDate(data.period.from)} s.d. {formatCalendarDate(data.period.to)}
          </p>
          {can(user, "upload.create") ? (
            <Link href="/uploads" className="text-sm font-semibold text-primary">
              Unggah laporan
            </Link>
          ) : null}
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Dari
          <input type="date" name="from" required defaultValue={data.period.from} className="field" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Sampai
          <input type="date" name="to" required defaultValue={data.period.to} className="field" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Cari
          <input name="q" defaultValue={query.q} placeholder="Nama pegawai" className="field" />
        </label>
        {data.departments.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            Departemen
            <select name="departmentId" defaultValue={query.departmentId ?? ""} className="field">
              <option value="">Semua</option>
              {data.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Pegawai
          <select name="employeeId" defaultValue={query.employeeId ?? ""} className="field">
            <option value="">Semua</option>
            {data.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full sm:w-auto">
            Terapkan
          </button>
        </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-ink-2">Bandingkan periode</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-ink-2">
              Pembanding dari
              <input type="date" name="compareFrom" defaultValue={data.compare?.from ?? ""} className="field" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-2">
              Pembanding sampai
              <input type="date" name="compareTo" defaultValue={data.compare?.to ?? ""} className="field" />
            </label>
          </div>
        </details>
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="direction" value={query.direction} />
        <input type="hidden" name="grain" value={query.grain} />
      </form>

      <IntegritySeal
        tone={data.kpis.openAnomalies > 0 ? "warn" : data.integrity ? "ok" : "warn"}
        title={
          data.kpis.openAnomalies > 0
            ? `${data.kpis.openAnomalies} anomali perlu ditinjau`
            : data.integrity
              ? "Data terverifikasi"
              : "Belum ada laporan pada cakupan ini"
        }
        detail={
          data.integrity
            ? `Unggah terakhir ${formatDateTime(data.integrity.uploadedAt)}`
            : "Unggah laporan untuk melihat perhitungan keterlambatan."
        }
        hash={data.integrity?.sha256}
        action={
          data.kpis.openAnomalies > 0 && can(user, "anomaly.read")
            ? { href: anomalyHref ?? "/anomalies", label: "Tinjau anomali" }
            : undefined
        }
      />

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi, index) => {
          const alert = kpi.label === "Anomali terbuka" && data.kpis.openAnomalies > 0;
          const right = index % 2 === 0 ? "border-r" : "border-r-0";
          const bottom = index < 4 ? "border-b" : "border-b-0";
          const smRight = index % 3 === 2 ? "sm:border-r-0" : "sm:border-r";
          const smBottom = index < 3 ? "sm:border-b" : "sm:border-b-0";
          const lgRight = index === 5 ? "lg:border-r-0" : "lg:border-r";
          const figure = kpi.href ? (
            <Link href={kpi.href} className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:underline">
              {kpi.value}
            </Link>
          ) : (
            kpi.value
          );
          return (
            <div key={kpi.label} className={`border-line px-4 py-4 ${right} ${bottom} ${smRight} ${smBottom} ${lgRight} lg:border-b-0 ${alert ? "bg-danger-soft" : ""}`}>
              <dt className="text-xs leading-5 text-ink-2">{kpi.label}</dt>
              <dd className={`text-2xl font-semibold tabular-nums tracking-tight ${alert ? "text-danger" : ""}`}>{figure}</dd>
            </div>
          );
        })}
      </dl>

      {data.comparison && data.compare ? (
        <section className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <h2 className="font-medium">Perbandingan {formatCalendarDate(data.compare.from)} – {formatCalendarDate(data.compare.to)}</h2>
          <p className="mt-1 text-ink-2">
            {data.comparison.lateEvents} kejadian terlambat ({formatMinutes(data.comparison.lateMinutes)}), selisih{" "}
            {data.comparison.lateEvents - data.kpis.lateEvents} kejadian terhadap periode ini.
          </p>
        </section>
      ) : null}

      <div className="grid items-start gap-(--stack) xl:grid-cols-2">
      {data.ranking.length > 0 ? (
        <section className="panel min-w-0">
          <h2 className="font-semibold">Peringkat keterlambatan</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {data.ranking.map((row, index) => {
                const max = Math.max(data.ranking[0]?.lateMinutes ?? 1, 1);
                const width = Math.max(8, Math.round((row.lateMinutes / max) * 100));
                return (
                  <li key={row.employeeId} className="grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1.5 text-sm">
                    <span className="text-xs tabular-nums text-ink-2">{index + 1}</span>
                    <span className="min-w-0">
                      <Link href={`/dashboard/pegawai/${row.employeeId}?from=${data.period.from}&to=${data.period.to}`} className="block truncate font-semibold">
                        {row.name}
                      </Link>
                      <span className="block truncate text-xs text-ink-2">{row.departmentName ?? "Tanpa departemen"}</span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="block font-semibold">{row.lateCount} kali</span>
                      <span className="text-xs text-ink-2">{formatMinutes(row.lateMinutes)}</span>
                    </span>
                    <span className="col-span-3 h-1.5 rounded-full bg-surface-2">
                      <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      <section className="panel flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Tren keterlambatan</h2>
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            <Link
              href={dashboardHref(state, { grain: "week", page: 1 })}
              className={`rounded-md px-2 py-1 ${query.grain === "week" ? "bg-primary-soft font-semibold text-primary" : "text-ink-2"}`}
              aria-current={query.grain === "week" ? "true" : undefined}
            >
              Mingguan
            </Link>
            <Link
              href={dashboardHref(state, { grain: "month", page: 1 })}
              className={`rounded-md px-2 py-1 ${query.grain === "month" ? "bg-primary-soft font-semibold text-primary" : "text-ink-2"}`}
              aria-current={query.grain === "month" ? "true" : undefined}
            >
              Bulanan
            </Link>
          </div>
        </div>
        <TrendChart data={data.trend} />
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-ink-2">Lihat sebagai tabel</summary>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">Tren keterlambatan</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2">Periode</th>
                <th scope="col" className="py-2">Kejadian</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((point) => (
                <tr key={point.bucket} className="border-b border-line">
                  <td className="py-2">{trendAxisLabel(point.bucket)}</td>
                  <td className="py-2">{point.lateEvents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      </div>

      {data.heatmap ? (
        <section className="panel flex flex-col gap-3">
          <h2 className="font-semibold">Kalender keterlambatan</h2>
          <Heatmap cells={data.heatmap} />
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm text-ink-2">
          Pilih satu pegawai untuk melihat kalender keterlambatan.
        </p>
      )}

      <div id="ringkasan" className="flex scroll-mt-24 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ringkasan pegawai</h2>
          <p className="text-sm text-ink-2">{data.total} pegawai</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap rounded-lg border border-line p-0.5 text-sm">
            {(
              [
                ["name", "Nama"],
                ["lateCount", "Telat"],
                ["lateMinutes", "Total"],
                ["missingPunch", "Kurang presensi"],
                ["noReason", "Tanpa keterangan"],
              ] as const
            ).map(([sort, label]) => (
              <Link
                key={sort}
                href={dashboardHref(state, { sort, direction: query.sort === sort && query.direction === "asc" ? "desc" : "asc", page: 1 })}
                className={`rounded-md px-2 py-1 ${query.sort === sort ? "bg-primary-soft font-semibold text-primary" : "text-ink-2"}`}
                aria-current={query.sort === sort ? "true" : undefined}
              >
                {label}
                {query.sort === sort ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
              </Link>
            ))}
          </div>
          <a href={exportHref(state)} className="text-sm font-semibold text-primary">
            Unduh Excel
          </a>
        </div>
      </div>
      {data.total === 0 ? (
        <EmptyState title="Tidak ada pegawai pada filter ini. Hapus pencarian atau perluas periode." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-xs text-ink-2">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 text-right font-medium">Telat</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Kurang presensi</th>
                <th className="px-4 py-3 text-right font-medium">Tanpa keterangan</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.employeeId} className="border-b border-line last:border-b-0 hover:bg-surface-2">
                  <td className="px-4 py-(--row-pad)">
                    <Link href={`/dashboard/pegawai/${row.employeeId}?from=${data.period.from}&to=${data.period.to}`} className="font-semibold text-ink">
                      {row.name}
                    </Link>
                    <span className="block text-xs text-ink-2">{row.departmentName ?? "Tanpa departemen"}</span>
                  </td>
                  <td className={`px-4 py-(--row-pad) text-right tabular-nums ${row.lateCount === 0 ? "text-ink-2" : "font-semibold"}`}>{row.lateCount}</td>
                  <td className={`px-4 py-(--row-pad) text-right tabular-nums ${row.lateMinutes === 0 ? "text-ink-2" : "font-semibold"}`}>{formatMinutes(row.lateMinutes)}</td>
                  <td className={`px-4 py-(--row-pad) text-right tabular-nums ${row.missingPunch === 0 ? "text-ink-2" : "font-semibold"}`}>{row.missingPunch}</td>
                  <td className={`px-4 py-(--row-pad) text-right tabular-nums ${row.noReason === 0 ? "text-ink-2" : "font-semibold"}`}>{row.noReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="flex items-center justify-between text-sm" aria-label="Halaman">
        <span>
          Halaman {data.page} dari {pageCount} ({data.total} data)
        </span>
        <div className="flex gap-3">
          {data.page > 1 ? <Link href={dashboardHref(state, { page: data.page - 1 })}>Sebelumnya</Link> : null}
          {data.page < pageCount ? <Link href={dashboardHref(state, { page: data.page + 1 })}>Berikutnya</Link> : null}
        </div>
      </nav>
    </MasterFrame>
  );
}
