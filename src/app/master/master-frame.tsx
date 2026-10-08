import { AppShell, type ShellLink } from "@/components/shell/app-shell";
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
  const links: ShellLink[] = [
    can(user, "attendance.read") ? { href: "/dashboard", label: "Dasbor", group: "main" } : null,
    can(user, "upload.read") ? { href: "/uploads", label: "Unggah", group: "main" } : null,
    can(user, "anomaly.read") ? { href: "/anomalies", label: "Anomali", group: "main" } : null,
    can(user, "upload.read") ? { href: "/monitoring", label: "Pemantauan", group: "main" } : null,
    can(user, "attendance.read") ? { href: "/corrections", label: "Koreksi", group: "main" } : null,
    can(user, "attendance.read") ? { href: "/timesheet", label: "Timesheet", group: "main" } : null,
    can(user, "attendance.read") ? { href: "/requests", label: "Pengajuan", group: "main" } : null,
    can(user, "department.manage") ? { href: "/master/customers", label: "Pelanggan", group: "data" } : null,
    can(user, "department.manage") ? { href: "/master/projects", label: "Proyek", group: "data" } : null,
    can(user, "department.manage") ? { href: "/master/departments", label: "Departemen", group: "data" } : null,
    can(user, "employee.manage") ? { href: "/master/employees", label: "Pegawai", group: "data" } : null,
    can(user, "schedule.manage") ? { href: "/master/schedules", label: "Jadwal", group: "data" } : null,
    can(user, "user.manage") ? { href: "/admin/users", label: "Akun login", group: "data" } : null,
    can(user, "audit.read") ? { href: "/audit", label: "Audit", group: "audit" } : null,
  ].filter((link): link is ShellLink => link !== null);

  return (
    <AppShell title={title} user={user} links={links} showBell={can(user, "notification.read")}>
      {children}
    </AppShell>
  );
}
