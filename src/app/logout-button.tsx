"use client";

import { logoutAction } from "@/modules/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="btn btn-ghost"
      >
        Keluar
      </button>
    </form>
  );
}
