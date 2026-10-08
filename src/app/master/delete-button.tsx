"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ url, label, redirectTo }: { url: string; label: string; redirectTo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    setError(null);
    const response = await fetch(url, { method: "DELETE" });
    const body: unknown = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(messageFrom(body));
      return;
    }
    setOpen(false);
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
      >
        Hapus
      </button>
      {open ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="mt-3 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
        >
          <p id="delete-title">Hapus {label}? Data tidak ditampilkan lagi.</p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void confirmDelete()}
              className="rounded-md bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {pending ? "Menghapus..." : "Ya, hapus"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-2 text-sm">
              Batal
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function messageFrom(body: unknown): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  return "Gagal menghapus.";
}
