import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { formatCalendarDate } from "@/lib/format";
import { firstParam } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { parseRequestListQuery, type RequestListQuery } from "@/modules/requests/schema";
import { pendingLabel } from "@/modules/review/chain";
import { canProposeRequest, listRequestPage } from "@/modules/requests/service";
import { RequestForm } from "./request-form";

const KIND_LABEL = { LEAVE: "Cuti", SICK: "Sakit", OVERTIME: "Lembur" } as const;
const STATUS_LABEL = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" } as const;

function pageHref(query: RequestListQuery, patch: Partial<RequestListQuery>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  params.set("sort", next.sort);
  params.set("direction", next.direction);
  if (next.page > 1) params.set("page", String(next.page));
  return `/requests?${params.toString()}`;
}

export default function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pengajuan...</p>}>
      <RequestsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RequestsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read")) forbidden();
  const raw = await searchParams;
  const query = parseRequestListQuery({
    page: firstParam(raw.page),
    q: firstParam(raw.q),
    sort: firstParam(raw.sort),
    direction: firstParam(raw.direction),
    status: firstParam(raw.status),
  });
  const result = await listRequestPage(user, query);
  if (!result.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Pengajuan" user={user}>
      {canProposeRequest(user) && result.data.employees.length > 0 ? <RequestForm employees={result.data.employees} /> : null}
      {result.data.total === 0 ? (
        <EmptyState title="Belum ada pengajuan cuti, sakit, atau lembur." />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="font-semibold">{item.employeeName}</span> · {KIND_LABEL[item.kind]} · {item.status === "PENDING" ? pendingLabel(item.stage) : STATUS_LABEL[item.status]}
                <span className="block text-ink-2">
                  {formatCalendarDate(item.startDate)}
                  {item.endDate !== item.startDate ? ` s.d. ${formatCalendarDate(item.endDate)}` : ""} · {item.reason}
                </span>
              </span>
              <Link href={`/requests/${item.id}`} className="underline">
                Detail
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex items-center justify-between text-sm" aria-label="Halaman">
        <span>
          Halaman {result.data.page} dari {pageCount} ({result.data.total} data)
        </span>
        <div className="flex gap-3">
          {result.data.page > 1 ? <Link href={pageHref(query, { page: result.data.page - 1 })}>Sebelumnya</Link> : null}
          {result.data.page < pageCount ? <Link href={pageHref(query, { page: result.data.page + 1 })}>Berikutnya</Link> : null}
        </div>
      </nav>
    </MasterFrame>
  );
}
