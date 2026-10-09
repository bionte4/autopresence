import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/app/master/delete-button";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { customerChoices } from "@/modules/customers/service";
import { departmentChoices } from "@/modules/departments/service";
import { employeeChoices } from "@/modules/employees/service";
import { can } from "@/modules/rbac/policy";
import { getUser } from "@/modules/users/service";
import { UserForm } from "../user-form";

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pengguna...</p>}>
      <EditUser params={params} />
    </Suspense>
  );
}

async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "user.manage")) forbidden();
  const { id } = await params;
  const [result, departments, employees, customers] = await Promise.all([
    getUser(user, id),
    departmentChoices(user),
    employeeChoices(user),
    customerChoices(user),
  ]);
  if (!departments.ok || !employees.ok || !customers.ok) forbidden();
  if (!result.ok) notFound();

  return (
    <MasterFrame title="Ubah akun login" user={user}>
      <UserForm {...result.data} departments={departments.data} employees={employees.data} customers={customers.data} />
      {user.id === result.data.id ? null : (
        <DeleteButton
          url={`/api/users/${result.data.id}`}
          label={result.data.name}
          redirectTo="/admin/users"
          detail={`Hapus akun ${result.data.email}? Akun ini tidak bisa masuk lagi. Data pegawai yang ditautkan tetap tersimpan.`}
        />
      )}
    </MasterFrame>
  );
}
