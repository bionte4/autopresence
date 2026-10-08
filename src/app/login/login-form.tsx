"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { loginAction, type LoginState } from "@/modules/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const [visible, setVisible] = useState(false);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4" aria-label="Formulir masuk">
      {state?.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="relative">
        <label htmlFor="login-email" className="sr-only">Email</label>
        <UserRound className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-2" strokeWidth={1.75} aria-hidden />
        <input
          id="login-email"
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="Email"
          className="h-12 w-full rounded-xl border border-[#d7e0ea] bg-white pr-4 pl-11 text-sm outline-none placeholder:text-ink-2"
        />
      </div>
      <div className="relative">
        <label htmlFor="login-password" className="sr-only">Kata sandi</label>
        <Lock className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-2" strokeWidth={1.75} aria-hidden />
        <input
          id="login-password"
          type={visible ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          required
          placeholder="Kata sandi"
          className="h-12 w-full rounded-xl border border-[#d7e0ea] bg-white pr-12 pl-11 text-sm outline-none placeholder:text-ink-2"
        />
        <button
          type="button"
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-ink-2"
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
        </button>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5b93f6] text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Memproses..." : "Masuk ke aplikasi"}
        {pending ? null : <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />}
      </button>
    </form>
  );
}
