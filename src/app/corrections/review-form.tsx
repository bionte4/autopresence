"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewForm({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function decide(outcome: "approve" | "reject", form: HTMLFormElement) {
    setPending(true);
    setError(null);
    const note = String(new FormData(form).get("note") ?? "");
    const response = await fetch(`/api/corrections/${id}/${outcome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(payload?.error ?? "Keputusan gagal disimpan.");
      return;
    }
    router.refresh();
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Catatan keputusan
        <textarea name="note" required minLength={3} maxLength={500} className="rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          className="rounded-md border px-3 py-2 text-sm"
          onClick={(event) => {
            const form = event.currentTarget.form;
            if (form) void decide("approve", form);
          }}
        >
          Setujui
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border px-3 py-2 text-sm"
          onClick={(event) => {
            const form = event.currentTarget.form;
            if (form) void decide("reject", form);
          }}
        >
          Tolak
        </button>
      </div>
    </form>
  );
}
