import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { customerChoices } from "@/modules/customers/service";
import { getProject } from "@/modules/projects/service";
import { can } from "@/modules/rbac/policy";
import { ProjectForm } from "../project-form";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat proyek...</p>}>
      <EditProject params={params} />
    </Suspense>
  );
}

async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "department.manage")) forbidden();
  const { id } = await params;
  const [result, customers] = await Promise.all([getProject(user, id), customerChoices(user)]);
  if (!result.ok) notFound();
  if (!customers.ok) forbidden();

  return (
    <MasterFrame title="Ubah proyek" user={user}>
      <ProjectForm id={result.data.id} name={result.data.name} customerId={result.data.customerId} customers={customers.data} />
      <DeleteButton url={`/api/projects/${result.data.id}`} label={result.data.name} redirectTo="/master/projects" />
    </MasterFrame>
  );
}
