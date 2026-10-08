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
        className="btn btn-primary disabled:opacity-60"
      >
        {pending ? "Memeriksa..." : "Verifikasi hash-chain"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
