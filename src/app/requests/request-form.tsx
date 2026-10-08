"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function minutes(value: string): number | null {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function RequestForm({ employees }: { employees: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [kind, setKind] = useState("LEAVE");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const endClock = String(form.get("endClock") ?? "");
    const body = {
      employeeId: String(form.get("employeeId") ?? ""),
      kind,
      startDate: String(form.get("startDate") ?? ""),
      endDate: kind === "OVERTIME" ? String(form.get("startDate") ?? "") : String(form.get("endDate") ?? ""),
      reason: String(form.get("reason") ?? ""),
      ...(kind === "OVERTIME" && endClock ? { endMin: minutes(endClock) } : {}),
    };
    setPending(true);
    setError(null);
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Pengajuan gagal.");
      return;
    }
    router.refresh();
    formElement.reset();
    setKind("LEAVE");
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="panel grid gap-3 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">Ajukan cuti, sakit, atau lembur</h2>
      {error ? (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Pegawai
        <select name="employeeId" required className="field" defaultValue={employees[0]?.id ?? ""}>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Jenis
        <select name="kind" className="field" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="LEAVE">Cuti</option>
          <option value="SICK">Sakit</option>
          <option value="OVERTIME">Lembur</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Dari
        <input type="date" name="startDate" required className="field" />
      </label>
      {kind === "OVERTIME" ? (
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Jam selesai
          <input type="time" name="endClock" required className="field" />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-ink-2">
          Sampai
          <input type="date" name="endDate" required className="field" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-ink-2 sm:col-span-2">
        Alasan
        <textarea name="reason" required minLength={3} maxLength={500} className="field font-normal" />
      </label>
      <button type="submit" className="btn btn-primary sm:col-span-2" disabled={pending || employees.length === 0}>
        {pending ? "Mengirim..." : "Ajukan"}
      </button>
    </form>
  );
}
