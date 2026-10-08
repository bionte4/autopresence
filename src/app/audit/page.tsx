import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { LogoutButton } from "@/app/logout-button";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { auditListQuerySchema } from "@/modules/audit/schema";
import { listAuditLog } from "@/modules/audit/service";
import { can } from "@/modules/rbac/policy";
import AuditLoading from "./loading";
import { VerifyButton } from "./verify-button";

export default function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<AuditLoading />}>
      <AuditContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AuditContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "audit.read")) forbidden();

  const params = await searchParams;
  const query = auditListQuerySchema.parse({
    page: first(params.page) ?? "1",
    pageSize: first(params.pageSize) ?? "20",
    direction: first(params.direction) ?? "desc",
  });
  const data = await listAuditLog(query);
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-2 text-sm text-ink-2">
            Catatan perubahan yang dirantai dengan hash. Entri tidak dapat diubah dari aplikasi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/beranda" className="text-sm underline">
            Beranda
          </Link>
          <LogoutButton />
        </div>
      </header>
      <VerifyButton />
      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
          Belum ada catatan audit.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Waktu</th>
                <th className="px-2 py-2 font-medium">Aksi</th>
                <th className="px-2 py-2 font-medium">Entitas</th>
                <th className="px-2 py-2 font-medium">Id</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                  <td className="px-2 py-2">{item.action}</td>
                  <td className="px-2 py-2">{item.entity}</td>
                  <td className="px-2 py-2 font-mono text-xs">{item.entityId ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="flex items-center justify-between text-sm" aria-label="Halaman audit">
        <span>
          Halaman {data.page} dari {pageCount} ({data.total} entri)
        </span>
        <div className="flex gap-3">
          {data.page > 1 ? (
            <Link href={`/audit?page=${data.page - 1}&direction=${query.direction}`}>Sebelumnya</Link>
          ) : null}
          {data.page < pageCount ? (
            <Link href={`/audit?page=${data.page + 1}&direction=${query.direction}`}>Berikutnya</Link>
          ) : null}
        </div>
      </nav>
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
