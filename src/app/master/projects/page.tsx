import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ListControls } from "@/app/master/list-controls";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";
import { customerChoices } from "@/modules/customers/service";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { listProjectPage } from "@/modules/projects/service";
import { can } from "@/modules/rbac/policy";
import { ProjectForm } from "./project-form";

export default function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat proyek...</p>}>
      <ProjectsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectsContent({
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
  const [result, customers] = await Promise.all([listProjectPage(user, query), customerChoices(user)]);
  if (!result.ok || !customers.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Proyek" user={user}>
      <ProjectForm customers={customers.data} />
      {result.data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">Tidak ada proyek.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                {item.customerName} — {item.name}
              </span>
              <Link href={`/master/projects/${item.id}`} className="text-sm underline">
                Ubah
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ListControls
        basePath="/master/projects"
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
