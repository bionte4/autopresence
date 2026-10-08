import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { CorrectionForm } from "@/app/corrections/correction-form";
import { MasterFrame } from "@/app/master/master-frame";
import { canProposeCorrection, listCorrectionPage } from "@/modules/corrections/service";
import { parseCorrectionListQuery, type CorrectionListQuery } from "@/modules/corrections/schema";
import { getCurrentUser } from "@/modules/auth/current-user";
import { formatCalendarDate } from "@/lib/format";
import { firstParam } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";

const STATUS_LABEL = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" } as const;

function pageHref(query: CorrectionListQuery, patch: Partial<CorrectionListQuery>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  params.set("sort", next.sort);
  params.set("direction", next.direction);
  if (next.page > 1) params.set("page", String(next.page));
  return `/corrections?${params.toString()}`;
}

export default function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat koreksi...</p>}>
      <CorrectionsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CorrectionsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read")) forbidden();
  const raw = await searchParams;
  const query = parseCorrectionListQuery({
    page: firstParam(raw.page),
    q: firstParam(raw.q),
    sort: firstParam(raw.sort),
    direction: firstParam(raw.direction),
    status: firstParam(raw.status),
  });
  const result = await listCorrectionPage(user, query);
  if (!result.ok) forbidden();
  const data = result.data;
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <MasterFrame title="Koreksi kehadiran" user={user}>
      {canProposeCorrection(user) ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Ajukan koreksi</h2>
          <p className="text-sm text-zinc-600">Kosongkan jam jika tidak diubah. Isi minimal satu nilai baru dan alasan.</p>
          <CorrectionForm records={data.records} />
        </section>
      ) : null}
      <form className="grid gap-3 sm:grid-cols-3" action="/corrections">
        <label className="flex flex-col gap-1 text-sm">
          Cari
          <input name="q" defaultValue={query.q} className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue={query.status ?? ""} className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">Semua</option>
            <option value="PENDING">Menunggu</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </label>
        <button type="submit" className="self-end rounded-md border px-3 py-2 text-sm">Terapkan</button>
      </form>
      {data.total === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-zinc-600">Belum ada koreksi.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {data.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="mr-2 rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">{STATUS_LABEL[item.status]}</span>
                {item.employeeName ?? "Pegawai"}
                {item.date ? ` · ${formatCalendarDate(item.date)}` : ""}
                <span className="block text-zinc-600 dark:text-zinc-400">{item.reason}</span>
              </span>
              <Link href={`/corrections/${item.id}`} className="underline">Detail</Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={pageHref(query, { sort: "createdAt", direction: query.sort === "createdAt" && query.direction === "desc" ? "asc" : "desc", page: 1 })} className="underline">
          Urutkan waktu{query.sort === "createdAt" ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
        </Link>
        <Link href={pageHref(query, { sort: "status", direction: query.sort === "status" && query.direction === "asc" ? "desc" : "asc", page: 1 })} className="underline">
          Urutkan status{query.sort === "status" ? (query.direction === "asc" ? " ↑" : " ↓") : ""}
        </Link>
      </div>
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
