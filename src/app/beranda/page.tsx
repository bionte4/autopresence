import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { MasterFrame } from "@/app/master/master-frame";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentUser } from "@/modules/auth/current-user";
import { can } from "@/modules/rbac/policy";

export default function BerandaPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat beranda...</p>}>
      <BerandaContent />
    </Suspense>
  );
}

async function BerandaContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const next = can(user, "upload.read")
    ? { href: "/uploads", label: "Unggah laporan" }
    : can(user, "anomaly.read")
      ? { href: "/anomalies", label: "Lihat anomali" }
      : { href: "/dashboard", label: "Lihat kehadiran" };

  return (
    <MasterFrame title="Beranda" user={user}>
      <p className="max-w-prose text-sm text-ink-2">
        Anda masuk sebagai {user.name} ({ROLE_LABEL[user.role]}).
      </p>
      <Link href={next.href} className="btn btn-primary self-start">
        {next.label}
      </Link>
    </MasterFrame>
  );
}
