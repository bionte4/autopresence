"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("confirm", confirm ? "true" : "false");
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const body = (await response.json()) as { error?: string; code?: string; id?: string };
    setPending(false);
    if (response.status === 409 && body.code === "GRANULARITY_MISMATCH") {
      setNeedsConfirm(true);
      setError(body.error ?? "Periode tidak sesuai. Centang konfirmasi lalu simpan lagi.");
      return;
    }
    if (!response.ok || !body.id) {
      setError(body.error ?? "Upload gagal.");
      return;
    }
    setNeedsConfirm(false);
    setConfirm(false);
    router.push(`/uploads/${body.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="panel grid gap-3">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Berkas laporan
        <input name="file" type="file" accept=".xlsx" required className="field font-normal file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-sm file:font-semibold file:text-primary" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Jenis periode
        <select name="granularity" defaultValue="MONTHLY" className="field font-normal">
          <option value="DAILY">Harian</option>
          <option value="WEEKLY">Mingguan</option>
          <option value="MONTHLY">Bulanan</option>
        </select>
      </label>
      {needsConfirm ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
          Simpan meskipun rentang periode tidak sesuai jenis yang dipilih
        </label>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? "Mengunggah..." : "Unggah"}
      </button>
    </form>
  );
}
