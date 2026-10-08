"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("absensi-density", onStoreChange);
  return () => window.removeEventListener("absensi-density", onStoreChange);
}

function snapshot() {
  return document.documentElement.dataset.density === "compact";
}

export function DensityToggle() {
  const compact = useSyncExternalStore(subscribe, snapshot, () => false);

  function apply() {
    if (document.documentElement.dataset.density === "compact") {
      delete document.documentElement.dataset.density;
      localStorage.removeItem("absensi-density");
    } else {
      document.documentElement.dataset.density = "compact";
      localStorage.setItem("absensi-density", "compact");
    }
    window.dispatchEvent(new Event("absensi-density"));
  }

  return (
    <button type="button" className="btn btn-ghost" aria-pressed={compact} onClick={apply} suppressHydrationWarning>
      {compact ? "Ringkas" : "Nyaman"}
    </button>
  );
}
