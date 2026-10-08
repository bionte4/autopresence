"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJson } from "../save";

type Option = { id: string; name: string };

export function EmployeeForm({
  id,
  pin,
  name,
  departmentId,
  scheduleId,
  isActive = true,
  departments,
  schedules,
}: {
  id?: string;
  pin?: string;
  name?: string;
  departmentId?: string | null;
  scheduleId?: string;
  isActive?: boolean;
  departments: Option[];
  schedules: Option[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const message = await saveJson(id ? `/api/employees/${id}` : "/api/employees", id ? "PATCH" : "POST", {
      pin: formData.get("pin"),
      name: formData.get("name"),
      departmentId: formData.get("departmentId"),
      scheduleId: formData.get("scheduleId"),
      isActive: formData.get("isActive") === "on",
    });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    if (id) router.refresh();
    else router.push("/master/employees");
  }

  return (
    <form action={onSubmit} className="grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        PIN
        <input name="pin" required defaultValue={pin} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nama
        <input name="name" required defaultValue={name} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Departemen
        <select name="departmentId" defaultValue={departmentId ?? ""} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Tanpa departemen</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Jadwal
        <select name="scheduleId" required defaultValue={scheduleId ?? ""} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Pilih jadwal</option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>
              {schedule.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={isActive} />
        Aktif
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
