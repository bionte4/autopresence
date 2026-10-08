import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/current-user";

export default function Home() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-ink-2">Memuat...</p>}>
      <HomeRedirect />
    </Suspense>
  );
}

async function HomeRedirect() {
  await connection();
  const user = await getCurrentUser();
  redirect(user ? "/beranda" : "/login");
  return null;
}
