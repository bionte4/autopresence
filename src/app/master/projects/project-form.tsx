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
    <form action={onSubmit} className="grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Pelanggan
        <select
          name="customerId"
          required
          defaultValue={customerId ?? ""}
          className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Pilih pelanggan</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nama proyek
        <input
          name="name"
          required
          defaultValue={name}
          className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
