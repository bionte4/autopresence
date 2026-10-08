"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJson } from "../save";

type Option = { id: string; name: string };

export function ProjectForm({
  id,
  name,
  customerId,
  customers,
}: {
  id?: string;
  name?: string;
  customerId?: string;
  customers: Option[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const message = await saveJson(id ? `/api/projects/${id}` : "/api/projects", id ? "PATCH" : "POST", {
      name: formData.get("name"),
      customerId: formData.get("customerId"),
    });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    if (id) router.refresh();
    else router.push("/master/projects");
  }

  return (
    <form action={onSubmit} className="panel grid gap-3">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Pelanggan
        <select
          name="customerId"
          required
          defaultValue={customerId ?? ""}
          className="field font-normal"
        >
          <option value="">Pilih pelanggan</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Nama proyek
        <input
          name="name"
          required
          defaultValue={name}
          className="field font-normal"
        />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-60">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
