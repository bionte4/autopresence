"use client";

import { useState } from "react";
import { verifyResponseSchema } from "@/modules/audit/schema";

export function VerifyButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/audit/verify");
      if (!response.ok) {
        setMessage("Verifikasi gagal dijalankan.");
        return;
      }
      const body: unknown = await response.json();
      const result = verifyResponseSchema.parse(body);
      setMessage(
        result.valid
          ? `Rantai hash valid (${result.checked} entri).`
          : `Rantai hash rusak pada entri ${result.brokenAtId ?? "-"}.`,
      );
    } catch {
      setMessage("Verifikasi gagal dijalankan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Memeriksa..." : "Verifikasi hash-chain"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
