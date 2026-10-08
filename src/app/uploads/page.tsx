import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import type { UploadStatus } from "@prisma/client";
import { EmptyState } from "@/components/domain/empty-state";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam, parseListQuery, type ListQuery } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { listUploadPage } from "@/modules/uploads/service";
import { UploadForm } from "./upload-form";

const STATUS_LABEL = {
  RECEIVED: "Diterima",
  PARSED: "Diproses",
  PARSED_WITH_ANOMALIES: "Diproses dengan anomali",
  REJECTED: "Ditolak",
} as const;

const GRANULARITY_LABEL = { DAILY: "Harian", WEEKLY: "Mingguan", MONTHLY: "Bulanan" } as const;
const STATUSES = ["RECEIVED", "PARSED", "PARSED_WITH_ANOMALIES", "REJECTED"] as const;

function archiveHref(query: ListQuery & { status?: UploadStatus }, patch: Partial<ListQuery & { status?: UploadStatus }>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  params.set("sort", next.sort);
  params.set("direction", next.direction);
  if (next.page > 1) params.set("page", String(next.page));
  return `/uploads?${params.toString()}`;
}

export default function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat upload...</p>}>
      <UploadsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UploadsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "upload.read")) forbidden();
  const raw = await searchParams;
  const status = STATUSES.find((item) => item === firstParam(raw.status));
  const query = {
    ...parseListQuery(
      {
        page: firstParam(raw.page),
        pageSize: firstParam(raw.pageSize),
        q: firstParam(raw.q),
        sort: firstParam(raw.sort),
        direction: firstParam(raw.direction) ?? "desc",
      },
      ["createdAt", "originalName"],
      "createdAt",
    ),
    status,
  };
  const result = await listUploadPage(user, query);
  if (!result.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Unggah laporan" user={user}>
      {can(user, "upload.create") ? <UploadForm /> : null}
      <form className="panel grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_16rem_auto]" action="/uploads">
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Cari berkas
          <input name="q" defaultValue={query.q} className="field font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Status
          <select name="status" defaultValue={query.status ?? ""} className="field font-normal">
            <option value="">Semua</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="direction" value={query.direction} />
        <button type="submit" className="btn justify-self-start">Terapkan</button>
      </form>
      {result.data.items.length === 0 ? (
        <EmptyState title="Belum ada laporan. Unggah laporan pertama untuk melihat perhitungan keterlambatan." />
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">{result.data.total} berkas</p>
            <div className="flex rounded-lg border border-line p-0.5 text-sm">
              <Link
                href={archiveHref(query, { sort: "createdAt", direction: query.sort === "createdAt" && query.direction === "desc" ? "asc" : "desc", page: 1 })}
                className={`rounded-md px-2 py-1 ${query.sort === "createdAt" ? "bg-primary-soft font-semibold text-primary" : "text-ink-2"}`}
              >
                Waktu{query.sort === "createdAt" ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
              </Link>
              <Link
                href={archiveHref(query, { sort: "originalName", direction: query.sort === "originalName" && query.direction === "asc" ? "desc" : "asc", page: 1 })}
                className={`rounded-md px-2 py-1 ${query.sort === "originalName" ? "bg-primary-soft font-semibold text-primary" : "text-ink-2"}`}
              >
                Nama{query.sort === "originalName" ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
              </Link>
            </div>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {result.data.items.map((item) => {
              const anomalies = item.stats?.anomalies ?? 0;
              return (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {formatCalendarDate(item.periodStart)} s.d. {formatCalendarDate(item.periodEnd)}
                    </span>
                    <span className="block truncate text-ink-2">
                      {item.originalName} · {GRANULARITY_LABEL[item.granularity]} · {STATUS_LABEL[item.status]}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
                      <span className={anomalies > 0 ? "font-semibold text-danger" : undefined}>
                        {anomalies > 0 ? `${anomalies} anomali` : "Tanpa anomali"}
                      </span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </span>
                  </span>
                  <Link href={`/uploads/${item.id}`} className="font-semibold text-primary">
                    Buka
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <nav className="flex items-center justify-between text-sm" aria-label="Halaman">
        <span>
          Halaman {result.data.page} dari {pageCount} ({result.data.total} berkas)
        </span>
        <div className="flex gap-3">
          {result.data.page > 1 ? <Link href={archiveHref(query, { page: result.data.page - 1 })}>Sebelumnya</Link> : null}
          {result.data.page < pageCount ? <Link href={archiveHref(query, { page: result.data.page + 1 })}>Berikutnya</Link> : null}
        </div>
      </nav>
    </MasterFrame>
  );
}
