"use client";

export default function UploadsError() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold">Upload laporan</h1>
      <p role="alert" className="mt-4 text-sm text-danger">
        Daftar upload gagal dimuat. Periksa pencarian atau coba lagi.
      </p>
    </main>
  );
}
