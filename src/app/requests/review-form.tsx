"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewForm({ id, seatLabel }: { id: string; seatLabel: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function decide(outcome: "approve" | "reject", form: HTMLFormElement) {
    const note = String(new FormData(form).get("note") ?? "");
    setPending(true);
    setError(null);
    const response = await fetch(`/api/requests/${id}/${outcome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const payload: unknown = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Keputusan gagal.");
      return;
    }
    router.refresh();
  }

  return (
    <form
      className="panel flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <h2 className="font-semibold">Keputusan {seatLabel}</h2>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Catatan
        <textarea name="note" required minLength={3} maxLength={500} className="field font-normal" />
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={(event) => void decide("approve", event.currentTarget.form!)}>
          Setujui
        </button>
        <button type="button" className="btn" disabled={pending} onClick={(event) => void decide("reject", event.currentTarget.form!)}>
          Tolak
        </button>
      </div>
    </form>
  );
}
