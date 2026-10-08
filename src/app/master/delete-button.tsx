"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({
  url,
  label,
  redirectTo,
  detail,
}: {
  url: string;
  label: string;
  redirectTo: string;
  detail?: string;
}) {
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
        className="btn border-danger-soft text-danger"
      >
        Hapus
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="delete-title">{detail ?? `Hapus ${label}? Data tidak ditampilkan lagi.`}</p>
            {error ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void confirmDelete()}
                className="btn border-danger bg-danger text-white disabled:opacity-60"
              >
                {pending ? "Menghapus..." : "Ya, hapus"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn">
                Batal
              </button>
            </div>
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
