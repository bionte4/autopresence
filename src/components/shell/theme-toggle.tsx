"use client";

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
    <button type="button" className="btn btn-ghost" onClick={apply}>
      Tema
    </button>
  );
}
