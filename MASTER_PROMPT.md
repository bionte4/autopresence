# MASTER PROMPT — Absensi Monitor

> **Cara pakai di Cursor**
> 1. Taruh `.cursorrules` di root repo, `MASTER_PROMPT.md` di root, dan file contoh di `fixtures/Laporan_Per_Atribut.xlsx`.
> 2. Buka Agent/Composer, tempel bagian **"PROMPT PEMBUKA"** di bawah. Biarkan Cursor membuat rencana (Plan), baru setujui.
> 3. Jalankan **satu milestone per sesi** (M0 → M8) dengan perintah: `Kerjakan milestone M{n} sesuai MASTER_PROMPT.md. Buat rencana dulu.`
> 4. Setiap selesai milestone: minta `jalankan typecheck, lint, dan test lalu laporkan hasilnya`, commit, baru lanjut. Mulai chat baru tiap milestone supaya konteks tidak membengkak.

---

## PROMPT PEMBUKA (tempel ini ke Cursor)

```
Kamu adalah senior full-stack engineer. Baca `.cursorrules` dan `MASTER_PROMPT.md` sampai habis.
Tugas: bangun aplikasi "Absensi Monitor" sesuai spesifikasi tersebut.
Jangan menulis kode dulu. Pertama:
1. Ringkas pemahamanmu tentang tujuan aplikasi dalam 5 kalimat.
2. Sebutkan asumsi dan hal yang menurutmu ambigu (maksimal 5 poin).
3. Usulkan struktur folder final dan urutan eksekusi M0–M8.
Tunggu persetujuan saya sebelum mengerjakan M0.
```

---

## 1. Latar belakang & tujuan

Aplikasi absensi yang dipakai saat ini hanya menyediakan **export Excel** (`Laporan Per Atribut`) dan **tidak ada API/akses database**. File ini bisa diedit sehingga user ragu terhadap keabsahannya.

**Tujuan aplikasi:**
1. Menerima upload laporan (harian, mingguan, bulanan), mengurai (parse) isinya, dan menyimpannya ke database terpusat sebagai sumber data resmi.
2. Menampilkan dashboard perhitungan: siapa terlambat, berapa kali, total menit, kurang presensi, tanpa keterangan, tren antar periode.
3. **Mendeteksi indikasi manipulasi/ketidakkonsistenan** pada file dan memberi **alert notifikasi**.
4. Memonitor kepatuhan upload (apakah upload harian/mingguan/bulanan sudah masuk sesuai jadwal).
5. Mengatur akses dengan **RBAC**, dan seluruh perubahan tercatat di **audit log** yang tahan manipulasi.

**Non-goal (v1):** integrasi langsung ke mesin/aplikasi absensi, perhitungan gaji/payroll, aplikasi mobile native.

---

## 2. Tech stack (ikuti `.cursorrules`)

Next.js (App Router) + TypeScript strict · PostgreSQL + Prisma · Auth.js credentials + argon2 · Tailwind + shadcn/ui · Recharts · Zod · SheetJS (server) · worker terpisah (node-cron + tabel `Job`) · Nodemailer (+ opsional Telegram) · Vitest + Playwright · pnpm · Docker Compose (postgres, mailhog, app, worker).
Penyimpanan file asli: folder volume lokal `STORAGE_DIR` (abstraksi `FileStorage` agar bisa diganti S3/MinIO).

---

## 3. Spesifikasi file sumber (WAJIB dipatuhi parser)

File: `Laporan_Per_Atribut.xlsx`. Sheet `Worksheet` berisi data, `Worksheet 1` kosong. Sheet punya merged cells dan header 2 baris. **Semua nilai bertipe teks dengan spasi tak beraturan.**

**Struktur blok per pegawai (berulang, dipisah baris kosong):**
```
Laporan Kehadiran Pegawai
Periode  | : 10 Sep - 9 Okt 2026
Nama     | : ANDREA RAHMADANISYA
Pin      | : 4370
(kosong)
Header baris 1 & 2 (merged)
Baris harian ... (satu baris per tanggal)
Total 21 Hari | ... (baris total)
(baris kosong ×N)
```

**Pemetaan kolom harian (index 0-based):**

| Idx | Kolom di file | Field internal | Tipe |
|---|---|---|---|
| 0 | Tanggal (`Km, 10 Sep 2026 `) | `date` | DATE |
| 1 | Jam Kerja – Masuk | `scheduleIn` | menit |
| 2 | Jam Kerja – Pulang | `scheduleOut` | menit |
| 3 | Jam Masuk | `clockIn` | menit / null |
| 4 | Jam Keluar | `clockOut` | menit / null |
| 5 | Jam Datang – Cepat | `earlyArrivalMin` | menit |
| 6 | Jam Datang – Telat | `lateMin` | menit |
| 7 | Jumlah Jam Pulang – Cepat | `earlyLeaveMin` | menit |
| 8 | Jumlah Jam Pulang – Telat | `lateLeaveMin` | menit |
| 9 | Terlambat Aktual | `actualLateMin` | menit |
| 10 | Jumlah Jam Efektif | `effectiveMin` | menit |
| 11 | Jumlah Jam Aktual | `actualMin` | menit |
| 12 | Lokasi Masuk | `locIn` | teks / null |
| 13 | Lokasi Keluar | `locOut` | teks / null |
| 14 | Keterangan | `note` | teks / null |

**Aturan parsing:**
- `'-'`, `''`, `null` = tidak ada nilai. Hari libur: jam kerja `'-'` dan `Keterangan = 'Libur'` → `isWorkday=false`.
- Singkatan hari: `Sn Sl Rb Km Jm Sb Mg`. Singkatan bulan: `Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des`. Parse tanggal manual, jangan `new Date(string)`.
- Nilai `Keterangan` yang dikenal: `Libur`, `Terlambat`, `Kurang Presensi Masuk` (perhatikan variasi huruf besar/kecil: `Kurang presensi Masuk`), `Kurang Presensi Keluar`, `Tanpa Keterangan`. Nilai tak dikenal disimpan apa adanya + anomali LOW.
- Baris `Total N Hari` memuat total per kolom (5–11). Simpan sebagai `reportedTotals` untuk validasi, **bukan** sebagai sumber perhitungan.
- Periode (`: 10 Sep - 9 Okt 2026`) bisa melintasi bulan/tahun; tentukan tahun dengan benar.

**Fakta dari contoh (jadikan test golden):**
- 13 pegawai, periode 10 Sep – 9 Okt 2026, semua jadwal 08:00–17:05 (efektif 09:05).
- Hanya **BILLY TIGO RAMADHAN** yang terlambat: **2 kali** (Jum 2 Okt telat 02:13 / aktual 01:43; Rab 7 Okt telat 01:30 / aktual 01:25).
- Baris Total Billy: Telat = 03:43 (benar), tetapi Terlambat Aktual = `-` padahal jumlah harian = 03:08 → harus muncul **TOTAL_MISMATCH**.
- Distribusi keterangan seluruh file: Libur 104, Kurang Presensi Keluar 32, Tanpa Keterangan 8, Kurang Presensi Masuk 5, Terlambat 2.
- Laporan membuang detik: selisih ≤ 1 menit antara hitung ulang vs nilai file **bukan** anomali.

---

## 4. Domain & aturan bisnis

**Definisi terlambat (konfigurable per `WorkSchedule`):** default = `lateMin > 0` pada kolom *Jam Datang – Telat* setelah toleransi `lateToleranceMin` (default 0). Dashboard juga menampilkan `actualLateMin`. Aturan ini harus berada di satu fungsi `isLate(record, schedule)` agar mudah diubah.

**Jenis upload (`granularity`)**:
- `DAILY`: periode 1 hari. `WEEKLY`: ≤ 7 hari. `MONTHLY`: ≤ 35 hari (siklus cut-off seperti 10 Sep–9 Okt tetap valid).
- Uploader memilih granularity; sistem membandingkannya dengan periode di file. Tidak cocok → peringatan + konfirmasi uploader (bukan reject), dan dicatat anomali LOW `GRANULARITY_MISMATCH`.
- Upload yang periodenya **tumpang-tindih** dengan upload lama diperbolehkan (misal harian lalu bulanan), tetapi mengikuti kebijakan konflik di bawah.

**Kebijakan konflik data (inti anti-manipulasi)** untuk kunci unik `(employeeId, date)`:
1. Belum ada → insert.
2. Ada dan identik → skip (catat `unchanged`).
3. Ada tetapi **belum lengkap** (clockOut kosong) dan yang baru melengkapi → update + simpan `AttendanceRevision` (bukan anomali).
4. Ada, lengkap, dan **berbeda** → **jangan timpa**. Buat `Anomaly(DATA_CHANGED, HIGH)` berisi before/after, status `OPEN`. HR_ADMIN memilih: *Terima versi baru* (membuat revision) atau *Pertahankan versi lama* (false positive/tolak).

**Koreksi resmi (pengganti edit manual):** pegawai/manager mengajukan `Correction` (field, nilai baru, alasan, bukti opsional) → HR_ADMIN approve/reject → jika approve, sistem membuat `AttendanceRevision` dan memperbarui record. Semua langkah masuk audit log.

---

## 5. RBAC

| Fitur / Aksi | SUPER_ADMIN | HR_ADMIN | MANAGER | AUDITOR | EMPLOYEE |
|---|:-:|:-:|:-:|:-:|:-:|
| Kelola User & Role (CRUD) | ✔ | ✖ | ✖ | ✖ | ✖ |
| Kelola Departemen (CRUD) | ✔ | ✔ | ✖ | ✖ | ✖ |
| Kelola Pegawai (CRUD) | ✔ | ✔ | ✖ | ✖ | ✖ |
| Kelola Jadwal Kerja/Toleransi (CRUD) | ✔ | ✔ | ✖ | ✖ | ✖ |
| Upload laporan | ✔ | ✔ | ✖ | ✖ | ✖ |
| Lihat daftar & detail upload | ✔ | ✔ | ✖ | ✔ | ✖ |
| Unduh file asli upload | ✔ | ✔ | ✖ | ✔ | ✖ |
| Dashboard & data absensi | semua | semua | tim sendiri | semua (read-only) | diri sendiri |
| Ajukan Koreksi | ✔ | ✔ | ✔ (anggota tim) | ✖ | ✔ (diri sendiri) |
| Approve/Reject Koreksi | ✔ | ✔ | ✖ | ✖ | ✖ |
| Lihat Anomali | semua | semua | tim sendiri | semua | ✖ |
| Acknowledge/Resolve Anomali | ✔ | ✔ | ✔ (tim, hanya severity ≤ MEDIUM) | ✖ | ✖ |
| Konfigurasi Aturan Anomali & Notifikasi (CRUD) | ✔ | ✔ | ✖ | ✖ | ✖ |
| Jadwal Upload (monitoring kepatuhan) (CRUD) | ✔ | ✔ | ✖ | ✖ | ✖ |
| Lihat Audit Log | ✔ | ✖ | ✖ | ✔ | ✖ |
| Verifikasi hash-chain Audit Log | ✔ | ✖ | ✖ | ✔ | ✖ |
| Notifikasi in-app milik sendiri | ✔ | ✔ | ✔ | ✔ | ✔ |

Implementasi: `can(user, action, resource?)` + `scopeFor(user)` (lihat `.cursorrules` §3). Matriks di atas wajib menjadi **test table-driven** (setiap sel = satu test allow/deny). Satu `User` dapat ditautkan ke satu `Employee` (via PIN) agar EMPLOYEE melihat datanya sendiri. MANAGER ditautkan ke satu/lebih `Department`.

---

## 6. Data model (Prisma — titik awal, boleh disempurnakan dengan alasan)

```prisma
enum Role { SUPER_ADMIN HR_ADMIN MANAGER AUDITOR EMPLOYEE }
enum Granularity { DAILY WEEKLY MONTHLY }
enum UploadStatus { RECEIVED PARSED PARSED_WITH_ANOMALIES REJECTED }
enum Severity { LOW MEDIUM HIGH CRITICAL }
enum AnomalyStatus { OPEN ACKNOWLEDGED RESOLVED FALSE_POSITIVE }
enum CorrectionStatus { PENDING APPROVED REJECTED }
enum AnomalyType {
  ROW_MISMATCH TOTAL_MISMATCH DAYS_MISMATCH DATA_CHANGED DUPLICATE_FILE
  MISSING_UPLOAD MISSING_PUNCH REPEATED_LATE NO_REASON FORMAT_UNKNOWN
  GRANULARITY_MISMATCH FILE_METADATA_SUSPICIOUS UNKNOWN_EMPLOYEE
}

model User {
  id String @id @default(cuid())
  email String @unique
  name String
  passwordHash String
  role Role
  isActive Boolean @default(true)
  failedLogins Int @default(0)
  lockedUntil DateTime?
  employeeId String? @unique
  employee Employee? @relation(fields: [employeeId], references: [id])
  managedDepartments Department[] @relation("DeptManagers")
  deletedAt DateTime?
  createdAt DateTime @default(now())
}

model Department {
  id String @id @default(cuid())
  name String @unique
  managers User[] @relation("DeptManagers")
  employees Employee[]
  deletedAt DateTime?
}

model WorkSchedule {
  id String @id @default(cuid())
  name String
  startMin Int        // menit sejak 00:00
  endMin Int
  lateToleranceMin Int @default(0)
  employees Employee[]
}

model Employee {
  id String @id @default(cuid())
  pin String @unique
  name String
  departmentId String?
  department Department? @relation(fields: [departmentId], references: [id])
  scheduleId String
  schedule WorkSchedule @relation(fields: [scheduleId], references: [id])
  isActive Boolean @default(true)
  deletedAt DateTime?
  user User?
  records AttendanceRecord[]
}

model Upload {
  id String @id @default(cuid())
  originalName String
  storageKey String @unique
  sha256 String @unique
  sizeBytes Int
  granularity Granularity
  periodStart DateTime @db.Date
  periodEnd DateTime @db.Date
  status UploadStatus
  fileMeta Json            // creator, lastModifiedBy, created, modified dari docProps
  stats Json?              // inserted/unchanged/updated/conflicts/employees
  uploadedById String
  createdAt DateTime @default(now())
  anomalies Anomaly[]
}

model AttendanceRecord {
  id String @id @default(cuid())
  employeeId String
  employee Employee @relation(fields: [employeeId], references: [id])
  date DateTime @db.Date
  isWorkday Boolean
  scheduleInMin Int?  scheduleOutMin Int?
  clockInMin Int?     clockOutMin Int?
  earlyArrivalMin Int? lateMin Int? earlyLeaveMin Int? lateLeaveMin Int?
  actualLateMin Int?  effectiveMin Int? actualMin Int?
  locIn String? locOut String?
  note String?
  sourceUploadId String
  revisions AttendanceRevision[]
  @@unique([employeeId, date])
  @@index([date])
}

model AttendanceRevision {
  id String @id @default(cuid())
  recordId String
  record AttendanceRecord @relation(fields: [recordId], references: [id])
  before Json
  after Json
  reason String      // INGEST_COMPLETION | CONFLICT_ACCEPTED | CORRECTION
  uploadId String?
  correctionId String?
  createdAt DateTime @default(now())
}

model Anomaly {
  id String @id @default(cuid())
  type AnomalyType
  severity Severity
  status AnomalyStatus @default(OPEN)
  uploadId String?
  upload Upload? @relation(fields: [uploadId], references: [id])
  employeeId String?
  date DateTime? @db.Date
  message String          // penjelasan Bahasa Indonesia
  details Json            // expected/actual/before/after
  dedupeKey String @unique
  resolvedById String?
  resolvedNote String?
  createdAt DateTime @default(now())
  resolvedAt DateTime?
}

model AnomalyRule {
  type AnomalyType @id
  enabled Boolean @default(true)
  severity Severity
  threshold Int?               // mis. REPEATED_LATE: >= N kali per periode
  notifyRoles Role[]
  notifyManager Boolean @default(true)
  channels String[]            // IN_APP, EMAIL, TELEGRAM
}

model UploadSchedule {
  id String @id @default(cuid())
  granularity Granularity
  cutoffTime String            // "10:00" Asia/Jakarta
  dayOfWeek Int?               // WEEKLY: 1-7
  dayOfMonth Int?              // MONTHLY: 1-31
  enabled Boolean @default(true)
}

model Notification {
  id String @id @default(cuid())
  userId String
  anomalyId String?
  title String
  body String
  channel String
  status String @default("PENDING")   // PENDING|SENT|FAILED
  attempts Int @default(0)
  readAt DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt])
}

model Correction {
  id String @id @default(cuid())
  recordId String
  requestedById String
  changes Json
  reason String
  status CorrectionStatus @default(PENDING)
  reviewedById String?
  reviewNote String?
  createdAt DateTime @default(now())
  reviewedAt DateTime?
}

model AuditLog {
  id BigInt @id @default(autoincrement())
  actorId String?
  action String
  entity String
  entityId String?
  diff Json?
  ip String?
  createdAt DateTime @default(now())
  prevHash String
  hash String                  // sha256(prevHash + canonicalJson(entry))
}

model Job {
  id String @id @default(cuid())
  type String
  payload Json
  runAt DateTime @default(now())
  attempts Int @default(0)
  status String @default("PENDING")
  lastError String?
}
```

---

## 7. Aturan deteksi anomali

Setiap aturan = fungsi murni + dokumentasi + konfigurasi di `AnomalyRule`.

| Tipe | Pemicu | Severity default |
|---|---|---|
| `ROW_MISMATCH` | Nilai turunan baris harian tidak cocok dengan hitung ulang (datang cepat/telat vs jam masuk, pulang cepat/telat vs jam keluar) selisih > 1 menit | HIGH |
| `TOTAL_MISMATCH` | Baris `Total` ≠ jumlah baris harian (kolom cepat, telat, pulang cepat/telat, terlambat aktual, efektif, aktual; toleransi = jumlah baris berisi nilai + 1 untuk kolom hasil pembulatan, 1 menit untuk efektif/aktual) | HIGH |
| `DAYS_MISMATCH` | `Total N Hari` ≠ jumlah hari kerja | MEDIUM |
| `DATA_CHANGED` | Record lengkap berubah antar upload (lihat kebijakan konflik) | CRITICAL |
| `DUPLICATE_FILE` | Hash file sudah pernah diupload | LOW |
| `FILE_METADATA_SUSPICIOUS` | `lastModifiedBy` ≠ `creator`, atau waktu modified jauh setelah created, atau software pembuat bukan pola export asli | MEDIUM |
| `MISSING_UPLOAD` | Tidak ada upload sesuai `UploadSchedule` setelah `cutoffTime` | HIGH |
| `MISSING_PUNCH` | `Kurang Presensi Masuk/Keluar` | LOW |
| `NO_REASON` | `Tanpa Keterangan` pada hari kerja | MEDIUM |
| `REPEATED_LATE` | Terlambat ≥ N kali dalam satu periode (threshold default 3) | MEDIUM |
| `UNKNOWN_EMPLOYEE` | PIN di file belum terdaftar di master Pegawai | MEDIUM |
| `FORMAT_UNKNOWN` | Struktur file tidak dikenali → upload `REJECTED` | HIGH |
| `GRANULARITY_MISMATCH` | Granularity pilihan ≠ rentang periode di file | LOW |

`dedupeKey` = `type|uploadId|employeeId|date|detailHash` agar tidak ada notifikasi ganda saat upload ulang.

---

## 8. Alur upload (ingest pipeline)

1. `POST /api/uploads` (multipart): cek RBAC → validasi file (ukuran, ekstensi, magic bytes, tolak makro, batas ukuran terdekompresi).
2. Hitung SHA-256 → jika sudah ada: `DUPLICATE_FILE`, tampilkan upload sebelumnya, stop.
3. Simpan file asli ke `FileStorage` (read-only), ekstrak metadata `docProps` (creator, lastModifiedBy, created, modified).
4. Parse (fungsi murni) → `{periode, employees[{pin,nama,days[],reportedTotals}]}`; format tak dikenal → `REJECTED` + anomali.
5. Validasi (fungsi murni) → daftar `issues`.
6. Terapkan kebijakan konflik per `(employee,date)` dalam **satu transaksi DB**; hitung `stats`.
7. Buat `Anomaly` (dedupe) → emit event → dispatcher notifikasi (job async).
8. Tulis `AuditLog`. Kembalikan ringkasan: jumlah pegawai, hari baru/tidak berubah/diperbarui/konflik, daftar anomali.
Seluruh langkah 6–8 atomik; gagal di tengah = rollback dan upload ditandai `REJECTED` dengan alasan.

---

## 9. Monitoring kepatuhan upload & notifikasi

- **Worker** menjalankan cron tiap 5 menit: cek `UploadSchedule` yang jatuh tempo; jika belum ada upload dengan granularity & periode yang diharapkan → buat `MISSING_UPLOAD` (sekali per periode yang diharapkan).
- Cron harian (07:00 Asia/Jakarta): kirim **digest** ke HR_ADMIN: anomali OPEN, upload yang terlambat, pegawai dengan terlambat berulang.
- **Dispatcher:** tentukan penerima dari `AnomalyRule.notifyRoles` (+ MANAGER departemen terkait bila `notifyManager`); kanal IN_APP (wajib), EMAIL, TELEGRAM (opsional). Retry maksimal 5 kali dengan exponential backoff. Kegagalan kanal tidak boleh menggagalkan ingest.
- **UI:** ikon lonceng dengan jumlah belum dibaca (polling 30 detik), halaman Notifikasi, tandai dibaca, tautan langsung ke anomali. Halaman **Monitoring Upload**: kalender/tabel *diharapkan vs diterima* (hijau/kuning/merah) per granularity.
- Alur anomali: `OPEN → ACKNOWLEDGED → RESOLVED | FALSE_POSITIVE`. Resolve wajib catatan. Anomali `CRITICAL` hanya bisa di-resolve oleh HR_ADMIN/SUPER_ADMIN.

---

## 10. Halaman & endpoint

**Halaman (UI Bahasa Indonesia):**
`/login` · `/dashboard` · `/dashboard/pegawai/[id]` · `/uploads` (daftar + form upload + detail dengan hasil validasi & diff) · `/monitoring` (kepatuhan upload) · `/anomalies` (filter severity/status/tipe/pegawai/periode) · `/corrections` · `/notifications` · `/master/employees` · `/master/departments` · `/master/schedules` · `/admin/users` · `/admin/rules` (aturan anomali + notifikasi + jadwal upload) · `/audit` (+ tombol "Verifikasi hash-chain") · `/profile`.

**Dashboard:** filter periode, departemen, pegawai. KPI: pegawai, kejadian terlambat, total jam telat, kurang presensi, tanpa keterangan, anomali terbuka. Tabel ringkasan per pegawai (sort, search, export CSV aman dari CSV-injection), grafik tren terlambat per minggu/bulan, heatmap kalender per pegawai, perbandingan antar periode, panel integritas data (status validasi upload terakhir).

**API (semua lewat wrapper `withAuth({action})` + Zod):**
`/api/uploads` (POST, GET) · `/api/uploads/[id]` (GET) · `/api/uploads/[id]/file` (GET unduh asli) · `/api/attendance` (GET, ter-scope) · `/api/employees` · `/api/departments` · `/api/schedules` · `/api/users` · `/api/anomalies` (+ `/[id]/ack`, `/[id]/resolve`) · `/api/corrections` (+ `/[id]/approve|reject`) · `/api/rules` · `/api/upload-schedules` · `/api/notifications` (+ `/read`) · `/api/audit` (+ `/verify`).
Tidak ada endpoint untuk mengubah/menghapus `AttendanceRecord`, `AuditLog`, atau file upload asli.

**CRUD:** Users, Departments, Employees, WorkSchedules, AnomalyRules, UploadSchedules = CRUD penuh (soft-delete untuk User/Employee/Department, validasi Zod, audit log di tiap perubahan, pagination + search). Correction = create/read/approve/reject. Upload & Anomaly = create/read + transisi status (tanpa delete).

---

## 11. Milestone & acceptance criteria

**M0 — Fondasi.** Repo, pnpm, Next.js, Prisma, docker-compose, env Zod, ESLint/Prettier, CI (typecheck+lint+test), seed (1 user per role, 2 departemen, 1 jadwal 08:00–17:05).
*Selesai jika:* `docker compose up` + `pnpm dev` jalan; seed sukses; CI hijau.

**M1 — Auth + RBAC + Audit log.** Login/logout, lockout, `withAuth`, `can`, `scopeFor`, AuditLog hash-chain + migration revoke UPDATE/DELETE + endpoint verify.
*Selesai jika:* matriks RBAC lolos sebagai test table-driven; mengubah satu baris audit di DB membuat verify gagal.

**M2 — Master data CRUD.** Users, Departments, Employees, WorkSchedules (UI + API + validasi + soft-delete + audit).
*Selesai jika:* tiap role hanya melihat/mengubah yang diizinkan; test allow/deny lulus.

**M3 — Parser & validator (pure).** Implementasi §3 & §7 beserta test dengan `fixtures/Laporan_Per_Atribut.xlsx`.
*Selesai jika:* test golden: 13 pegawai; Billy 2 terlambat; `TOTAL_MISMATCH` pada Terlambat Aktual Billy; file yang sengaja diedit (buat fixture termanipulasi) terdeteksi `ROW_MISMATCH`; coverage `ingest/` ≥ 90%.

**M4 — Upload pipeline.** §8 lengkap, penyimpanan file, hash, metadata, kebijakan konflik, granularity DAILY/WEEKLY/MONTHLY, halaman Uploads + detail hasil.
*Selesai jika:* upload ulang file sama → `DUPLICATE_FILE`; upload file yang record-nya diubah → `DATA_CHANGED` tanpa menimpa; upload harian lalu bulanan yang tumpang-tindih benar; transaksi rollback saat gagal.

**M5 — Dashboard.** Query ter-scope per role, KPI, tabel, grafik tren, heatmap, drill-down, export CSV aman.
*Selesai jika:* angka terlambat Billy = 2 dan total 03:43; EMPLOYEE hanya melihat dirinya; MANAGER hanya timnya.

**M6 — Anomali & alert.** Daftar anomali, alur ack/resolve, dispatcher, notifikasi in-app + email (Mailhog), dedupe, lonceng.
*Selesai jika:* upload fixture memunculkan notifikasi ke HR_ADMIN sesuai `AnomalyRule`; upload ulang tidak menggandakan notifikasi; kegagalan SMTP tidak menggagalkan ingest.

**M7 — Monitoring upload & worker.** `UploadSchedule` CRUD, cron `MISSING_UPLOAD`, digest harian, halaman Monitoring.
*Selesai jika:* jadwal harian tanpa upload setelah cutoff memicu `MISSING_UPLOAD` tepat sekali dan notifikasi terkirim.

**M8 — Koreksi, hardening, dokumentasi.** Alur Correction, rate limit, security headers, e2e smoke (login → upload → lihat anomali), README (setup, env, backup/restore DB & storage, runbook), pen-check sederhana terhadap daftar `.cursorrules` §6 & §11.
*Selesai jika:* semua test hijau, `pnpm audit` tanpa high/critical, dokumen deployment tersedia.

---

## 12. Definition of Done (berlaku di setiap milestone)

- Typecheck, lint, dan semua test hijau; hasilnya dilaporkan apa adanya.
- Setiap endpoint punya `withAuth`, validasi Zod, dan test allow/deny per role.
- Setiap mutasi menulis audit log.
- Tidak ada `any`, TODO tanpa isu, kode mati, atau secret di repo.
- Migration bersih di DB kosong dan di DB seed.
- Ringkasan perubahan + asumsi + hal yang belum dikerjakan ditulis di akhir sesi.

---

## 13. Hal yang perlu dikonfirmasi pemilik produk (default tertera, tanyakan jika tidak cocok)

1. Definisi terlambat resmi: kolom *Telat* (default) atau *Terlambat Aktual*; toleransi menit?
2. Apakah *Kurang Presensi Keluar* dianggap pelanggaran atau hanya informasi?
3. Jadwal upload yang diharapkan (jam cutoff harian, hari mingguan, tanggal bulanan).
4. Kanal notifikasi selain email (Telegram/WhatsApp) dan siapa penerimanya.
5. Retensi data & file asli (default: seumur hidup; sesuaikan kebijakan perusahaan dan UU PDP).
6. Apakah satu pegawai bisa punya lebih dari satu jadwal kerja (shift)?
