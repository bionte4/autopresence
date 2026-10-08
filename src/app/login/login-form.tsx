"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/modules/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4" aria-label="Formulir masuk">
      {state?.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="email@perusahaan.local"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Kata sandi
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
