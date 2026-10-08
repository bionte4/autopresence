import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/logout-button";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";

export default function BerandaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </main>
      }
    >
      <BerandaContent />
    </Suspense>
  );
}

async function BerandaContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Beranda</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Anda masuk sebagai {user.name} ({ROLE_LABEL[user.role]}).
          </p>
        </div>
        <LogoutButton />
      </header>
      <nav className="flex flex-col gap-2 text-sm">
        {can(user, "department.manage") ? <Link href="/master/customers" className="underline">Pelanggan</Link> : null}
        {can(user, "department.manage") ? <Link href="/master/projects" className="underline">Proyek</Link> : null}
        {can(user, "department.manage") ? <Link href="/master/departments" className="underline">Departemen</Link> : null}
        {can(user, "employee.manage") ? <Link href="/master/employees" className="underline">Pegawai</Link> : null}
        {can(user, "schedule.manage") ? <Link href="/master/schedules" className="underline">Jadwal kerja</Link> : null}
        {can(user, "user.manage") ? <Link href="/admin/users" className="underline">Pengguna</Link> : null}
        {can(user, "audit.read") ? <Link href="/audit" className="underline">Audit log</Link> : null}
      </nav>
    </main>
  );
}
