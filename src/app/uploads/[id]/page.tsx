import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import type { AnomalyType, Severity } from "@prisma/client";
import { EmptyState } from "@/components/domain/empty-state";
import { IntegritySeal } from "@/components/domain/integrity-seal";
import { SeverityBadge } from "@/components/domain/severity-badge";
import { UploadPipeline } from "@/components/domain/upload-pipeline";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate } from "@/lib/format";
import { ANOMALY_TYPE_LABEL } from "@/modules/anomalies/labels";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";
import { getUpload, type UploadDto } from "@/modules/uploads/service";

type Finding = NonNullable<UploadDto["anomalies"]>[number];

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

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
              <dd className={`text-xl font-semibold ${label === "Anomali" && value > 0 ? "text-danger" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Findings anomalies={upload.anomalies ?? []} />
    </MasterFrame>
  );
}

function Findings({ anomalies }: { anomalies: Finding[] }) {
  if (anomalies.length === 0) return <EmptyState title="Tidak ada anomali pada berkas ini." />;
  const counts = new Map<Severity, number>();
  for (const anomaly of anomalies) counts.set(anomaly.severity, (counts.get(anomaly.severity) ?? 0) + 1);
  const groups = new Map<AnomalyType, Finding[]>();
  for (const anomaly of anomalies) {
    const bucket = groups.get(anomaly.type) ?? [];
    bucket.push(anomaly);
    groups.set(anomaly.type, bucket);
  }
  const ordered = [...groups.entries()]
    .map(([type, items]) => ({
      type,
      items: [...items].sort((left, right) => (left.date ?? "").localeCompare(right.date ?? "") || (left.employeeName ?? "").localeCompare(right.employeeName ?? "")),
      severity: [...items].sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity])[0]?.severity ?? "LOW",
    }))
    .sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] || right.items.length - left.items.length);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Hasil pemeriksaan</h2>
        <p className="text-sm text-ink-2">{anomalies.length} temuan</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((severity) =>
          counts.get(severity) ? (
            <li key={severity}>
              <SeverityBadge severity={severity} />
              <span className="ml-1 text-sm tabular-nums text-ink-2">{counts.get(severity)}</span>
            </li>
          ) : null,
        )}
      </ul>
      <div className="flex flex-col gap-2">
        {ordered.map((group) => (
          <details key={group.type} className="panel" open={group.items.length <= 3}>
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-semibold">{ANOMALY_TYPE_LABEL[group.type]}</span>
                <span className="ml-2 tabular-nums text-ink-2">{group.items.length}</span>
              </span>
              <SeverityBadge severity={group.severity} />
            </summary>
            <ul className="mt-3 divide-y divide-line">
              {group.items.map((anomaly) => (
                <li key={anomaly.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">{anomaly.employeeName ?? "Seluruh berkas"}</span>
                    {anomaly.date ? <span className="text-ink-2"> · {formatCalendarDate(anomaly.date)}</span> : null}
                    <span className="block text-ink-2">{anomaly.message}</span>
                  </span>
                  <Link href={`/anomalies/${anomaly.id}`} className="shrink-0 font-semibold text-primary">
                    Detail
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
