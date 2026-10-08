import { Suspense } from "react";
import { connection } from "next/server";
import { Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/current-user";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[#e7eef6] px-4 py-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(19,34,43,0.12)] lg:min-h-[560px] lg:grid-cols-[minmax(16rem,0.9fr)_1.1fr]">
        <div
          className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-[#1e4fd7] px-8 py-10 text-white sm:px-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        >
          <div>
            <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/30 bg-white/10">
              <Shield className="size-6" strokeWidth={1.75} aria-hidden />
            </span>
            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-balance">Absensi Project BI.</h1>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/85">
              Kelola kehadiran jadi lebih mudah, cepat, dan praktis.
            </p>
          </div>
          <p className="mt-10 text-sm text-white/80">
            <span className="mb-3 block h-px w-10 bg-white/70" />
            <span className="text-[11px] tracking-[0.18em]">POWERED BY</span>
            <span className="mt-2 block text-2xl font-semibold tracking-tight">lintasarta</span>
          </p>
        </div>
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Halo, Rekan Kerja!</h2>
          <p className="mt-2 text-sm text-ink-2">Silakan masuk dulu untuk mulai administrasi absensi.</p>
          <Suspense fallback={null}>
            <RedirectIfAuthenticated />
          </Suspense>
          <LoginForm />
          <p className="mt-10 text-center text-xs text-ink-2">© 2026 Lintasarta · Project Bank Indonesia</p>
        </div>
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
