import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { DiffTable } from "@/components/domain/diff-table";
import { SeverityBadge } from "@/components/domain/severity-badge";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { AnomalyActions } from "@/app/anomalies/anomaly-actions";
import { ANOMALY_STATUS_LABEL, ANOMALY_TYPE_LABEL } from "@/modules/anomalies/labels";
import { getAnomaly } from "@/modules/anomalies/service";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";

export default function AnomalyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat anomali...</p>}>
      <AnomalyDetail params={params} />
    </Suspense>
  );
}

async function AnomalyDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "anomaly.read")) forbidden();
  const { id } = await params;
  const result = await getAnomaly(user, id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    forbidden();
  }
  const anomaly = result.data;
  const canResolve = can(user, "anomaly.resolve", { departmentId: anomaly.departmentId, severity: anomaly.severity });

  return (
    <MasterFrame title="Detail anomali" user={user}>
      <p className="text-sm">
        <SeverityBadge severity={anomaly.severity} />
        <span className="ml-2">{ANOMALY_TYPE_LABEL[anomaly.type]}, {ANOMALY_STATUS_LABEL[anomaly.status]}</span>
      </p>
      <p>{anomaly.message}</p>
      <DiffTable details={anomaly.details} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {anomaly.employeeName ?? "Tanpa pegawai"}
        {anomaly.date ? ` · ${formatCalendarDate(anomaly.date)}` : ""} · {formatDateTime(anomaly.createdAt)}
      </p>
      {anomaly.resolvedNote ? <p className="text-sm">Catatan: {anomaly.resolvedNote}</p> : null}
      <div className="flex gap-3 text-sm">
        <Link href="/anomalies" className="underline">Kembali ke daftar</Link>
        {anomaly.uploadId && can(user, "upload.read") ? (
          <Link href={`/uploads/${anomaly.uploadId}`} className="underline">Lihat upload</Link>
        ) : null}
      </div>
      {canResolve ? <AnomalyActions id={anomaly.id} status={anomaly.status} /> : null}
    </MasterFrame>
  );
}
