"use client";

export default function DashboardError() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold">Dasbor</h1>
      <p role="alert" className="mt-4 text-sm text-red-700">
        Dasbor gagal dimuat. Periksa filter atau coba lagi.
      </p>
    </main>
  );
}
