import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Akses ditolak</h1>
      <p className="text-sm text-ink-2">
        Akun Anda tidak memiliki izin untuk halaman ini.
      </p>
      <Link href="/beranda" className="text-sm font-medium underline">
        Kembali ke beranda
      </Link>
    </main>
  );
}
