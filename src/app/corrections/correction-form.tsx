"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCalendarDate, formatMinutes } from "@/lib/format";

type RecordOption = {
  id: string;
  employeeName: string;
  date: string;
  clockInMin: number | null;
  clockOutMin: number | null;
};

function minutesOrSkip(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "");
  if (!text) return undefined;
  const [hours, minutes] = text.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  return hours * 60 + minutes;
}

export function CorrectionForm({ records }: { records: RecordOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (records.length === 0) {
    return <p className="text-sm text-zinc-600">Belum ada baris kehadiran yang bisa dikoreksi.</p>;
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const form = new FormData(event.currentTarget);
        const body: Record<string, unknown> = {
          recordId: String(form.get("recordId") ?? ""),
          reason: String(form.get("reason") ?? ""),
        };
        const clockInMin = minutesOrSkip(form.get("clockIn"));
        const clockOutMin = minutesOrSkip(form.get("clockOut"));
        const note = String(form.get("note") ?? "").trim();
        const evidenceNote = String(form.get("evidenceNote") ?? "").trim();
        if (clockInMin !== undefined) body.clockInMin = clockInMin;
        if (clockOutMin !== undefined) body.clockOutMin = clockOutMin;
        if (note) body.note = note;
        if (evidenceNote) body.evidenceNote = evidenceNote;
        const response = await fetch("/api/corrections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
        setPending(false);
        if (!response.ok || !payload?.id) {
          setError(payload?.error ?? "Koreksi gagal diajukan.");
          return;
        }
        router.push(`/corrections/${payload.id}`);
        router.refresh();
      }}
    >
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Baris kehadiran
        <select name="recordId" required className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {records.map((row) => (
            <option key={row.id} value={row.id}>
              {row.employeeName} · {formatCalendarDate(row.date)} · masuk {row.clockInMin === null ? "—" : formatMinutes(row.clockInMin)} · keluar {row.clockOutMin === null ? "—" : formatMinutes(row.clockOutMin)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Jam masuk baru
        <input name="clockIn" type="time" className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Jam keluar baru
        <input name="clockOut" type="time" className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Keterangan baru
        <input name="note" maxLength={200} className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Alasan
        <textarea name="reason" required minLength={3} maxLength={500} className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Bukti (opsional)
        <input name="evidenceNote" maxLength={500} className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      {error ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
      <button type="submit" disabled={pending} className="self-start rounded-md border px-3 py-2 text-sm">Ajukan koreksi</button>
    </form>
  );
}
