"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AnomalyActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const closed = status === "RESOLVED" || status === "FALSE_POSITIVE";

  async function submit(path: string, body?: unknown) {
    setPending(true);
    setError(null);
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(payload?.error ?? "Tindakan gagal.");
      return;
    }
    router.refresh();
  }

  if (closed) return null;

  return (
    <div className="flex flex-col gap-3">
      {status === "OPEN" ? (
        <button
          type="button"
          disabled={pending}
          className="self-start rounded-md border px-3 py-2 text-sm"
          onClick={() => submit(`/api/anomalies/${id}/ack`)}
        >
          Tandai diketahui
        </button>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Catatan penyelesaian
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          required
          minLength={3}
          className="min-h-24 rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => submit(`/api/anomalies/${id}/resolve`, { outcome: "RESOLVED", note })}
        >
          Selesaikan
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => submit(`/api/anomalies/${id}/resolve`, { outcome: "FALSE_POSITIVE", note })}
        >
          Bukan masalah
        </button>
      </div>
    </div>
  );
}
