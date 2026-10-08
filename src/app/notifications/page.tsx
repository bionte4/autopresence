import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { MasterFrame } from "@/app/master/master-frame";
import { MarkReadButton } from "@/app/notifications/mark-read";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { listNotificationPage } from "@/modules/notify/inbox";
import { can } from "@/modules/rbac/policy";

export default function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat notifikasi...</p>}>
      <NotificationsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NotificationsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "notification.read")) forbidden();
  const raw = await searchParams;
  const query = parseListQuery(
    { page: firstParam(raw.page), pageSize: firstParam(raw.pageSize), q: "", sort: "createdAt", direction: "desc" },
    ["createdAt"],
    "createdAt",
  );
  const result = await listNotificationPage(user, { page: query.page, pageSize: query.pageSize });
  if (!result.ok) forbidden();
  const data = result.data;
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <MasterFrame title="Notifikasi" user={user}>
      <p className="text-sm text-ink-2">{data.unread} belum dibaca</p>
      {data.unread > 0 ? <MarkReadButton /> : null}
      {data.total === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">Belum ada notifikasi.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.items.map((item) => (
            <li key={item.id} className="py-3 text-sm">
              <p className={item.readAt ? "text-ink-2" : "font-medium"}>{item.title}</p>
              <p>{item.body}</p>
              <p className="text-xs text-ink-2">{formatDateTime(item.createdAt)}</p>
              {item.anomalyId ? (
                <Link href={`/anomalies/${item.anomalyId}`} className="underline">Buka anomali</Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <nav className="flex items-center justify-between text-sm" aria-label="Halaman">
        <span>Halaman {data.page} dari {pageCount} ({data.total} data)</span>
        <div className="flex gap-3">
          {data.page > 1 ? <Link href={`/notifications?page=${data.page - 1}`}>Sebelumnya</Link> : null}
          {data.page < pageCount ? <Link href={`/notifications?page=${data.page + 1}`}>Berikutnya</Link> : null}
        </div>
      </nav>
    </MasterFrame>
  );
}
