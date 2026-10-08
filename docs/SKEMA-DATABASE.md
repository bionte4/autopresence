# Skema basis data

PostgreSQL lewat Prisma. Perubahan skema hanya lewat migrasi di `prisma/migrations`. Aplikasi memakai user `absensi_app`, yang tidak boleh `UPDATE` atau `DELETE` pada `AuditLog`.

Waktu hadir disimpan sebagai menit sejak tengah malam (`08:00` = `480`). Tanggal kalender bertipe `DATE` (`YYYY-MM-DD`, zona Asia/Jakarta). Durasi juga menit.

## Peta singkat

```text
Customer 1──1 Project 1──1 Department 1──* Employee *──1 WorkSchedule
Department *──* User            (manajer, lewat relasi DeptManagers)
Department 1──* DepartmentReviewer *──1 User
Employee 1──1 User              (akun yang ditautkan, opsional)
Employee 1──* AttendanceRecord *──1 Upload
AttendanceRecord 1──* AttendanceRevision
AttendanceRecord 1──* Correction 1──* ReviewDecision
Employee 1──* AttendanceRequest 1──* ReviewDecision
Upload 1──* Anomaly *──1 Employee
Anomaly 1──* Notification *──1 User
User, Upload, Correction, Request, Employee ── menulis ── AuditLog
Job                          antrian worker
AnomalyRule                  konfigurasi jenis temuan
UploadSchedule               batas waktu laporan masuk
```

## Orang dan organisasi

### User

Akun untuk masuk. `passwordHash` tidak pernah dikirim ke peramban.

| Kolom | Arti |
| --- | --- |
| email | Unik, dipakai untuk masuk |
| role | `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `AUDITOR`, `EMPLOYEE` |
| isActive | Akun bisa masuk |
| failedLogins, lockedUntil | Penguncian setelah gagal masuk |
| employeeId | Paling banyak satu pegawai |
| deletedAt | Akun dinonaktifkan, tidak dihapus fisik |

### Customer, Project, Department

Pelanggan punya banyak proyek. Proyek punya paling banyak satu departemen (`projectId` unik). Nama pelanggan dan nama departemen unik. Hapus aplikasi mengisi `deletedAt`.

`Department.managers` adalah pengguna yang melihat pegawai departemen itu. Ini bukan kursi peninjau.

### DepartmentReviewer

Satu baris per pasangan departemen dan kursi. Kursi: `TEAM_LEADER`, `OPERATION_MANAGER`, `PROJECT_MANAGER`. Menghapus departemen menghapus kursinya. Auditor tidak dipilih dari layar departemen.

### WorkSchedule

`startMin` dan `endMin` adalah jam kerja. `lateToleranceMin` adalah menit yang belum dihitung terlambat. Jadwal boleh dihapus keras jika tidak lagi dipakai pegawai.

### Employee

`pin` unik dan harus sama dengan PIN pada laporan. `scheduleId` wajib. `departmentId` boleh kosong untuk pegawai yang baru terbentuk dari unggah. `deletedAt` menonaktifkan tanpa menghapus absensi lama.

## Kehadiran

### Upload

Satu berkas asli. Isi berkas ada di disk (`storageKey`), bukan di basis data.

| Kolom | Arti |
| --- | --- |
| sha256 | Unik. Berkas yang sama ditolak sebagai duplikat |
| granularity | `DAILY`, `WEEKLY`, `MONTHLY` |
| periodStart, periodEnd | Periode di dalam berkas |
| status | `RECEIVED`, `PARSED`, `PARSED_WITH_ANOMALIES`, `REJECTED` |
| stats | Ringkasan: pegawai, sisipan, tidak berubah, dilengkapi, bentrok, ditahan, jumlah anomali |
| fileMeta | Metadata pembuat berkas, untuk aturan metadata mencurigakan |

Tidak ada kolom ubah isi. Hapus berkas hanya lewat aksi admin, dan ditolak bila sudah ada revisi atau koreksi pada barisnya.

### AttendanceRecord

Satu baris per pegawai per tanggal (`employeeId` + `date` unik).

Kolom menit boleh kosong: `scheduleInMin`, `scheduleOutMin`, `clockInMin`, `clockOutMin`, datang awal, telat, pulang awal, pulang terlambat, telat aktual, menit efektif, dan menit aktual. `note` adalah keterangan hari itu. `sourceUploadId` menunjuk berkas yang terakhir menulis baris ini.

Tidak ada API untuk mengubah atau menghapus baris ini secara langsung. Sumber perubahan: unggah, pelengkapan jam keluar, atau koreksi serta cuti/sakit yang sudah disetujui sampai tahap akhir.

### AttendanceRevision

Salinan sebelum dan sesudah (`before`, `after`) plus alasan. Boleh menunjuk `uploadId` atau `correctionId`. Baris ini tidak punya API ubah atau hapus.

### Correction

Usulan mengubah satu `AttendanceRecord`. `changes` berisi jam atau keterangan yang diminta. `status`: `PENDING`, `APPROVED`, `REJECTED`. `stage` adalah kursi yang sedang giliran. `reviewedById` dan `reviewNote` terisi saat keputusan terakhir.

### AttendanceRequest

Cuti, sakit, atau lembur satu pegawai. `kind`: `LEAVE`, `SICK`, `OVERTIME`. Cuti dan sakit memakai `startDate` sampai `endDate`. Lembur memakai `endMin` dan `overtimeMin`. Status dan tahap sama polanya dengan koreksi.

### ReviewDecision

Satu keputusan per kursi. `outcome`: `APPROVED` atau `REJECTED`. Subjeknya tepat satu: `correctionId` atau `requestId` (cek basis data `ReviewDecision_one_subject_check`). Pasangan koreksi+kursi dan pengajuan+kursi unik. Keputusan ikut terhapus jika induknya terhapus; aplikasi tidak menghapus koreksi atau pengajuan yang sudah tercatat.

## Integritas

### Anomaly

Temuan dari unggah, jadwal yang terlewat, atau bentrok data. `dedupeKey` unik supaya temuan yang sama tidak dibuat dua kali. `status`: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `FALSE_POSITIVE`. `resolvedNote` wajib diisi aplikasi saat menutup. Pegawai dan tanggal boleh kosong bila temuan berlaku untuk seluruh berkas.

Jenis (`type`) dan artinya ada di [jenis anomali](ANOMALI.md).

### AnomalyRule

Satu baris per jenis. Menyimpan apakah aturan aktif, tingkat keparahan, ambang, peran yang diberitahu, apakah manajer departemen diberitahu, dan kanal. Belum ada layar pengelola.

### Notification

Pemberitahuan satu pengguna. Unik per `userId` + `anomalyId` + `channel`, jadi kanal yang sama tidak mengirim dobel untuk temuan yang sama. `readAt` kosong berarti belum dibaca. Kegagalan kirim menaikkan `attempts` dan tidak membatalkan unggah.

### AuditLog

Hanya bertambah. `hash` adalah SHA-256 dari hash sebelumnya ditambah isi kanonis baris ini. `prevHash` mengaitkan ke baris di atasnya. `diff` menyimpan perubahan, bukan isi berkas dan bukan kata sandi. User aplikasi tidak boleh mengubah atau menghapus tabel ini.

### Job

Antrian worker: kirim notifikasi, cek jadwal unggah, ringkasan. `status` dan `attempts` mengatur ulang coba. Tidak ada Redis.

### UploadSchedule

Ekspektasi laporan masuk: jenis periode, jam batas (`cutoffTime`), hari dalam pekan atau tanggal dalam bulan, dan `enabled`. Hapus jadwal bersifat keras.

## Yang tidak dihapus

Lewat aplikasi, baris ini tidak punya hapus:

- `AuditLog`
- `AttendanceRevision`

Absensi harian tidak diedit pengguna. Barisnya hanya ikut terhapus ketika admin menghapus unggahan sumbernya, dan itu pun ditolak jika revisi atau koreksi sudah ada.
