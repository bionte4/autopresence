"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJson } from "../save";

type ProjectOption = { id: string; name: string; customerName: string };

export function DepartmentForm({
  id,
  name,
  projectId,
  projects,
}: {
  id?: string;
  name?: string;
  projectId?: string | null;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const message = await saveJson(id ? `/api/departments/${id}` : "/api/departments", id ? "PATCH" : "POST", {
      name: formData.get("name"),
      projectId: formData.get("projectId"),
    });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    if (id) router.refresh();
    else router.push("/master/departments");
  }

  return (
    <form action={onSubmit} className="panel grid gap-3">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Nama departemen
        <input
          name="name"
          required
          defaultValue={name}
          className="field font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-2">
        Proyek
        <select
          name="projectId"
          defaultValue={projectId ?? ""}
          className="field font-normal"
        >
          <option value="">Tanpa proyek</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.customerName} — {project.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-60">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
