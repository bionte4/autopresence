import Link from "next/link";
import { formatCalendarDate, formatMinutes } from "@/lib/format";
import type { AttendancePreviewDto } from "@/modules/dashboard/service";
import type { SoftLaborQuery } from "@/modules/soft-labor/schema";
import type { SoftLaborReportDto } from "@/modules/soft-labor/service";
import type { TimesheetDto } from "@/modules/timesheet/service";

function clock(value: number | null): string {
  return value === null ? "—" : formatMinutes(value);
}

function employeeHref(employeeId: string, from: string, to: string, focus?: string): string {
  const params = new URLSearchParams({ from, to });
  if (focus) params.set("focus", focus);
  const hash = focus ? `#hari-${focus}` : "";
  return `/dashboard/pegawai/${employeeId}?${params.toString()}${hash}`;
}

function timesheetPreviewHref(employeeId: string, from: string, to: string): string {
  const params = new URLSearchParams({
    report: "timesheet",
    from,
    to,
    employeeId,
  });
  return `/reports?${params.toString()}`;
}

function NameLink({
  employeeId,
  name,
  from,
  to,
}: {
  employeeId: string;
  name: string;
  from: string;
  to: string;
}) {
  return (
    <Link href={employeeHref(employeeId, from, to)} className="font-semibold text-ink underline-offset-2 hover:underline">
      {name}
    </Link>
  );
}

export function AttendancePreview({
  data,
  exportHref,
}: {
  data: AttendancePreviewDto;
  exportHref: string;
}) {
  return (
    <section className="panel flex flex-col gap-4" aria-labelledby="attendance-preview-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="attendance-preview-title" className="font-semibold">
            Pratinjau rekap kehadiran
          </h2>
          <p className="text-xs text-ink-2">
            Periode {formatCalendarDate(data.from)} s.d. {formatCalendarDate(data.to)} · {data.rows.length} pegawai.
            Klik nama untuk detail; klik angka untuk timesheet.
          </p>
        </div>
        <Link className="btn btn-primary" href={exportHref}>
          Unduh Excel pratinjau ini
        </Link>
      </div>
      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
          Belum ada data kehadiran pada filter ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs text-ink-2">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Nama</th>
                {data.includePin ? <th className="px-2 py-2 font-medium">PIN</th> : null}
                <th className="px-2 py-2 font-medium">Departemen</th>
                <th className="px-2 py-2 font-medium">Kejadian terlambat</th>
                <th className="px-2 py-2 font-medium">Total telat</th>
                <th className="px-2 py-2 font-medium">Kurang presensi</th>
                <th className="px-2 py-2 font-medium">Tanpa keterangan</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const sheet = timesheetPreviewHref(row.employeeId, data.from, data.to);
                return (
                  <tr key={row.employeeId} className="border-b border-line/60">
                    <td className="px-2 py-2">
                      <NameLink employeeId={row.employeeId} name={row.name} from={data.from} to={data.to} />
                    </td>
                    {data.includePin ? <td className="px-2 py-2 text-ink-2">{row.pin}</td> : null}
                    <td className="px-2 py-2 text-ink-2">{row.departmentName ?? "—"}</td>
                    <td className="px-2 py-2">
                      <MetricLink href={sheet} value={row.lateCount} />
                    </td>
                    <td className="px-2 py-2">
                      <MetricLink href={sheet} value={formatMinutes(row.lateMinutes)} active={row.lateMinutes > 0} />
                    </td>
                    <td className="px-2 py-2">
                      <MetricLink href={sheet} value={row.missingPunch} />
                    </td>
                    <td className="px-2 py-2">
                      <MetricLink href={sheet} value={row.noReason} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MetricLink({
  href,
  value,
  active,
}: {
  href: string;
  value: string | number;
  active?: boolean;
}) {
  const on = active ?? (typeof value === "number" ? value > 0 : value !== "00:00");
  if (!on) return <span>{value}</span>;
  return (
    <Link href={href} className="underline-offset-2 hover:underline">
      {value}
    </Link>
  );
}

export function TimesheetPreview({
  data,
  from,
  to,
  exportHref,
}: {
  data: TimesheetDto;
  from: string;
  to: string;
  exportHref: string;
}) {
  return (
    <section className="panel flex flex-col gap-4" aria-labelledby="timesheet-preview-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="timesheet-preview-title" className="font-semibold">
            Pratinjau timesheet
          </h2>
          <p className="text-xs text-ink-2">
            <NameLink employeeId={data.employee.id} name={data.employee.name} from={from} to={to} /> ·{" "}
            {formatCalendarDate(from)} s.d. {formatCalendarDate(to)}. Klik tanggal untuk detail hari itu.
          </p>
        </div>
        <Link className="btn btn-primary" href={exportHref}>
          Unduh Excel pratinjau ini
        </Link>
      </div>
      {data.days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
          Belum ada baris kehadiran pada periode ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs text-ink-2">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Tanggal</th>
                <th className="px-2 py-2 font-medium">Masuk</th>
                <th className="px-2 py-2 font-medium">Keluar</th>
                <th className="px-2 py-2 font-medium">Telat</th>
                <th className="px-2 py-2 font-medium">Keterangan</th>
                <th className="px-2 py-2 font-medium">Lembur</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.date} className="border-b border-line/60">
                  <td className="px-2 py-2">
                    <Link
                      href={employeeHref(data.employee.id, from, to, day.date)}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {formatCalendarDate(day.date)}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{clock(day.clockInMin)}</td>
                  <td className="px-2 py-2">{clock(day.clockOutMin)}</td>
                  <td className="px-2 py-2">{day.late ? formatMinutes(day.lateMin ?? 0) : "—"}</td>
                  <td className="px-2 py-2 text-ink-2">{day.note ?? "—"}</td>
                  <td className="px-2 py-2">{day.overtimeMin === null ? "—" : formatMinutes(day.overtimeMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SoftLaborPreview({ report, query }: { report: SoftLaborReportDto; query: SoftLaborQuery }) {
  const flagged = report.summaries.filter(
    (row) => row.weeksOverLimit > 0 || row.restFlag || row.overtimeWithoutApprovalDays > 0,
  );
  const weeksOver = report.weeks.filter((row) => row.overLimit);
  const otGaps = report.overtime.filter((row) => row.gapMin > 0).slice(0, 40);
  const exportHref = exportHrefFor("soft-labor", query);
  const from = report.from;
  const to = report.to;

  return (
    <section className="panel flex flex-col gap-4" aria-labelledby="soft-preview-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="soft-preview-title" className="font-semibold">
            Pratinjau laporan lembur
          </h2>
          <p className="text-xs text-ink-2">
            Periode {formatCalendarDate(from)} s.d. {formatCalendarDate(to)}. {flagged.length} dari{" "}
            {report.summaries.length} pegawai punya temuan untuk ditinjau. Klik nama atau tanggal untuk detail.
          </p>
        </div>
        <Link className="btn btn-primary" href={exportHref}>
          Unduh Excel pratinjau ini
        </Link>
      </div>

      {report.summaries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
          Belum ada pegawai pada filter ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-ink-2">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Nama</th>
                <th className="px-2 py-2 font-medium">Departemen</th>
                <th className="px-2 py-2 font-medium">Minggu &gt; 40 jam</th>
                <th className="px-2 py-2 font-medium">Rentetan (hari)</th>
                <th className="px-2 py-2 font-medium">OT tanpa approve</th>
                <th className="px-2 py-2 font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {(flagged.length > 0 ? flagged : report.summaries).map((row) => (
                <tr key={row.employeeId} className="border-b border-line/60 align-top">
                  <td className="px-2 py-2">
                    <NameLink employeeId={row.employeeId} name={row.name} from={from} to={to} />
                  </td>
                  <td className="px-2 py-2 text-ink-2">{row.departmentName ?? "—"}</td>
                  <td className="px-2 py-2">
                    <MetricLink href={timesheetPreviewHref(row.employeeId, from, to)} value={row.weeksOverLimit} />
                  </td>
                  <td className="px-2 py-2">
                    <MetricLink
                      href={employeeHref(row.employeeId, from, to)}
                      value={`${row.maxWorkStreak}${row.restFlag ? " · tinjau" : ""}`}
                      active={row.maxWorkStreak > 0}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <MetricLink
                      href={timesheetPreviewHref(row.employeeId, from, to)}
                      value={row.overtimeWithoutApprovalDays}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs text-ink-2">{row.coachingNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {flagged.length > 0 && flagged.length < report.summaries.length ? (
            <p className="mt-2 text-xs text-ink-2">
              Menampilkan {flagged.length} pegawai dengan temuan. Excel berisi semua {report.summaries.length} pegawai.
            </p>
          ) : null}
        </div>
      )}

      {weeksOver.length > 0 ? (
        <div className="overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">Minggu di atas acuan 40 jam</h3>
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-xs text-ink-2">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Nama</th>
                <th className="px-2 py-2 font-medium">Minggu</th>
                <th className="px-2 py-2 font-medium">Jam aktual</th>
              </tr>
            </thead>
            <tbody>
              {weeksOver.map((row) => (
                <tr key={`${row.employeeId}-${row.week}`} className="border-b border-line/60">
                  <td className="px-2 py-2">
                    <NameLink employeeId={row.employeeId} name={row.name} from={from} to={to} />
                  </td>
                  <td className="px-2 py-2">{row.week}</td>
                  <td className="px-2 py-2">
                    <Link
                      href={timesheetPreviewHref(row.employeeId, from, to)}
                      className="underline-offset-2 hover:underline"
                    >
                      {formatMinutes(row.workedMin)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {otGaps.length > 0 ? (
        <div className="overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">Lembur teramati tanpa persetujuan (cuplikan)</h3>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-ink-2">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium">Nama</th>
                <th className="px-2 py-2 font-medium">Tanggal</th>
                <th className="px-2 py-2 font-medium">Teramati</th>
                <th className="px-2 py-2 font-medium">Disetujui</th>
                <th className="px-2 py-2 font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {otGaps.map((row) => (
                <tr key={`${row.employeeId}-${row.date}`} className="border-b border-line/60">
                  <td className="px-2 py-2">
                    <NameLink employeeId={row.employeeId} name={row.name} from={from} to={to} />
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      href={employeeHref(row.employeeId, from, to, row.date)}
                      className="underline-offset-2 hover:underline"
                    >
                      {formatCalendarDate(row.date)}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{formatMinutes(row.observedMin)}</td>
                  <td className="px-2 py-2">{formatMinutes(row.approvedMin)}</td>
                  <td className="px-2 py-2">{formatMinutes(row.gapMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.overtime.filter((row) => row.gapMin > 0).length > otGaps.length ? (
            <p className="mt-2 text-xs text-ink-2">Cuplikan 40 baris pertama. Rincian lengkap ada di Excel.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function exportHrefFor(
  kind: "attendance" | "timesheet" | "soft-labor",
  query: { from: string; to: string; departmentId?: string; employeeId?: string },
): string {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.departmentId) params.set("departmentId", query.departmentId);
  if (query.employeeId) params.set("employeeId", query.employeeId);
  const path =
    kind === "attendance"
      ? "/api/attendance/export"
      : kind === "timesheet"
        ? "/api/timesheet/export"
        : "/api/reports/soft-labor/export";
  return `${path}?${params.toString()}`;
}
