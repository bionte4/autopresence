import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { MasterFrame } from "@/app/master/master-frame";
import { ScheduleForm } from "@/app/monitoring/schedule-form";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";
import { getUploadSchedule } from "@/modules/upload-schedules/service";

export default function EditUploadSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat jadwal...</p>}>
      <EditUploadSchedule params={params} />
    </Suspense>
  );
}

async function EditUploadSchedule({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "uploadSchedule.manage")) forbidden();
  const { id } = await params;
  const result = await getUploadSchedule(user, id);
  if (!result.ok) notFound();

  return (
    <MasterFrame title="Ubah jadwal upload" user={user}>
      <ScheduleForm {...result.data} />
    </MasterFrame>
  );
}
