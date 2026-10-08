import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DiffTable } from "@/components/domain/diff-table";
import { EmptyState } from "@/components/domain/empty-state";
import { IntegritySeal } from "@/components/domain/integrity-seal";
import { SeverityBadge } from "@/components/domain/severity-badge";
import { UploadPipeline } from "@/components/domain/upload-pipeline";
import { MasterFrame } from "@/app/master/master-frame";
import { getCurrentUser } from "@/modules/auth/current-user";

export default function DesignSystemPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm">Memuat sistem desain...</p>}>
      <DesignSystem />
    </Suspense>
  );
}

async function DesignSystem() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <MasterFrame title="Sistem desain" user={user}>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Segel integritas</h2>
        <IntegritySeal tone="ok" title="Data terverifikasi" detail="Unggah terakhir 8 Okt 2026, 09.12" hash="a3f9c21eabcdef" />
        <IntegritySeal tone="warn" title="2 anomali perlu ditinjau" detail="Unggah terakhir 8 Okt 2026, 09.12" hash="a3f9c21eabcdef" action={{ href: "/anomalies", label: "Tinjau anomali" }} />
        <IntegritySeal tone="critical" title="Anomali kritis terbuka" detail="Data kehadiran berubah antar unggah" />
      </section>
      <section className="flex flex-wrap gap-2">
        <h2 className="w-full text-lg font-semibold">Tingkat anomali</h2>
        <SeverityBadge severity="LOW" />
        <SeverityBadge severity="MEDIUM" />
        <SeverityBadge severity="HIGH" />
        <SeverityBadge severity="CRITICAL" />
      </section>
      <section className="panel">
        <h2 className="font-semibold">Pemeriksaan berkas</h2>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <UploadPipeline status="PARSED_WITH_ANOMALIES" />
          <UploadPipeline status="REJECTED" />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Perbandingan</h2>
        <DiffTable
          details={{
            before: { clockInMin: 570, lateMin: 90, note: null },
            after: { clockInMin: 478, lateMin: 0, note: "Mesin salah" },
          }}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Keadaan</h2>
        <EmptyState title="Belum ada laporan untuk periode ini." action={{ href: "/uploads", label: "Unggah laporan" }} />
        <p role="alert" className="panel text-sm text-danger">Daftar gagal dimuat. Periksa koneksi, lalu coba lagi.</p>
        <button type="button" className="btn" disabled>
          Sedang menyimpan
        </button>
      </section>
    </MasterFrame>
  );
}
