import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/current-user";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense fallback={null}>
        <RedirectIfAuthenticated />
      </Suspense>
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">Absensi Monitor</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
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
