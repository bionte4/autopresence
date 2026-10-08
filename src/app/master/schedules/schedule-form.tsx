"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinutes } from "@/lib/format";
import { saveJson } from "../save";

export function ScheduleForm({
  id,
  name,
  startMin,
  endMin,
  lateToleranceMin,
}: {
  id?: string;
  name?: string;
  startMin?: number;
  endMin?: number;
  lateToleranceMin?: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const message = await saveJson(id ? `/api/schedules/${id}` : "/api/schedules", id ? "PATCH" : "POST", {
      name: formData.get("name"),
      start: formData.get("start"),
      end: formData.get("end"),
      lateToleranceMin: Number(formData.get("lateToleranceMin")),
    });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    if (id) router.refresh();
    else router.push("/master/schedules");
  }

  return (
    <form action={onSubmit} className="grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nama
        <input name="name" required defaultValue={name} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Jam masuk
        <input name="start" type="time" required defaultValue={startMin === undefined ? "08:00" : formatMinutes(startMin)} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Jam pulang
        <input name="end" type="time" required defaultValue={endMin === undefined ? "17:05" : formatMinutes(endMin)} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Toleransi terlambat (menit)
        <input name="lateToleranceMin" type="number" min={0} required defaultValue={lateToleranceMin ?? 0} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
