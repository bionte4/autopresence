# Absensi Monitor

Aplikasi internal pemantauan kehadiran dan integritas laporan Excel. Milestone saat ini: **M8 — Koreksi, hardening, dokumentasi**.

## Prasyarat

- Node.js 22+
- pnpm 9
- Docker Desktop

## Setup lokal

```bash
cp .env.example .env
docker compose up -d postgres mailhog
pnpm install
pnpm db:ensure-role
pnpm prisma migrate deploy
pnpm db:seed
pnpm dev
```

Postgres di Docker memakai host port **5436** supaya tidak bentrok dengan Postgres lokal di 5432.

Buka [http://localhost:3000/login](http://localhost:3000/login). Panduan pemakaian ada di [docs](docs/README.md).

Aplikasi memakai user database `absensi_app` (bukan superuser). Migrasi membuat role itu dan mencabut `UPDATE`/`DELETE` pada `AuditLog`. `DIRECT_URL` hanya untuk migrasi.

Akun seed (password dari `SEED_PASSWORD` di `.env`, default `DevPassword123!`):

- `super.admin@local`
- `hr.admin@local`
- `manager@local`
- `auditor@local`
- `employee@local`

Lima kali gagal masuk mengunci akun selama 15 menit. Percobaan gagal juga dibatasi 10 kali per 15 menit per email.

## Docker penuh (app + worker)

```bash
docker compose up --build
```

Mailhog UI: [http://localhost:8025](http://localhost:8025).

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright: masuk → unggah laporan → lihat anomali |
| `pnpm worker` | Cron anomali, jadwal upload, dan ringkasan harian |
| `pnpm audit --audit-level=high` | Dependensi tanpa kerentanan high/critical |

## Cadangan dan pemulihan

Berkas asli upload ada di `STORAGE_DIR` (default `./storage`) dan tidak boleh ditimpa. Basis data menyimpan hash, bukan isi berkas.

Cadangkan keduanya bersamaan:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U absensi -d absensi --format=custom > backups/absensi.dump
tar -czf backups/storage.tgz -C storage .
```

Pulihkan ke basis data kosong, lalu kembalikan berkas:

```bash
docker compose exec -T postgres pg_restore -U absensi -d absensi --clean --if-exists < backups/absensi.dump
rm -rf storage && mkdir storage && tar -xzf backups/storage.tgz -C storage
```

`pg_restore --clean` menghapus objek yang ada. Jalankan hanya pada salinan yang memang akan diganti. Setelah pulih, `pnpm prisma migrate deploy` menyelaraskan skema, dan `pnpm db:ensure-role` mengembalikan user aplikasi plus larangan `UPDATE`/`DELETE` pada `AuditLog`.

## Runbook

- **Masuk gagal berulang.** Lima kegagalan mengunci akun 15 menit. Jangan membuat kata sandi admin di build produksi; seed hanya membaca `SEED_PASSWORD`.
- **Upload ditolak.** Cek ukuran (maks. 10 MB), ekstensi `.xlsx`, dan pesan di halaman upload. Hash yang sama mengembalikan berkas duplikat dan tidak menulis ulang file asli.
- **Lonceng kosong.** Notifikasi untuk koreksi serta pengajuan cuti, sakit, dan lembur, ke pemegang kursi yang sedang giliran. Anomali dan ringkasan harian tidak mengirim notifikasi. Kegagalan SMTP tidak membatalkan keputusan. Surat uji ada di Mailhog, port 8025.
- **Upload harian belum masuk.** Di `/monitoring`, merah berarti periode jatuh tempo belum diterima. Worker membuat `MISSING_UPLOAD` sekali per periode.
- **Koreksi jam.** Pegawai atau manajer mengajukan di `/corrections`. Persetujuan berjenjang: Team Leader, Operation Manager, lalu Project Manager pada departemen pegawai. Tahap terakhir menulis `AttendanceRevision` dan tidak menghapus revisi lama. Kursi kosong menghentikan rantai. Lihat `docs/PANDUAN-PENGGUNA.md`.
- **Header.** Respons menyertakan CSP dan `X-Frame-Options: DENY`. `Strict-Transport-Security` aktif saat `NODE_ENV=production`.

`pnpm audit` masih melaporkan temuan high yang belum punya perbaikan yang cocok dengan stack ini: `xlsx@0.18.5` (tidak ada rilis npm yang ditambal; parser hanya di server dan berkas dibatasi 10 MB), `nodemailer@8.0.11` (perbaikan sisa ada di v9/v10, sementara Auth.js menerima `^7` atau `^8`), `deepmerge-ts` lewat Prisma, dan `braces` lewat ESLint. Tidak ada temuan critical.
