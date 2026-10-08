"use client";

export default function EmployeeDashboardError() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold">Detail pegawai</h1>
      <p role="alert" className="mt-4 text-sm text-danger">
        Detail pegawai gagal dimuat. Coba lagi.
      </p>
    </main>
  );
}