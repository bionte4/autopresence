"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/modules/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="btn btn-ghost px-2 sm:px-3" aria-label="Keluar">
        <LogOut className="size-4 sm:hidden" strokeWidth={1.75} aria-hidden />
        <span className="hidden sm:inline">Keluar</span>
      </button>
    </form>
  );
}
