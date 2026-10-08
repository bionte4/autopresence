import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/current-user";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-canvas px-4 py-10 sm:px-6">
      <Suspense fallback={null}>
        <RedirectIfAuthenticated />
      </Suspense>
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface px-5 py-8 shadow-lg sm:px-8">
        <p className="text-sm font-semibold text-primary">Absensi Monitor</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Masuk</h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-ink-2">
          Masuk untuk memantau kehadiran dan integritas laporan.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}

async function RedirectIfAuthenticated() {
  await connection();
  const user = await getCurrentUser();
  if (user) redirect("/beranda");
  return null;
}
