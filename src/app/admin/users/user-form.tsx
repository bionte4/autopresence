"use client";

import type { Role } from "@prisma/client";
import { useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
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
    else {
      formRef.current?.reset();
      setSelectedRole("EMPLOYEE");
      router.refresh();
    }
  }

  return (
    <form ref={formRef} action={onSubmit} className="panel grid gap-3 sm:grid-cols-2">
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <h2 className="font-semibold sm:col-span-2">{id ? "Ubah akun" : "Akun baru"}</h2>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Nama
        <input name="name" required defaultValue={name} className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Email
        <input name="email" type="email" required defaultValue={email} className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Kata sandi
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={id ? undefined : 12}
          required={!id}
          placeholder={id ? "Kosongkan jika tidak diubah" : "Minimal 12 karakter"}
          className="field font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Peran
        <select
          name="role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as Role)}
          className="field font-normal"
        >
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2 sm:col-span-2">
        Tautan pegawai
        <select name="employeeId" defaultValue={employeeId ?? ""} className="field font-normal">
          <option value="">Tidak ditautkan</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({employee.pin})
            </option>
          ))}
        </select>
      </label>
      {selectedRole === "MANAGER" ? (
        <fieldset className="flex flex-col gap-2 text-sm sm:col-span-2">
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
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isActive" defaultChecked={isActive} />
        Aktif
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary sm:col-span-2">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
