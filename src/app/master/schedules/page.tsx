import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { ListControls } from "@/app/master/list-controls";
import { MasterFrame } from "@/app/master/master-frame";
import { formatMinutes } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { can } from "@/modules/rbac/policy";
import { listSchedulePage } from "@/modules/schedules/service";
import { ScheduleForm } from "./schedule-form";

export default function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat jadwal...</p>}>
      <SchedulesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SchedulesContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "schedule.manage")) forbidden();
  const raw = await searchParams;
  const query = parseListQuery(
    {
      page: firstParam(raw.page),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction),
    },
    ["name", "startMin"],
    "name",
  );
  const result = await listSchedulePage(user, query);
  if (!result.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));

  return (
    <MasterFrame title="Jadwal kerja" user={user}>
      <ScheduleForm />
      {result.data.items.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm">Tidak ada jadwal.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {result.data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                {item.name} ({formatMinutes(item.startMin)}–{formatMinutes(item.endMin)})
              </span>
              <Link href={`/master/schedules/${item.id}`} className="text-sm underline">
                Ubah
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ListControls
        basePath="/master/schedules"
        q={query.q}
        sort={query.sort}
        direction={query.direction}
        page={result.data.page}
        pageCount={pageCount}
        total={result.data.total}
        sortOptions={[
          { value: "name", label: "nama" },
          { value: "startMin", label: "jam masuk" },
        ]}
      />
    </MasterFrame>
  );
}
