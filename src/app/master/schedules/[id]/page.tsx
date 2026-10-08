import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";
import { getSchedule } from "@/modules/schedules/service";
import { ScheduleForm } from "../schedule-form";

export default function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat jadwal...</p>}>
      <EditSchedule params={params} />
    </Suspense>
  );
}

async function EditSchedule({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "schedule.manage")) forbidden();
  const { id } = await params;
  const result = await getSchedule(user, id);
  if (!result.ok) notFound();

  return (
    <MasterFrame title="Ubah jadwal" user={user}>
      <ScheduleForm {...result.data} id={result.data.id} />
      <DeleteButton url={`/api/schedules/${result.data.id}`} label={result.data.name} redirectTo="/master/schedules" />
    </MasterFrame>
  );
}
