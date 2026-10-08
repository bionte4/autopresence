"use client";

export default function MasterError() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold">Data master</h1>
      <p role="alert" className="mt-4 text-sm text-red-700">
        Data gagal dimuat. Periksa pencarian atau coba lagi.
      </p>
    </main>
  );
}
