"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJson } from "../save";

export function CustomerForm({ id, name }: { id?: string; name?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const message = await saveJson(id ? `/api/customers/${id}` : "/api/customers", id ? "PATCH" : "POST", {
      name: formData.get("name"),
    });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    if (id) router.refresh();
    else router.push("/master/customers");
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nama pelanggan
        <input
          name="name"
          required
          defaultValue={name}
          className="rounded-md border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
