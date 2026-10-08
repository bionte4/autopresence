import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ListControls } from "@/app/master/list-controls";
import { MasterFrame } from "@/app/master/master-frame";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentUser } from "@/modules/auth/current-user";
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
  const [result, departments, employees] = await Promise.all([
    listUserPage(user, query),
    departmentChoices(user),
    employeeChoices(user),
  ]);
  if (!result.ok || !departments.ok || !employees.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Pengguna" user={user}>
      <UserForm departments={departments.data} employees={employees.data} />
      {result.data.items.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm">Tidak ada pengguna.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                {item.name} · {item.email} · {ROLE_LABEL[item.role]}
              </span>
              <Link href={`/admin/users/${item.id}`} className="text-sm underline">
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
