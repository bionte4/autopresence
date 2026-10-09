import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { ReviewForm } from "@/app/corrections/review-form";
import { MasterFrame } from "@/app/master/master-frame";
import { ReviewChain } from "@/components/domain/review-chain";
import { getCorrection } from "@/modules/corrections/service";
import { getCurrentUser } from "@/modules/auth/current-user";
import { formatCalendarDate, formatMinutes } from "@/lib/format";
import { can, isCustomerViewer } from "@/modules/rbac/policy";
import { SEAT_LABEL } from "@/modules/review/chain";

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
  if (!can(user, "attendance.read") || isCustomerViewer(user)) forbidden();
  const { id } = await params;
  const result = await getCorrection(user, id);
  if (!result.ok) notFound();
  const row = result.data;
  const changes = row.changes && typeof row.changes === "object" && !Array.isArray(row.changes) ? row.changes : {};

  return (
    <MasterFrame title="Detail koreksi" user={user}>
      <dl className="grid gap-2 text-sm">
        <div><dt className="text-ink-2">Status</dt><dd>{row.status === "PENDING" ? `Menunggu ${SEAT_LABEL[row.stage]}` : STATUS_LABEL[row.status]}</dd></div>
        <div><dt className="text-ink-2">Pegawai</dt><dd>{row.employeeName}{row.date ? ` · ${formatCalendarDate(row.date)}` : ""}</dd></div>
        <div><dt className="text-ink-2">Alasan</dt><dd>{row.reason}</dd></div>
        <div><dt className="text-ink-2">Jam masuk</dt><dd>{clockLabel("clockInMin" in changes ? changes.clockInMin : undefined)}</dd></div>
        <div><dt className="text-ink-2">Jam keluar</dt><dd>{clockLabel("clockOutMin" in changes ? changes.clockOutMin : undefined)}</dd></div>
        {"note" in changes ? <div><dt className="text-ink-2">Keterangan</dt><dd>{String(changes.note ?? "kosong")}</dd></div> : null}
        {row.evidenceNote ? <div><dt className="text-ink-2">Bukti</dt><dd>{row.evidenceNote}</dd></div> : null}
        {row.reviewNote ? <div><dt className="text-ink-2">Catatan keputusan</dt><dd>{row.reviewNote}</dd></div> : null}
      </dl>
      <ReviewChain steps={row.steps ?? []} />
      {row.status === "PENDING" && can(user, "correction.review", { departmentId: row.departmentId, reviewSeat: row.stage, ownerUserId: row.requestedById }) ? (
        <ReviewForm id={row.id} seatLabel={SEAT_LABEL[row.stage]} />
      ) : null}
    </MasterFrame>
  );
}
