import Link from "next/link";
import { LogoutButton } from "@/app/logout-button";
import { can, type AuthUser } from "@/modules/rbac/policy";

export function MasterFrame({
  title,
  user,
  children,
}: {
  title: string;
  user: AuthUser;
  children: React.ReactNode;
}) {
  const links = [
    can(user, "department.manage") ? { href: "/master/customers", label: "Pelanggan" } : null,
    can(user, "department.manage") ? { href: "/master/projects", label: "Proyek" } : null,
    can(user, "department.manage") ? { href: "/master/departments", label: "Departemen" } : null,
    can(user, "employee.manage") ? { href: "/master/employees", label: "Pegawai" } : null,
    can(user, "schedule.manage") ? { href: "/master/schedules", label: "Jadwal" } : null,
    can(user, "user.manage") ? { href: "/admin/users", label: "Pengguna" } : null,
  ].filter((link) => link !== null);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="underline">
              {link.label}
            </Link>
          ))}
          <Link href="/beranda" className="underline">
            Beranda
          </Link>
          <LogoutButton />
        </div>
      </header>
      {children}
    </main>
  );
}
