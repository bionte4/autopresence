"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJson } from "../save";

type ProjectOption = { id: string; name: string; customerName: string };
type UserOption = { id: string; name: string };
type Reviewers = {
  TEAM_LEADER: { userId: string; name: string } | null;
  OPERATION_MANAGER: { userId: string; name: string } | null;
  PROJECT_MANAGER: { userId: string; name: string } | null;
};

const SEATS = [
  ["TEAM_LEADER", "Team Leader"],
  ["OPERATION_MANAGER", "Operation Manager"],
  ["PROJECT_MANAGER", "Project Manager"],
] as const;

export function DepartmentForm({
  id,
  name,
  projectId,
  projects,
  users,
  reviewers,
}: {
  id?: string;
  name?: string;
  projectId?: string | null;
  projects: ProjectOption[];
  users?: UserOption[];
  reviewers?: Reviewers;
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
      ...(users
        ? {
            reviewers: {
              TEAM_LEADER: formData.get("TEAM_LEADER"),
              OPERATION_MANAGER: formData.get("OPERATION_MANAGER"),
              PROJECT_MANAGER: formData.get("PROJECT_MANAGER"),
            },
          }
        : {}),
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
      {users ? (
        <fieldset className="grid gap-3">
          <legend className="text-xs text-ink-2">Rantai peninjau pengajuan dan koreksi</legend>
          {SEATS.map(([seat, label]) => (
            <label key={seat} className="flex flex-col gap-1 text-xs text-ink-2">
              {label}
              <select name={seat} defaultValue={reviewers?.[seat]?.userId ?? ""} className="field font-normal">
                <option value="">Belum ditunjuk</option>
                {users.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-60">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
