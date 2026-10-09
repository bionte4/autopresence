import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ZodError } from "zod";
import { EmptyState } from "@/components/domain/empty-state";
import { SeverityBadge } from "@/components/domain/severity-badge";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate } from "@/lib/format";
import { ANOMALY_STATUS_LABEL, ANOMALY_TYPE_LABEL, SEVERITY_LABEL } from "@/modules/anomalies/labels";
import { parseAnomalyListQuery, type AnomalyListQuery } from "@/modules/anomalies/schema";
import { listAnomalyPage } from "@/modules/anomalies/service";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";

const TYPES = Object.entries(ANOMALY_TYPE_LABEL);
const STATUSES = Object.entries(ANOMALY_STATUS_LABEL);
const SEVERITIES = Object.entries(SEVERITY_LABEL);

function pageHref(query: AnomalyListQuery, patch: Partial<AnomalyListQuery>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.severity) params.set("severity", next.severity);
  if (next.type) params.set("type", next.type);
  if (next.employeeId) params.set("employeeId", next.employeeId);
  if (next.departmentId) params.set("departmentId", next.departmentId);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.dated) params.set("dated", "1");
  params.set("sort", next.sort);
  params.set("direction", next.direction);
  if (next.page > 1) params.set("page", String(next.page));
  return `/anomalies?${params.toString()}`;
}

export default function AnomaliesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat anomali...</p>}>
      <AnomaliesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AnomaliesContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "anomaly.read")) forbidden();
  const raw = await searchParams;
  let query: AnomalyListQuery;
  try {
    query = parseAnomalyListQuery({
      page: firstParam(raw.page),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction),
      status: firstParam(raw.status),
      severity: firstParam(raw.severity),
      type: firstParam(raw.type),
      employeeId: firstParam(raw.employeeId),
      departmentId: firstParam(raw.departmentId),
      from: firstParam(raw.from),
      to: firstParam(raw.to),
      dated: firstParam(raw.dated),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return (
        <MasterFrame title="Anomali" user={user}>
          <p role="alert" className="text-sm text-danger">Filter tidak valid.</p>
        </MasterFrame>
      );
    }
    throw error;
  }
  const result = await listAnomalyPage(user, query);
  if (!result.ok) forbidden();
  const data = result.data;
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <MasterFrame title="Anomali" user={user}>
      <form className="panel grid gap-3 sm:grid-cols-2 lg:grid-cols-3" action="/anomalies">
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Cari
          <input name="q" defaultValue={query.q} className="field font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Status
          <select name="status" defaultValue={query.status ?? ""} className="field font-normal">
            <option value="">Semua</option>
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Tingkat
          <select name="severity" defaultValue={query.severity ?? ""} className="field font-normal">
            <option value="">Semua</option>
            {SEVERITIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Jenis
          <select name="type" defaultValue={query.type ?? ""} className="field font-normal">
            <option value="">Semua</option>
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {data.employees.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            Pegawai
            <select name="employeeId" defaultValue={query.employeeId ?? ""} className="field font-normal">
              <option value="">Semua</option>
              {data.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Dari
          <input type="date" name="from" defaultValue={query.from ?? ""} className="field font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Sampai
          <input type="date" name="to" defaultValue={query.to ?? ""} className="field font-normal" />
        </label>
        {query.departmentId ? <input type="hidden" name="departmentId" value={query.departmentId} /> : null}
        {query.dated ? <input type="hidden" name="dated" value="1" /> : null}
        <button type="submit" className="btn justify-self-start self-end">Terapkan</button>
      </form>
      {data.total === 0 ? (
        <EmptyState title="Tidak ada anomali pada filter ini." />
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">{data.total} anomali</p>
            <div className="flex rounded-lg border border-line p-0.5 text-sm">
              <Link
                href={pageHref(query, { sort: "createdAt", direction: query.sort === "createdAt" && query.direction === "desc" ? "asc" : "desc", page: 1 })}
                className={`rounded-md px-2 py-1 ${query.sort === "createdAt" ? "bg-primary-soft font-semibold text-primary" : "text-ink-2"}`}
                aria-current={query.sort === "createdAt" ? "true" : undefined}
              >
                Waktu{query.sort === "createdAt" ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
              </Link>
              <Link
                href={pageHref(query, { sort: "severity", direction: query.sort === "severity" && query.direction === "desc" ? "asc" : "desc", page: 1 })}
                className={`rounded-md px-2 py-1 ${query.sort === "severity" ? "bg-primary-soft font-semibold text-primary" : "text-ink-2"}`}
                aria-current={query.sort === "severity" ? "true" : undefined}
              >
                Tingkat{query.sort === "severity" ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
              </Link>
            </div>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.items.map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={item.severity} />
                    <span className="font-semibold">{ANOMALY_TYPE_LABEL[item.type]}</span>
                    <span className="text-ink-2">{ANOMALY_STATUS_LABEL[item.status]}</span>
                  </span>
                  <span className="mt-1 block">
                    {item.employeeName ?? "Seluruh berkas"}
                    {item.date ? <span className="text-ink-2"> · {formatCalendarDate(item.date)}</span> : null}
                  </span>
                  <span className="block text-ink-2">{item.message}</span>
                </span>
                <Link href={`/anomalies/${item.id}`} className="font-semibold text-primary">
                  Detail
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="flex items-center justify-between text-sm" aria-label="Halaman">
        <span>Halaman {data.page} dari {pageCount} ({data.total} data)</span>
        <div className="flex gap-3">
          {data.page > 1 ? <Link href={pageHref(query, { page: data.page - 1 })}>Sebelumnya</Link> : null}
          {data.page < pageCount ? <Link href={pageHref(query, { page: data.page + 1 })}>Berikutnya</Link> : null}
        </div>
      </nav>
    </MasterFrame>
  );
}
