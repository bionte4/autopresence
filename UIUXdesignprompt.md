# UI/UX DESIGN PROMPT — Absensi Monitor

> **Cara pakai**
> - **Cursor:** taruh file ini di root repo bersama `MASTER_PROMPT.md` dan `.cursorrules`. Tempel **PROMPT A** ke Agent setelah M1 (Auth + RBAC) selesai, atau sebelum M5 (Dashboard) paling lambat.
> - **Figma AI / v0 / Stitch / Lovable:** tempel **PROMPT B** (versi ringkas), lalu lampirkan bagian 3–6 sebagai konteks.
> - Minta AI **membuat rencana desain dulu** (token + wireframe), baru kode. Tinjau rencana itu sebelum lanjut.

---

## PROMPT A — untuk Cursor (implementasi UI)

```
Kamu adalah product designer + frontend engineer senior. Baca UIUX_DESIGN_PROMPT.md bagian 1–10,
MASTER_PROMPT.md dan .cursorrules.

Langkah 1 (JANGAN tulis kode dulu): buat rencana desain singkat:
 a. Token: palet (4–6 warna bernama + semantik), tipografi, radius, spacing, elevasi.
 b. Wireframe ASCII untuk: Dashboard (desktop & mobile), Detail Upload, Detail Anomali (diff), Monitoring Upload.
 c. Satu "elemen khas" produk dan alasannya.
 d. Review rencana terhadap daftar "Hindari" di bagian 2. Jika ada bagian yang terasa template generik, revisi dan jelaskan perubahannya.
Tunggu persetujuan saya.

Langkah 2 (setelah disetujui): implementasikan sebagai design system di Next.js + Tailwind + shadcn/ui:
 - Token sebagai CSS variables di globals.css (light + dark), dipetakan ke tailwind.config.
 - Komponen dasar di src/components/ui, komponen domain di src/components/domain
   (SeverityBadge, IntegritySeal, KpiStat, AttendanceHeatmap, DiffTable, UploadPipeline, DataTable responsif, EmptyState, NotificationBell).
 - Halaman prioritas: /dashboard, /uploads, /uploads/[id], /anomalies, /monitoring.
 - Pastikan responsif 360px–1920px, dark mode, keyboard accessible, prefers-reduced-motion dihormati.
 - Berikan halaman /dev/design-system yang menampilkan semua komponen dan state-nya (loading, kosong, error, disabled).
Kerjakan per halaman; setelah tiap halaman, jalankan typecheck + lint dan laporkan hasilnya.
```

---

## PROMPT B — untuk Figma AI / v0 / Stitch (versi ringkas)

```
Desain dashboard web responsif (desktop, tablet, mobile) bernama "Absensi Monitor" untuk tim HR,
manager, dan pegawai di perusahaan Indonesia. Fungsi utama: mengunggah laporan absensi Excel,
melihat perhitungan keterlambatan per pegawai, dan memantau anomali yang menandakan data diubah.
Kesan: tenang, tepercaya, rapi seperti alat audit, bukan dasbor "startup" generik.
Bahasa antarmuka: Bahasa Indonesia, kalimat biasa (sentence case).
Palet: kanvas abu kebiruan #EEF2F5, permukaan putih, tinta #13222B, primer biru kobalt #27439B,
semantik: sukses #1F7A4D, peringatan #9A5B00, bahaya #B4321E, kritis #8E1138. Sediakan mode gelap.
Font: Plus Jakarta Sans (angka tabular), monospace hanya untuk hash.
Elemen khas: "Segel integritas", pita status di atas dashboard yang menyatakan apakah data terakhir
terverifikasi, ada berapa anomali terbuka, dan kapan upload terakhir.
Halaman: Dashboard, Unggah laporan (dengan progres pipeline), Detail upload, Daftar anomali,
Detail anomali (perbandingan sebelum/sesudah), Monitoring kepatuhan upload, Notifikasi.
Mobile: bottom navigation, tabel menjadi daftar kartu baris, filter di bottom sheet.
Hindari: label huruf kapital berjarak di atas judul, deretan kartu identik dengan bayangan sama,
gradien dekoratif, ikon di dalam lingkaran berwarna pada setiap kartu, panah → di setiap tombol.
```

---

## 1. Konteks produk (agar desain relevan)

- **Produk:** aplikasi monitoring absensi yang menerima upload Excel (harian, mingguan, bulanan), menghitung keterlambatan, dan **mendeteksi indikasi manipulasi data** dengan alert.
- **Pengguna & tugas utama:**
  - **HR Admin:** unggah laporan, pastikan data valid, selesaikan anomali. Butuh *kepercayaan* dan *kecepatan menemukan masalah*.
  - **Manager:** pantau tim (siapa terlambat, pola berulang), tindak lanjuti anomali ringan.
  - **Pegawai:** lihat kehadiran sendiri, ajukan koreksi.
  - **Auditor:** baca saja, telusuri riwayat dan audit log.
- **Perasaan yang dituju:** *"Data ini bisa dipercaya, dan kalau ada yang janggal saya langsung tahu."* Desain harus mengomunikasikan keandalan, bukan dekorasi.
- **Perangkat:** HR dominan desktop; manager dan pegawai sering lewat ponsel (Android menengah, jaringan tidak selalu cepat). Mobile bukan versi pelengkap.

## 2. Arah visual

**Karakter:** *ledger yang tenang*. Bersih, padat informasi tetapi lega, seperti buku catatan audit yang modern. Satu elemen berani, sisanya disiplin.

**Elemen khas (tempat "keberanian" visual dihabiskan): Segel Integritas.**
Pita status di puncak dashboard dan di setiap detail upload: ikon perisai/centang, kalimat status ("Data terverifikasi" / "2 anomali perlu ditinjau"), waktu upload terakhir, dan hash singkat (8 karakter) yang bisa diklik untuk menyalin hash penuh. Berubah warna sesuai tingkat risiko tertinggi yang masih terbuka. Elemen lain dibuat tenang agar segel ini yang diingat.

**Hindari (terlihat seperti hasil generator):**
- Kanvas krem dengan serif dan aksen terakota; atau latar hitam pekat dengan satu aksen hijau neon.
- Deretan kartu identik: radius sama, bayangan abu sama, ikon dalam lingkaran berwarna di tiap kartu.
- Gradien dekoratif, glassmorphism berlebihan, blob warna.
- Label HURUF KAPITAL berjarak di atas setiap judul; string meta bertitik tengah ("A · B · C") di mana-mana; tombol dengan "→" di setiap teks.
- Angka KPI raksasa + gradien sebagai satu-satunya pola hero.
- Animasi masuk "fade-slide-up" di setiap section dan hover-lift di setiap kartu.

## 3. Design tokens

**Warna** (kontras teks ≥ 4.5:1; semantik tidak hanya mengandalkan warna, selalu disertai ikon/teks):

```css
:root {
  --canvas:#EEF2F5; --surface:#FFFFFF; --surface-2:#F7F9FB; --line:#D9E1E7;
  --ink:#13222B;    --ink-2:#4A5B66;
  --primary:#27439B; --primary-soft:#E6EBF8; --on-primary:#FFFFFF;
  --ok:#1F7A4D;   --ok-soft:#E3F4EA;
  --warn:#9A5B00; --warn-soft:#FFF1D6;
  --danger:#B4321E; --danger-soft:#FDE9E5;
  --critical:#8E1138; --critical-soft:#FBE4EC;
  --low:#4A5B66; --low-soft:#E8EDF1;
  --focus:#27439B;
}
:root[data-theme="dark"], @media (prefers-color-scheme:dark){ /* tanpa data-theme="light" */
  --canvas:#0E161B; --surface:#152028; --surface-2:#1B2A34; --line:#263742;
  --ink:#E7EEF2;   --ink-2:#9FB0BB;
  --primary:#8FA6F2; --primary-soft:#1E2A52; --on-primary:#0E161B;
  --ok:#5BD08E; --ok-soft:#14301F; --warn:#F2B45A; --warn-soft:#3A2B10;
  --danger:#FF8A75; --danger-soft:#3D1A14; --critical:#FF7DA0; --critical-soft:#3E1424;
  --low:#9FB0BB; --low-soft:#1F2D37; --focus:#8FA6F2;
}
```
Mode gelap dirancang sendiri (bukan inversi); latar bertingkat lewat `--canvas` → `--surface` → `--surface-2`.
**Warna grafik (aman buta warna):** `#27439B`, `#D9822B`, `#2A9D8F`, `#8E5BB5`, `#6B7C88`; bedakan juga dengan bentuk penanda/pola garis.

**Tipografi:** satu keluarga **Plus Jakarta Sans** (via `next/font`, subset latin) dengan `font-variant-numeric: tabular-nums` untuk semua angka/jam. Monospace (JetBrains Mono) **hanya** untuk hash dan ID file. Skala: 12 / 13 / 14 (dasar tabel) / 16 (dasar isi) / 20 / 24 / 32. Bobot: 400 isi, 600 judul dan label. Panjang baris teks ≤ 75 karakter, tinggi baris 1.5.

**Radius & elevasi (bertingkat sesuai hierarki, bukan satu nilai untuk semua):**
input/tombol 8px · panel 12px · dialog/sheet 16px · badge 999px · baris tabel 0. Panel memakai **border 1px `--line`**, bukan bayangan; bayangan hanya untuk lapisan melayang (popover, dialog, toast).

**Spacing:** skala 4px (4, 8, 12, 16, 24, 32, 48). Padding panel 16 (mobile) / 20–24 (desktop). Kepadatan: toggle **Nyaman / Ringkas** untuk tabel (tinggi baris 48 / 36).

**Ikon:** lucide-react, stroke 1.75, ukuran 16/20. Ikon pelengkap teks, bukan dekorasi.

## 4. Layout & responsivitas (mobile-first)

| Lebar | Navigasi | Konten |
|---|---|---|
| < 640 (mobile) | **Bottom tab bar** (maks 5 item sesuai role) + menu "Lainnya" di sheet | 1 kolom; tabel → daftar kartu baris; filter di *bottom sheet*; grafik disederhanakan |
| 640–1023 (tablet) | Sidebar ringkas (ikon, 72px), label muncul saat hover/fokus | 2 kolom untuk KPI dan panel |
| ≥ 1024 (desktop) | Sidebar penuh 240px, bisa dilipat | 12 kolom, panel maks lebar 1440px, tabel penuh |

Aturan:
- Tidak ada scroll horizontal di `body`. Tabel lebar discroll di wadahnya sendiri dengan kolom pertama (Nama) *sticky*.
- Target sentuh ≥ 44×44px di mobile. Ruang aman: hormati `env(safe-area-inset-*)`.
- Top bar: filter global (periode, departemen), pencarian cepat (`Ctrl/⌘+K`), lonceng notifikasi, menu profil + ganti tema. Di mobile, filter global dipindah ke tombol "Filter" yang membuka bottom sheet.
- Navigasi mengikuti **role**: item yang tidak boleh diakses tidak ditampilkan (otorisasi sebenarnya tetap di server).
- Gunakan container queries untuk komponen yang berpindah antara kolom dan sheet.

## 5. Wireframe acuan

**Dashboard (desktop)**
```
┌ Sidebar ┬──────────────────────────────────────────────────────────────┐
│ Dashboard│ [Periode ▾] [Departemen ▾]  [🔍 Cari ⌘K]        🔔3  Avatar ▾│
│ Unggah   ├──────────────────────────────────────────────────────────────┤
│ Anomali  │ ┌ SEGEL INTEGRITAS ───────────────────────────────────────┐ │
│ Monitoring│ │ 🛡 2 anomali perlu ditinjau   Upload terakhir 8 Okt 09:12│ │
│ Koreksi  │ │ Hash a3f9c21e (salin)                    [Tinjau anomali]│ │
│ Master ▸ │ └─────────────────────────────────────────────────────────┘ │
│ Audit    │  Terlambat 2x   Total telat 03:43   Kurang presensi 37   ...  │
│          │ ┌ Peringkat keterlambatan ────┐ ┌ Tren per minggu ─────────┐ │
│          │ │ ▇▇▇▇▇▇ Billy 2x   03:43     │ │  ╱╲  ╱─╲                  │ │
│          │ └─────────────────────────────┘ └──────────────────────────┘ │
│          │ ┌ Ringkasan per pegawai (tabel, sortir, cari, ekspor) ──────┐ │
│          │ └───────────────────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────────────┘
```

**Dashboard (mobile)**
```
┌──────────────────────┐
│ Absensi Monitor 🔔3 │
│ [Periode ▾] [Filter] │
│ 🛡 2 anomali ditinjau│
│    Upload 8 Okt 09:12│
│ Terlambat   2x       │
│ Total telat 03:43    │
│ ── Peringkat ──      │
│ Billy ▇▇▇▇ 2x        │
│ ── Pegawai ──        │
│ ┌ Andrea R.      OK ┐│
│ │ Hari kerja 21      ││
│ │ Terlambat 0        ││
│ └────────────────────┘│
│ [Home][Unggah][Anomali][Lainnya]│
└──────────────────────┘
```

**Detail anomali "data berubah" (diff)**
```
Anomali kritis · Data absensi berubah antar upload      [Terima versi baru] [Pertahankan versi lama]
Billy · Rabu 7 Okt 2026
┌──────────────┬───────────────┬───────────────┐
│ Kolom        │ Upload 8 Okt  │ Upload 9 Okt  │
│ Jam masuk    │ 09:30         │ 07:58  ◄ ubah │
│ Telat        │ 01:30         │ -      ◄ ubah │
└──────────────┴───────────────┴───────────────┘
Riwayat penanganan · Catatan wajib saat menyelesaikan
```

## 6. Halaman & komponen kunci

**Halaman:** Login · Dashboard (varian per role) · Dashboard pegawai · Unggah laporan · Detail upload · Daftar anomali · Detail anomali · Monitoring upload · Koreksi · Notifikasi · Master data (pegawai, departemen, jadwal) · Pengguna & role · Aturan anomali · Audit log · Profil.

**Home per role:** HR Admin → segel integritas + antrian anomali + status upload. Manager → ringkasan tim + pola terlambat berulang. Pegawai → "Kehadiran saya" (kalender, jumlah terlambat, tombol Ajukan koreksi). Auditor → audit log + verifikasi hash-chain.

**Komponen domain:**
- **IntegritySeal:** status (terverifikasi / perlu ditinjau / kritis), ringkasan, hash singkat + salin.
- **UploadPipeline:** stepper vertikal: *Periksa file → Hitung hash → Baca data → Cek konsistensi → Simpan*. Tiap langkah punya state menunggu/berjalan/selesai/gagal; ini satu-satunya momen animasi yang disengaja. Hasil akhir berupa ringkasan: pegawai, hari baru, tidak berubah, diperbarui, konflik.
- **SeverityBadge:** Rendah / Sedang / Tinggi / Kritis: ikon + teks + warna semantik.
- **AttendanceHeatmap:** satu sel per hari. Status dibedakan ikon/pola, bukan hanya warna: tepat waktu, terlambat, kurang presensi, tanpa keterangan, libur (garis diagonal), anomali (outline tebal).
- **DiffTable:** sebelum/sesudah, sel berubah di-highlight + ikon, bisa dibaca screen reader ("berubah dari 09:30 menjadi 07:58").
- **DataTable responsif:** sortir, cari, filter, pagination, pilih kolom, kepadatan; di mobile menjadi daftar kartu baris dengan 3–4 field utama dan "Lihat detail". Virtualisasi bila > 200 baris.
- **UploadDropzone:** area seret-lepas + tombol "Pilih file"; pilih jenis (Harian/Mingguan/Bulanan); peringatan jika rentang periode di file tidak cocok.
- **NotificationBell + panel:** hitungan belum dibaca, daftar ringkas, tandai dibaca, tautan ke anomali; `aria-live="polite"` untuk notifikasi baru.
- **EmptyState, ErrorState, Skeleton, ConfirmDialog, Toast, FilterSheet.**

## 7. State yang wajib dirancang (setiap daftar/halaman)

Memuat (skeleton sesuai bentuk konten) · Kosong (jelaskan penyebab + aksi) · Error (apa yang terjadi + cara memperbaiki + tombol Coba lagi) · Terbatas izin (jelaskan role yang dibutuhkan) · Offline/jaringan lambat · Hasil filter kosong (tombol Hapus filter) · Sedang menyimpan · Berhasil.

## 8. Microcopy (Bahasa Indonesia)

- Kalimat biasa (sentence case), kata kerja aktif, spesifik. Tombol: "Unggah laporan", "Simpan perubahan", "Terima versi baru", "Tandai selesai". Hindari "Submit", "OK" tanpa konteks.
- **Satu nama untuk satu hal di seluruh alur:** *Unggah*, *Anomali*, *Koreksi*, *Terlambat*, *Kurang presensi*, *Tanpa keterangan*. Tombol "Unggah" menghasilkan toast "Laporan terunggah".
- Pesan kesalahan menjelaskan masalah dan solusi, tanpa meminta maaf berlebihan. Contoh: "File tidak dapat dibaca. Format kolom tidak sesuai laporan Per Atribut. Unduh ulang laporan dari aplikasi absensi, lalu coba lagi."
- Keadaan kosong = ajakan bertindak. Contoh: "Belum ada laporan untuk periode ini. Unggah laporan pertama untuk melihat perhitungan keterlambatan."
- Anomali dijelaskan dengan bahasa awam, bukan kode: "Total terlambat aktual tertulis `-`, tetapi jumlah harian 03:08."
- Format: tanggal `7 Okt 2026`, durasi `HH:mm`, angka `1.234` (pemisah titik).

## 9. Interaksi, gerak, dan aksesibilitas

- **Gerak:** hemat. Gerak hanya untuk menjawab aksi pengguna (buka panel, konfirmasi, progres pipeline). Durasi 150–250ms, easing `ease-out`. Tidak ada animasi masuk otomatis di setiap section. Hormati `prefers-reduced-motion` (ganti dengan perubahan instan).
- **Aksesibilitas (target WCAG 2.2 AA):** fokus terlihat 2px `--focus` + offset; urutan tab logis; semua fungsi bisa dengan keyboard (termasuk tabel, dialog, sheet); label formulir terhubung; tabel semantik (`<th scope>`, `caption`); `aria-live` untuk toast/notifikasi; kontras ≥ 4.5:1; informasi tidak hanya lewat warna; bahasa dokumen `lang="id"`.
- **Aksi berisiko** (hapus, selesaikan anomali kritis, terima versi baru): dialog konfirmasi yang menyebut dampaknya, dan catatan wajib bila diperlukan. Prefer *undo* di toast untuk aksi ringan.
- **Pintasan:** `⌘/Ctrl+K` pencarian cepat, `G` lalu `D/A/U` untuk pindah halaman (opsional, bisa dimatikan).
- **Performa:** target LCP < 2,5 dtk di 4G; skeleton, bukan spinner penuh halaman; grafik dimuat lazy; gambar/ikon seminimal mungkin; jangan memblokir render dengan font (gunakan `display: swap`).

## 10. Visualisasi data

- Peringkat keterlambatan: **bar horizontal** terurut (nama di kiri, nilai di kanan), bukan pie.
- Tren: garis per minggu/bulan, dengan penanda titik dan tooltip yang juga bisa diakses via keyboard; sediakan toggle "Lihat sebagai tabel".
- Kalender kehadiran per pegawai: heatmap bulanan seperti di §6.
- Perbandingan antar periode: bar berdampingan dengan delta (naik/turun) berikon + teks.
- Tooltip menampilkan nilai persis (`HH:mm`). Sumbu dan legenda selalu berlabel; tidak ada grafik 3D.
- Mobile: kurangi seri/label, izinkan geser horizontal pada heatmap, dan sediakan ringkasan teks di atas grafik.

## 11. Daftar tinjau sebelum dianggap selesai

- [ ] Rencana desain (token + wireframe + elemen khas) sudah ditinjau dan disetujui.
- [ ] Tidak memakai pola di daftar "Hindari" (§2) tanpa alasan.
- [ ] Berfungsi di 360, 768, 1024, 1440 px tanpa scroll horizontal pada `body`.
- [ ] Mode terang dan gelap sama-sama lolos kontras AA.
- [ ] Semua state (§7) ada untuk setiap daftar dan formulir.
- [ ] Navigasi keyboard penuh; fokus terlihat; `prefers-reduced-motion` dihormati.
- [ ] Teks UI Bahasa Indonesia, istilah konsisten (§8).
- [ ] Halaman `/dev/design-system` menampilkan seluruh komponen dan variannya.
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95.
