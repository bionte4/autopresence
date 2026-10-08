import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { departmentChoices } from "@/modules/departments/service";
import { getEmployee } from "@/modules/employees/service";
import { can } from "@/modules/rbac/policy";
import { scheduleChoices } from "@/modules/schedules/service";
import { EmployeeForm } from "../employee-form";

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pegawai...</p>}>
      <EditEmployee params={params} />
    </Suspense>
  );
}

async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "employee.manage")) forbidden();
  const { id } = await params;
  const [result, departments, schedules] = await Promise.all([
    getEmployee(user, id),
    departmentChoices(user),
    scheduleChoices(user),
  ]);
  if (!departments.ok || !schedules.ok) forbidden();
  if (!result.ok) notFound();

  return (
    <MasterFrame title="Ubah pegawai" user={user}>
      <EmployeeForm {...result.data} departments={departments.data} schedules={schedules.data} />
      <DeleteButton url={`/api/employees/${result.data.id}`} label={result.data.name} redirectTo="/master/employees" />
    </MasterFrame>
  );
}
