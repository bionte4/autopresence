import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ListControls } from "@/app/master/list-controls";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { departmentChoices } from "@/modules/departments/service";
import { listEmployeePage } from "@/modules/employees/service";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { scheduleChoices } from "@/modules/schedules/service";
import { EmployeeForm } from "./employee-form";

export default function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pegawai...</p>}>
      <EmployeesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeesContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "employee.manage")) forbidden();
  const raw = await searchParams;
  const query = parseListQuery(
    {
      page: firstParam(raw.page),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction),
    },
    ["name", "pin"],
    "name",
  );
  const [result, departments, schedules] = await Promise.all([
    listEmployeePage(user, query),
    departmentChoices(user),
    scheduleChoices(user),
  ]);
  if (!result.ok || !departments.ok || !schedules.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Pegawai" user={user}>
      <EmployeeForm departments={departments.data} schedules={schedules.data} />
      {result.data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">Tidak ada pegawai.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                {item.name} · PIN {item.pin}
                {item.departmentName ? ` · ${item.departmentName}` : ""}
              </span>
              <Link href={`/master/employees/${item.id}`} className="text-sm underline">
                Ubah
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ListControls
        basePath="/master/employees"
        q={query.q}
        sort={query.sort}
        direction={query.direction}
        page={result.data.page}
        pageCount={pageCount}
        total={result.data.total}
        sortOptions={[
          { value: "name", label: "nama" },
          { value: "pin", label: "PIN" },
        ]}
      />
    </MasterFrame>
  );
}
