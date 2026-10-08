import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { MasterFrame } from "@/app/master/master-frame";
import { formatCalendarDate, formatMinutes } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";
import { canReviewRequest, getRequest } from "@/modules/requests/service";
import { findRequest } from "@/modules/requests/repo";
import { ReviewForm } from "../review-form";

const KIND_LABEL = { LEAVE: "Cuti", SICK: "Sakit", OVERTIME: "Lembur" } as const;
const STATUS_LABEL = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" } as const;

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pengajuan...</p>}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "attendance.read")) forbidden();
  const { id } = await params;
  const result = await getRequest(user, id);
  if (!result.ok) notFound();
  const row = await findRequest(id);
  const request = result.data;
  const review = row ? canReviewRequest(user, row.employee.id, row.employee.departmentId) && request.status === "PENDING" : false;

  return (
    <MasterFrame title={KIND_LABEL[request.kind]} user={user}>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-ink-2">Pegawai</dt>
          <dd className="font-semibold">{request.employeeName}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Periode</dt>
          <dd>
            {formatCalendarDate(request.startDate)}
            {request.endDate !== request.startDate ? ` s.d. ${formatCalendarDate(request.endDate)}` : ""}
          </dd>
        </div>
        {request.overtimeMin !== null ? (
          <div>
            <dt className="text-ink-2">Lembur</dt>
            <dd>
              {formatMinutes(request.overtimeMin)}
              {request.endMin !== null ? ` sampai ${formatMinutes(request.endMin)}` : ""}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-ink-2">Status</dt>
          <dd>{STATUS_LABEL[request.status]}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Alasan</dt>
          <dd>{request.reason}</dd>
        </div>
        {request.reviewNote ? (
          <div>
            <dt className="text-ink-2">Catatan peninjau</dt>
            <dd>{request.reviewNote}</dd>
          </div>
        ) : null}
      </dl>
      {review ? <ReviewForm id={request.id} /> : null}
    </MasterFrame>
  );
}
