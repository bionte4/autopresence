"use client";

import type { Role } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABEL } from "@/lib/labels";
import { saveJson } from "@/app/master/save";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export function UserForm({
  id,
  email,
  name,
  role = "EMPLOYEE",
  isActive = true,
  employeeId,
  managedDepartmentIds = [],
  departments,
  employees,
}: {
  id?: string;
  email?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
  employeeId?: string | null;
  managedDepartmentIds?: string[];
  departments: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string; pin: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>(role);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const message = await saveJson(id ? `/api/users/${id}` : "/api/users", id ? "PATCH" : "POST", {
      email: formData.get("email"),
      name: formData.get("name"),
      password: formData.get("password"),
      role: formData.get("role"),
      isActive: formData.get("isActive") === "on",
      employeeId: formData.get("employeeId"),
      managedDepartmentIds: formData.getAll("managedDepartmentIds"),
    });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    if (id) router.refresh();
    else router.push("/admin/users");
  }

  return (
    <form action={onSubmit} className="grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nama
        <input name="name" required defaultValue={name} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" required defaultValue={email} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Kata sandi
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={id ? undefined : 12}
          required={!id}
          placeholder={id ? "Kosongkan jika tidak diubah" : "Minimal 12 karakter"}
          className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Peran
        <select
          name="role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as Role)}
          className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900"
        >
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tautan pegawai
        <select name="employeeId" defaultValue={employeeId ?? ""} className="rounded-md border px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Tidak ditautkan</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({employee.pin})
            </option>
          ))}
        </select>
      </label>
      {selectedRole === "MANAGER" ? (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">Departemen yang dikelola</legend>
          {departments.map((department) => (
            <label key={department.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="managedDepartmentIds"
                value={department.id}
                defaultChecked={managedDepartmentIds.includes(department.id)}
              />
              {department.name}
            </label>
          ))}
        </fieldset>
      ) : null}
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
