import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { IntegritySeal } from "@/components/domain/integrity-seal";
import { SeverityBadge } from "@/components/domain/severity-badge";
import { UploadPipeline } from "@/components/domain/upload-pipeline";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";
import { getUpload } from "@/modules/uploads/service";

const STATUS_LABEL = {
  RECEIVED: "Diterima",
  PARSED: "Diproses",
  PARSED_WITH_ANOMALIES: "Diproses dengan anomali",
  REJECTED: "Ditolak",
} as const;

export default function UploadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat upload...</p>}>
      <UploadDetail params={params} />
    </Suspense>
  );
}

async function UploadDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "upload.read")) forbidden();
  const { id } = await params;
  const result = await getUpload(user, id);
  if (!result.ok) notFound();
  const upload = result.data;

  return (
    <MasterFrame title="Detail unggah" user={user}>
      <IntegritySeal
        tone={upload.status === "REJECTED" ? "danger" : upload.status === "PARSED_WITH_ANOMALIES" ? "warn" : "ok"}
        title={STATUS_LABEL[upload.status]}
        detail={`${upload.originalName}, ${formatCalendarDate(upload.periodStart)} sampai ${formatCalendarDate(upload.periodEnd)}`}
        hash={upload.sha256}
      />
      <section className="panel">
        <h2 className="font-semibold">Pemeriksaan berkas</h2>
        <div className="mt-3">
          <UploadPipeline status={upload.status} />
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-4">
        {can(user, "upload.download") ? (
          <Link href={`/api/uploads/${upload.id}/file`} className="text-sm font-semibold text-primary">
            Unduh berkas asli
          </Link>
        ) : null}
        {can(user, "upload.delete") ? (
          <DeleteButton
            url={`/api/uploads/${upload.id}`}
            label={upload.originalName}
            redirectTo="/uploads"
            detail={`Hapus ${upload.originalName}? Berkas asli, baris kehadiran dari unggahan ini, dan anomalinya ikut terhapus. Pegawai tetap tersimpan.`}
          />
        ) : null}
      </div>
      {upload.stats ? (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Pegawai", upload.stats.employees],
              ["Baru", upload.stats.inserted],
              ["Tidak berubah", upload.stats.unchanged],
              ["Dilengkapi", upload.stats.completed],
              ["Konflik", upload.stats.conflicts],
              ["Anomali", upload.stats.anomalies],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="border-b border-r border-line px-4 py-3">
              <dt className="text-sm text-ink-2">{label}</dt>
              <dd className="text-xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Hasil pemeriksaan</h2>
        {upload.anomalies && upload.anomalies.length > 0 ? (
          <ul className="divide-y divide-line">
            {upload.anomalies.map((anomaly) => (
              <li key={anomaly.id} className="py-3 text-sm">
                <SeverityBadge severity={anomaly.severity} />
                {anomaly.date ? <span> {formatCalendarDate(anomaly.date)}</span> : null}
                <p className="mt-1">{anomaly.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Tidak ada anomali pada berkas ini." />
        )}
      </section>
    </MasterFrame>
  );
}
