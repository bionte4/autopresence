"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/modules/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4" aria-label="Formulir masuk">
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
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
          className="field font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Kata sandi
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="field font-normal"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-2 w-full disabled:opacity-60"
      >
        {pending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
