import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { DeleteButton } from "@/app/master/delete-button";
import { ListControls } from "@/app/master/list-controls";
import { EmptyState } from "@/components/domain/empty-state";
import { MasterFrame } from "@/app/master/master-frame";
import { ScheduleForm } from "@/app/monitoring/schedule-form";
import { formatCalendarDate } from "@/lib/format";
import { getCurrentUser } from "@/modules/auth/current-user";
import { firstParam, parseListQuery } from "@/modules/master/query";
import { monitoringBoard } from "@/modules/monitoring/service";
import { can } from "@/modules/rbac/policy";
import { listUploadSchedulePage } from "@/modules/upload-schedules/service";

const GRANULARITY_LABEL = { DAILY: "Harian", WEEKLY: "Mingguan", MONTHLY: "Bulanan" } as const;
const WEEKDAY = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const STATE = {
  received: { label: "Diterima", className: "bg-ok-soft text-ok" },
  waiting: { label: "Belum jatuh tempo", className: "bg-warn-soft text-warn" },
  missing: { label: "Belum diterima", className: "bg-danger-soft text-danger" },
} as const;

export default function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat pemantauan...</p>}>
      <MonitoringContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MonitoringContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, "upload.read")) forbidden();
  const raw = await searchParams;
  const query = parseListQuery(
    {
      page: firstParam(raw.page),
      q: firstParam(raw.q),
      sort: firstParam(raw.sort),
      direction: firstParam(raw.direction) ?? "asc",
    },
    ["granularity", "cutoffTime"],
    "granularity",
  );
  const [board, schedules] = await Promise.all([monitoringBoard(user), listUploadSchedulePage(user, query)]);
  if (!board.ok || !schedules.ok) forbidden();
  const pageCount = Math.max(1, Math.ceil(schedules.data.total / schedules.data.pageSize));

  return (
    <MasterFrame title="Pemantauan upload" user={user}>
      {board.data.length === 0 ? (
        <EmptyState title="Belum ada jadwal unggah yang aktif. Tambahkan jadwal agar keterlambatan unggah terpantau." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">Jenis</th>
                <th className="py-2 pr-3 font-medium">Periode</th>
                <th className="py-2 pr-3 font-medium">Batas</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {board.data.map((row) => (
                <tr key={`${row.scheduleId}-${row.from}`} className="border-b border-line">
                  <td className="py-2 pr-3">{GRANULARITY_LABEL[row.granularity]}</td>
                  <td className="py-2 pr-3">{formatCalendarDate(row.from)} s.d. {formatCalendarDate(row.to)}</td>
                  <td className="py-2 pr-3">{row.cutoffTime}</td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE[row.state].className}`}>{STATE[row.state].label}</span>
                    {row.uploadId ? (
                      <Link href={`/uploads/${row.uploadId}`} className="ml-2 underline">Lihat</Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {can(user, "uploadSchedule.manage") ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Jadwal yang diharapkan</h2>
          <ScheduleForm />
          {schedules.data.total === 0 ? (
            <p className="text-sm text-ink-2">Belum ada jadwal.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {schedules.data.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    {GRANULARITY_LABEL[item.granularity]} · batas {item.cutoffTime}
                    {item.dayOfWeek ? ` · ${WEEKDAY[item.dayOfWeek]}` : ""}
                    {item.dayOfMonth ? ` · tanggal ${item.dayOfMonth}` : ""}
                    {item.enabled ? "" : " · nonaktif"}
                  </span>
                  <span className="flex items-center gap-3">
                    <Link href={`/monitoring/${item.id}`} className="underline">Ubah</Link>
                    <DeleteButton url={`/api/upload-schedules/${item.id}`} label={GRANULARITY_LABEL[item.granularity]} redirectTo="/monitoring" />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ListControls
            basePath="/monitoring"
            q={query.q}
            sort={query.sort}
            direction={query.direction}
            page={schedules.data.page}
            pageCount={pageCount}
            total={schedules.data.total}
            sortOptions={[
              { value: "granularity", label: "jenis" },
              { value: "cutoffTime", label: "batas waktu" },
            ]}
          />
        </section>
      ) : null}
    </MasterFrame>
  );
}
