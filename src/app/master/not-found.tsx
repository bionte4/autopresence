import Link from "next/link";

export default function MasterNotFound() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <h1 className="text-2xl font-semibold">Data tidak ditemukan</h1>
      <Link href="/master/departments" className="mt-4 inline-block text-sm underline">
        Kembali
      </Link>
    </main>
  );
}
