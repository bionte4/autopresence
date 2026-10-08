"use client";

import { SunMoon } from "lucide-react";

export function ThemeToggle() {
  function apply() {
    const current = document.documentElement.dataset.theme;
    const next = current === "dark" ? "light" : current === "light" ? "system" : "dark";
    if (next === "system") {
      localStorage.removeItem("absensi-theme");
      delete document.documentElement.dataset.theme;
      return;
    }
    localStorage.setItem("absensi-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <button type="button" className="btn btn-ghost px-2 sm:px-3" aria-label="Ganti tema" onClick={apply}>
      <SunMoon className="size-4 sm:hidden" strokeWidth={1.75} aria-hidden />
      <span className="hidden sm:inline">Tema</span>
    </button>
  );
}
