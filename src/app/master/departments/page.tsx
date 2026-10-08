import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { MasterFrame } from "@/app/master/master-frame";
import { ListControls } from "@/app/master/list-controls";
import { getCurrentUser } from "@/modules/auth/current-user";
import { listDepartmentPage } from "@/modules/departments/service";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { linkableProjectChoices } from "@/modules/projects/service";
import { can } from "@/modules/rbac/policy";
import { DepartmentForm } from "./department-form";

export default function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat departemen...</p>}>
      <DepartmentsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DepartmentsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "department.manage")) forbidden();
  const raw = await searchParams;
  const query = parseListQuery(
    {
      page: firstParam(raw.page),
      pageSize: firstParam(raw.pageSize),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction),
    },
    ["name"],
    "name",
  );
  const [result, projects] = await Promise.all([listDepartmentPage(user, query), linkableProjectChoices(user, null)]);
  if (!result.ok || !projects.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Departemen" user={user}>
      <DepartmentForm projects={projects.data} />
      {result.data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
          Tidak ada departemen.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <span>
                {item.name}
                {item.customerName && item.projectName ? ` — ${item.customerName} / ${item.projectName}` : ""}
                <span className="block text-xs text-ink-2">
                  Peninjau {Object.values(item.reviewers).filter(Boolean).length}/3
                </span>
              </span>
              <Link href={`/master/departments/${item.id}`} className="text-sm underline">
                Ubah
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ListControls
        basePath="/master/departments"
        q={query.q}
        sort={query.sort}
        direction={query.direction}
        page={result.data.page}
        pageCount={pageCount}
        total={result.data.total}
        sortOptions={[{ value: "name", label: "nama" }]}
      />
    </MasterFrame>
  );
}
