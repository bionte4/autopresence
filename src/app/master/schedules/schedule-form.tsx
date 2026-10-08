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
    <form action={onSubmit} className="panel grid gap-3">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Nama
        <input name="name" required defaultValue={name} className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Jam masuk
        <input name="start" type="time" required defaultValue={startMin === undefined ? "08:00" : formatMinutes(startMin)} className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Jam pulang
        <input name="end" type="time" required defaultValue={endMin === undefined ? "17:05" : formatMinutes(endMin)} className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Toleransi terlambat (menit)
        <input name="lateToleranceMin" type="number" min={0} required defaultValue={lateToleranceMin ?? 0} className="field font-normal" />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-60">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
