import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { ReviewForm } from "@/app/corrections/review-form";
import { MasterFrame } from "@/app/master/master-frame";
import { getCorrection } from "@/modules/corrections/service";
import { getCurrentUser } from "@/modules/auth/current-user";
import { formatCalendarDate, formatMinutes } from "@/lib/format";
import { can } from "@/modules/rbac/policy";

const STATUS_LABEL = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" } as const;

function clockLabel(value: unknown): string {
  return typeof value === "number" ? formatMinutes(value) : value === null ? "kosong" : "tidak diubah";
}

export default function CorrectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat koreksi...</p>}>
      <CorrectionDetail params={params} />
    </Suspense>
  );
}

async function CorrectionDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read")) forbidden();
  const { id } = await params;
  const result = await getCorrection(user, id);
  if (!result.ok) notFound();
  const row = result.data;
  const changes = row.changes && typeof row.changes === "object" && !Array.isArray(row.changes) ? row.changes : {};

  return (
    <MasterFrame title="Detail koreksi" user={user}>
      <dl className="grid gap-2 text-sm">
        <div><dt className="text-zinc-500">Status</dt><dd>{STATUS_LABEL[row.status]}</dd></div>
        <div><dt className="text-zinc-500">Pegawai</dt><dd>{row.employeeName}{row.date ? ` · ${formatCalendarDate(row.date)}` : ""}</dd></div>
        <div><dt className="text-zinc-500">Alasan</dt><dd>{row.reason}</dd></div>
        <div><dt className="text-zinc-500">Jam masuk</dt><dd>{clockLabel("clockInMin" in changes ? changes.clockInMin : undefined)}</dd></div>
        <div><dt className="text-zinc-500">Jam keluar</dt><dd>{clockLabel("clockOutMin" in changes ? changes.clockOutMin : undefined)}</dd></div>
        {"note" in changes ? <div><dt className="text-zinc-500">Keterangan</dt><dd>{String(changes.note ?? "kosong")}</dd></div> : null}
        {row.evidenceNote ? <div><dt className="text-zinc-500">Bukti</dt><dd>{row.evidenceNote}</dd></div> : null}
        {row.reviewNote ? <div><dt className="text-zinc-500">Catatan keputusan</dt><dd>{row.reviewNote}</dd></div> : null}
      </dl>
      {row.status === "PENDING" && can(user, "correction.review") ? <ReviewForm id={row.id} /> : null}
    </MasterFrame>
  );
}
