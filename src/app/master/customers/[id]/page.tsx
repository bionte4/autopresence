import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { getCustomer } from "@/modules/customers/service";
import { can } from "@/modules/rbac/policy";
import { CustomerForm } from "../customer-form";

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pelanggan...</p>}>
      <EditCustomer params={params} />
    </Suspense>
  );
}

async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "department.manage")) forbidden();
  const { id } = await params;
  const result = await getCustomer(user, id);
  if (!result.ok) notFound();

  return (
    <MasterFrame title="Ubah pelanggan" user={user}>
      <CustomerForm id={result.data.id} name={result.data.name} />
      <DeleteButton url={`/api/customers/${result.data.id}`} label={result.data.name} redirectTo="/master/customers" />
    </MasterFrame>
  );
}
