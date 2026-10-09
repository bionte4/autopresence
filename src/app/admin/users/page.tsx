import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ListControls } from "@/app/master/list-controls";
import { MasterFrame } from "@/app/master/master-frame";
import { EmptyState } from "@/components/domain/empty-state";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentUser } from "@/modules/auth/current-user";
import { customerChoices } from "@/modules/customers/service";
import { departmentChoices } from "@/modules/departments/service";
import { employeeChoices } from "@/modules/employees/service";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { listUserPage } from "@/modules/users/service";
import { UserForm } from "./user-form";

export default function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pengguna...</p>}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "user.manage")) forbidden();
  const raw = await searchParams;
  const query = parseListQuery(
    {
      page: firstParam(raw.page),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction),
    },
    ["name", "email"],
    "name",
  );
  const [result, departments, employees, customers] = await Promise.all([
    listUserPage(user, query),
    departmentChoices(user),
    employeeChoices(user),
    customerChoices(user),
  ]);
  if (!result.ok || !departments.ok || !employees.ok || !customers.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Akun login" user={user}>
      <UserForm departments={departments.data} employees={employees.data} customers={customers.data} />
      {result.data.total === 0 ? (
        <EmptyState title="Belum ada akun login." />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="font-semibold">{item.name}</span> · {item.email} · {ROLE_LABEL[item.role]}
                {item.isActive ? "" : " · nonaktif"}
                <span className="block text-ink-2">
                  {item.role === "CUSTOMER"
                    ? (item.customerName ?? "Pelanggan belum dipilih")
                    : item.employeeName
                      ? `${item.employeeName} · PIN ${item.employeePin}`
                      : "Tidak ditautkan ke pegawai"}
                </span>
              </span>
              <Link href={`/admin/users/${item.id}`} className="underline">
                Ubah
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ListControls
        basePath="/admin/users"
        q={query.q}
        sort={query.sort}
        direction={query.direction}
        page={result.data.page}
        pageCount={pageCount}
        total={result.data.total}
        sortOptions={[
          { value: "name", label: "nama" },
          { value: "email", label: "email" },
        ]}
      />
    </MasterFrame>
  );
}
