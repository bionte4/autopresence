"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const WEEKDAYS = [
  ["1", "Senin"],
  ["2", "Selasa"],
  ["3", "Rabu"],
  ["4", "Kamis"],
  ["5", "Jumat"],
  ["6", "Sabtu"],
  ["7", "Minggu"],
];

export function ScheduleForm({
  id,
  granularity = "DAILY",
  cutoffTime = "10:00",
  dayOfWeek = null,
  dayOfMonth = null,
  enabled = true,
}: {
  id?: string;
  granularity?: "DAILY" | "WEEKLY" | "MONTHLY";
  cutoffTime?: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  enabled?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState(granularity);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = formRef.current;
    if (!formElement) return;
    setPending(true);
    setError(null);
    const form = new FormData(formElement);
    const chosen = String(form.get("granularity") ?? "DAILY");
    const body: Record<string, unknown> = {
      granularity: chosen,
      cutoffTime: String(form.get("cutoffTime") || "10:00"),
      enabled: form.get("enabled") === "on",
    };
    if (chosen === "WEEKLY") body.dayOfWeek = Number(form.get("dayOfWeek"));
    if (chosen === "MONTHLY") body.dayOfMonth = Number(form.get("dayOfMonth"));
    const response = await fetch(id ? `/api/upload-schedules/${id}` : "/api/upload-schedules", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(payload?.error ?? "Jadwal gagal disimpan.");
      return;
    }
    if (id) router.push("/monitoring");
    else {
      formRef.current?.reset();
      setKind("DAILY");
    }
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      className="panel grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(event) => void onSubmit(event)}
    >
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Jenis
        <select
          name="granularity"
          value={kind}
          onChange={(event) => setKind(event.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
          className="field font-normal"
        >
          <option value="DAILY">Harian</option>
          <option value="WEEKLY">Mingguan</option>
          <option value="MONTHLY">Bulanan</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Batas waktu (WIB)
        <input name="cutoffTime" type="time" defaultValue={cutoffTime} required className="field font-normal" />
      </label>
      {kind === "WEEKLY" ? (
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Hari mingguan
          <select name="dayOfWeek" defaultValue={String(dayOfWeek ?? 5)} required className="field font-normal">
            {WEEKDAYS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === "MONTHLY" ? (
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Tanggal bulanan
          <input
            name="dayOfMonth"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={dayOfMonth ?? ""}
            className="field font-normal"
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2 self-end text-sm">
        <input name="enabled" type="checkbox" defaultChecked={enabled} />
        Aktif
      </label>
      {error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn self-end">{id ? "Simpan perubahan" : "Simpan jadwal"}</button>
    </form>
  );
}
