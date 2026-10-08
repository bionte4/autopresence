import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { getDepartment, reviewerChoices } from "@/modules/departments/service";
import { linkableProjectChoices } from "@/modules/projects/service";
import { can } from "@/modules/rbac/policy";
import { DepartmentForm } from "../department-form";

export default function EditDepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat departemen...</p>}>
      <EditDepartment params={params} />
    </Suspense>
  );
}

async function EditDepartment({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "department.manage")) forbidden();
  const { id } = await params;
  const result = await getDepartment(user, id);
  if (!result.ok) notFound();
  const [projects, people] = await Promise.all([linkableProjectChoices(user, result.data.projectId), reviewerChoices(user)]);
  if (!projects.ok || !people.ok) forbidden();

  return (
    <MasterFrame title="Ubah departemen" user={user}>
      <DepartmentForm
        id={result.data.id}
        name={result.data.name}
        projectId={result.data.projectId}
        projects={projects.data}
        users={people.data}
        reviewers={result.data.reviewers}
      />
      <DeleteButton url={`/api/departments/${result.data.id}`} label={result.data.name} redirectTo="/master/departments" />
    </MasterFrame>
  );
}
