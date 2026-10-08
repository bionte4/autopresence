"use client";

import { logoutAction } from "@/modules/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
      >
        Keluar
      </button>
    </form>
  );
}
