import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { ListControls } from "@/app/master/list-controls";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { listUploadPage } from "@/modules/uploads/service";
import { DeleteButton } from "@/app/master/delete-button";
import { UploadForm } from "./upload-form";

const STATUS_LABEL = {
  RECEIVED: "Diterima",
  PARSED: "Diproses",
  PARSED_WITH_ANOMALIES: "Diproses dengan anomali",
  REJECTED: "Ditolak",
} as const;

const GRANULARITY_LABEL = { DAILY: "Harian", WEEKLY: "Mingguan", MONTHLY: "Bulanan" } as const;

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
  const query = parseListQuery(
    {
      page: firstParam(raw.page),
      pageSize: firstParam(raw.pageSize),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction) ?? "desc",
    },
    ["createdAt", "originalName"],
    "createdAt",
  );
  const result = await listUploadPage(user, query);
  if (!result.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Unggah laporan" user={user}>
      {can(user, "upload.create") ? <UploadForm /> : null}
      {result.data.items.length === 0 ? (
        <EmptyState title="Belum ada laporan. Unggah laporan pertama untuk melihat perhitungan keterlambatan." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                {item.originalName} · {GRANULARITY_LABEL[item.granularity]} · {STATUS_LABEL[item.status]}
              </span>
              <span className="flex items-center gap-3">
                <Link href={`/uploads/${item.id}`} className="text-sm underline">
                  Detail
                </Link>
                {can(user, "upload.delete") ? (
                  <DeleteButton
                    url={`/api/uploads/${item.id}`}
                    label={item.originalName}
                    redirectTo="/uploads"
                    detail={`Hapus ${item.originalName}? Berkas asli, baris kehadiran dari unggahan ini, dan anomalinya ikut terhapus. Pegawai tetap tersimpan.`}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ListControls
        basePath="/uploads"
        q={query.q}
        sort={query.sort}
        direction={query.direction}
        page={result.data.page}
        pageCount={pageCount}
        total={result.data.total}
        sortOptions={[
          { value: "createdAt", label: "waktu" },
          { value: "originalName", label: "nama berkas" },
        ]}
      />
    </MasterFrame>
  );
}
