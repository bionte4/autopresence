"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderKanban,
  FolderTree,
  LayoutDashboard,
  Network,
  PenLine,
  ScrollText,
  TriangleAlert,
  Upload,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/app/logout-button";
import { NotificationBell } from "@/app/notifications/bell";
import { DensityToggle } from "@/components/shell/density-toggle";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import type { AuthUser } from "@/modules/rbac/policy";

export type ShellLink = { href: string; label: string; group: "main" | "data" | "audit" };

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/uploads": Upload,
  "/anomalies": TriangleAlert,
  "/monitoring": CalendarClock,
  "/corrections": PenLine,
  "/timesheet": CalendarDays,
  "/requests": ClipboardList,
  "/master/customers": Building2,
  "/master/projects": FolderKanban,
  "/master/departments": Network,
  "/master/employees": Users,
  "/master/schedules": Clock,
  "/admin/users": UserCog,
  "/audit": ScrollText,
};

export function AppShell({
  title,
  user,
  links,
  showBell,
  children,
}: {
  title: string;
  user: AuthUser;
  links: ShellLink[];
  showBell: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const main = links.filter((link) => link.group === "main");
  const data = links.filter((link) => link.group === "data");
  const audit = links.filter((link) => link.group === "audit");
  const bottom = main.slice(0, 4);
  const overflow = [...main.slice(4), ...data, ...audit];
  const matches = links.filter((link) => link.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-full bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[72px] flex-col border-r border-line bg-surface sm:flex lg:w-60">
        <p className="flex h-(--bar) items-center px-3 text-sm font-semibold tracking-tight lg:px-4">
          <span className="lg:hidden">AM</span>
          <span className="hidden lg:inline">Absensi Monitor</span>
        </p>
        <nav aria-label="Utama" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
          {main.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} />
          ))}
          {data.length > 0 ? <MasterMenu links={data} pathname={pathname} /> : null}
          {audit.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} />
          ))}
        </nav>
      </aside>
      <div className="sm:pl-[72px] lg:pl-60">
        <header className="flex h-(--bar) items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
          <p className="min-w-0 truncate text-sm font-semibold sm:hidden">Absensi Monitor</p>
          <button type="button" className="btn btn-ghost hidden sm:inline-flex" onClick={() => setPaletteOpen(true)}>
            Cari halaman
          </button>
          <div className="ml-auto flex shrink-0 items-center">
            {showBell ? <NotificationBell /> : null}
            <DensityToggle />
            <ThemeToggle />
            <span className="hidden px-2 text-sm text-ink-2 md:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-(--stack) px-4 py-5 pb-28 sm:pb-6">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {children}
        </main>
      </div>
      <nav
        aria-label="Utama"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {bottom.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-11 flex-1 items-center justify-center text-xs font-semibold">
            {link.label}
          </Link>
        ))}
        {overflow.length > 0 ? (
          <button type="button" className="min-h-11 flex-1 text-xs font-semibold" onClick={() => setMoreOpen(true)}>
            Lainnya
          </button>
        ) : null}
      </nav>
      {moreOpen ? (
        <div className="fixed inset-0 z-30 flex items-end bg-ink/40 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-label="Menu lainnya"
            className="w-full rounded-t-2xl border border-line bg-surface p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <ul className="flex flex-col">
              {overflow.map((link, index) => {
                const previous = overflow[index - 1];
                const heading = link.group === "data" && previous?.group !== "data" ? "Master" : null;
                return (
                  <li key={link.href}>
                    {heading ? <p className="px-1 pt-3 text-xs text-ink-2">{heading}</p> : null}
                    <Link href={link.href} className="flex min-h-11 items-center font-semibold" onClick={() => setMoreOpen(false)}>
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn mt-3 w-full" onClick={() => setMoreOpen(false)}>
              Tutup
            </button>
          </div>
        </div>
      ) : null}
      {paletteOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/40 px-4 pt-24" onClick={() => setPaletteOpen(false)}>
          <div
            role="dialog"
            aria-label="Cari halaman"
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              className="field"
              placeholder="Ketik nama halaman"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ul className="mt-3">
              {matches.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="flex min-h-11 items-center font-semibold" onClick={() => setPaletteOpen(false)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" className="btn mt-3" onClick={() => setPaletteOpen(false)}>
              Tutup
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ link, pathname, nested = false }: { link: ShellLink; pathname: string; nested?: boolean }) {
  const active = isCurrent(pathname, link.href);
  const Icon = ICONS[link.href];
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      title={link.label}
      className={`flex min-h-(--nav) items-center gap-3 rounded-lg text-sm ${nested ? "px-3" : "justify-center px-2 lg:justify-start lg:px-3"} ${active ? "bg-primary-soft font-semibold text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
    >
      {!nested ? <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden /> : null}
      <span className={nested ? "inline" : "hidden lg:inline"}>{link.label}</span>
    </Link>
  );
}

function MasterMenu({ links, pathname }: { links: ShellLink[]; pathname: string }) {
  const childActive = links.some((link) => isCurrent(pathname, link.href));
  const [prevPath, setPrevPath] = useState(pathname);
  const [open, setOpen] = useState(childActive);
  const [flyout, setFlyout] = useState(false);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setFlyout(false);
    if (childActive) setOpen(true);
  }

  return (
    <div className="relative mt-2">
      <button
        type="button"
        aria-expanded={open || flyout}
        title="Master"
        className={`flex min-h-(--nav) w-full items-center gap-3 rounded-lg px-2 text-sm lg:px-3 ${childActive ? "font-semibold text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
        onClick={() => {
          if (window.matchMedia("(min-width: 1024px)").matches) setOpen((value) => !value);
          else setFlyout((value) => !value);
        }}
      >
        <FolderTree className="mx-auto size-4 shrink-0 lg:mx-0" strokeWidth={1.75} aria-hidden />
        <span className="hidden flex-1 text-left lg:inline">Master</span>
        <ChevronRight className={`hidden size-4 transition-transform duration-150 lg:block ${open ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="mt-1 hidden flex-col gap-0.5 border-l border-line lg:ml-5 lg:flex lg:pl-2">
          {links.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} nested />
          ))}
        </div>
      ) : null}
      {flyout ? (
        <div className="absolute top-0 left-full z-30 ml-2 w-52 rounded-xl border border-line bg-surface p-2 shadow-lg lg:hidden">
          <p className="px-3 py-2 text-xs text-ink-2">Master</p>
          {links.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} nested />
          ))}
        </div>
      ) : null}
    </div>
  );
}
