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
import { dashboardHref, exportHref, type DashboardLinkState } from "./links";
import { TrendChart } from "./trend-chart";

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
  const kpis = [
    ["Pegawai", String(data.kpis.employees)],
    ["Kejadian terlambat", String(data.kpis.lateEvents)],
    ["Total jam telat", formatMinutes(data.kpis.lateMinutes)],
    ["Kurang presensi", String(data.kpis.missingPunch)],
    ["Tanpa keterangan", String(data.kpis.noReason)],
    ["Anomali terbuka", String(data.kpis.openAnomalies)],
  ] as const;

  return (
    <MasterFrame title="Dasbor" user={user}>
      <form className="panel flex flex-col gap-3" action="/dashboard">
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
          <button type="submit" className="btn btn-primary w-full">
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
            ? { href: "/anomalies", label: "Tinjau anomali" }
            : undefined
        }
      />

      <dl className="grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(([label, value]) => (
          <div key={label} className="border-b border-r border-line px-4 py-(--row-pad)">
            <dt className="text-xs leading-5 text-ink-2">{label}</dt>
            <dd className="text-xl font-semibold">{value}</dd>
          </div>
        ))}
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

      {data.rows.some((row) => row.lateCount > 0) ? (
        <section className="panel">
          <h2 className="font-semibold">Peringkat keterlambatan</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {[...data.rows]
              .filter((row) => row.lateCount > 0)
              .sort((left, right) => right.lateMinutes - left.lateMinutes)
              .slice(0, 5)
              .map((row) => {
                const max = Math.max(...data.rows.map((item) => item.lateMinutes), 1);
                const width = Math.max(8, Math.round((row.lateMinutes / max) * 100));
                return (
                  <li key={row.employeeId} className="grid items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_auto]">
                    <span className="truncate font-semibold">{row.name}</span>
                    <span className="h-2 rounded-full bg-surface-2">
                      <span className="block h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </span>
                    <span className="text-ink-2">
                      {row.lateCount} kali, {formatMinutes(row.lateMinutes)}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tren keterlambatan</h2>
          <div className="flex gap-3 text-sm">
            <Link href={dashboardHref(state, { grain: "week", page: 1 })} className="underline">
              Mingguan{query.grain === "week" ? " ·" : ""}
            </Link>
            <Link href={dashboardHref(state, { grain: "month", page: 1 })} className="underline">
              Bulanan{query.grain === "month" ? " ·" : ""}
            </Link>
          </div>
        </div>
        <TrendChart data={data.trend} />
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Lihat sebagai tabel</summary>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">Tren keterlambatan</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-(--row-pad)">Periode</th>
                <th scope="col" className="py-(--row-pad)">Kejadian</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((point) => (
                <tr key={point.bucket} className="border-b border-line">
                  <td className="py-(--row-pad)">{point.bucket}</td>
                  <td className="py-(--row-pad)">{point.lateEvents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {data.heatmap ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Kalender keterlambatan</h2>
          <Heatmap cells={data.heatmap} />
        </section>
      ) : (
        <p className="text-sm text-ink-2">Pilih satu pegawai untuk melihat kalender keterlambatan.</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ringkasan pegawai</h2>
        <a href={exportHref(state)} className="text-sm underline">
          Unduh Excel
        </a>
      </div>
      {data.total === 0 ? (
        <EmptyState title="Tidak ada pegawai pada filter ini. Hapus pencarian atau perluas periode." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-(--row-pad) pr-3 font-medium">Nama</th>
                <th className="py-(--row-pad) pr-3 font-medium">Telat</th>
                <th className="py-(--row-pad) pr-3 font-medium">Total</th>
                <th className="py-(--row-pad) pr-3 font-medium">Kurang presensi</th>
                <th className="py-(--row-pad) font-medium">Tanpa keterangan</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.employeeId} className="border-b border-line">
                  <td className="py-(--row-pad) pr-3">
                    <Link href={`/dashboard/pegawai/${row.employeeId}?from=${data.period.from}&to=${data.period.to}`} className="underline">
                      {row.name}
                    </Link>
                    <span className="block text-xs text-ink-2">{row.departmentName ?? "Tanpa departemen"}</span>
                  </td>
                  <td className="py-(--row-pad) pr-3">{row.lateCount}</td>
                  <td className="py-(--row-pad) pr-3">{formatMinutes(row.lateMinutes)}</td>
                  <td className="py-(--row-pad) pr-3">{row.missingPunch}</td>
                  <td className="py-(--row-pad)">{row.noReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        {(
          [
            ["name", "nama"],
            ["lateCount", "telat"],
            ["lateMinutes", "total menit"],
            ["missingPunch", "kurang presensi"],
            ["noReason", "tanpa keterangan"],
          ] as const
        ).map(([sort, label]) => (
          <Link
            key={sort}
            href={dashboardHref(state, { sort, direction: query.sort === sort && query.direction === "asc" ? "desc" : "asc", page: 1 })}
            className="underline"
          >
            Urutkan {label}
            {query.sort === sort ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
          </Link>
        ))}
      </div>
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
