# Matriks RBAC dan CRUD

Sumbernya `src/modules/rbac/policy.ts`. Setiap endpoint memeriksa `can(user, action, resource)` di server. Menyembunyikan menu bukan otorisasi.

Peran: **Super Admin**, **HR Admin**, **Manajer**, **Auditor**, **Pegawai**, **Pelanggan**.

Lingkup baris:

| Peran | Data yang terlihat |
| --- | --- |
| Super Admin, HR Admin, Auditor | Semua |
| Manajer | Pegawai di departemen yang dikelola. Tanpa departemen, tidak melihat apa pun. |
| Pegawai | Baris dirinya sendiri. Tanpa tautan pegawai, tidak melihat apa pun. |
| Pelanggan | Pegawai di departemen proyek pelanggannya. Tanpa proyek, tidak melihat apa pun. Hanya dasbor. |

Pemegang kursi peninjau juga melihat pengajuan dan koreksi departemen kursinya, selain lingkup perannya.

## Izin

`✔` boleh. `—` tidak. Catatan di kolom terakhir mempersempit `✔`.

| Aksi | Super Admin | HR Admin | Manajer | Auditor | Pegawai | Pelanggan | Batasan |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| Kelola akun login | ✔ | — | — | — | — | — | |
| Kelola pelanggan, proyek, departemen | ✔ | ✔ | — | — | — | — | Termasuk menunjuk kursi peninjau |
| Kelola pegawai | ✔ | ✔ | — | — | — | — | |
| Kelola jadwal kerja | ✔ | ✔ | — | — | — | — | |
| Unggah laporan | ✔ | ✔ | — | — | — | — | |
| Lihat daftar unggah | ✔ | ✔ | — | ✔ | — | — | |
| Unduh berkas asli | ✔ | ✔ | — | ✔ | — | — | |
| Hapus unggah | ✔ | ✔ | — | — | — | — | Ditolak jika sudah ada revisi atau koreksi |
| Lihat absensi, dasbor, laporan | ✔ | ✔ | ✔ | ✔ | ✔ | dasbor | Pelanggan: grafik dasbor dan kalender pegawai, plus unduh Excel. Tanpa tabel ringkasan, tanpa PIN, dan tanpa anomali |
| Ajukan koreksi | ✔ | ✔ | ✔ | — | ✔ | — | Manajer: timnya. Pegawai: dirinya |
| Setujui atau tolak koreksi | kursi | kursi | kursi | — | kursi | — | Lihat rantai peninjau |
| Ajukan cuti, sakit, lembur | ✔ | ✔ | ✔ | — | ✔ | — | Manajer: timnya. Pegawai: dirinya |
| Setujui atau tolak pengajuan | kursi | kursi | kursi | — | kursi | — | Lihat rantai peninjau |
| Lihat anomali | ✔ | ✔ | ✔ | ✔ | — | — | Manajer: timnya |
| Akui atau tutup anomali | ✔ | ✔ | ✔ | — | — | — | Manajer: timnya, hanya LOW dan MEDIUM |
| Kelola aturan anomali | ✔ | ✔ | — | — | — | — | Izin ada; layar belum dibuat |
| Kelola jadwal unggah | ✔ | ✔ | — | — | — | — | Auditor boleh membaca lewat daftar unggah |
| Lihat audit | ✔ | — | — | ✔ | — | — | |
| Verifikasi hash-chain | ✔ | — | — | ✔ | — | — | |
| Notifikasi sendiri | ✔ | ✔ | ✔ | ✔ | ✔ | — | Giliran koreksi, cuti, sakit, dan lembur. Tidak bisa membaca milik orang lain |

## Rantai peninjau

Koreksi dan pengajuan tidak selesai oleh satu peran. Urutannya:

1. Team Leader
2. Operation Manager
3. Project Manager

Kursi ditunjuk per departemen oleh Super Admin atau HR Admin. Peran login tidak menentukan giliran; yang menentukan adalah pemegang kursi tahap itu.

- Pengaju tidak dapat menyetujui tahapnya sendiri. Tahap itu dilewati.
- Kursi kosong menghentikan rantai sampai diisi.
- Penolakan di tahap mana pun menutup pengajuan. Absensi belum berubah.
- Cuti, sakit, lembur, dan koreksi baru diterapkan setelah Project Manager menyetujui.
- Auditor dan Pelanggan tidak pernah menyetujui, walaupun namanya dipasang pada kursi. Pelanggan juga tidak muncul di pilihan kursi.

## CRUD

`C` buat, `R` baca, `U` ubah, `D` hapus. `—` tidak ada endpoint.

| Data | C | R | U | D | Siapa | Catatan |
| --- | :-: | :-: | :-: | :-: | --- | --- |
| Akun login | ✔ | ✔ | ✔ | lunak | Super Admin | Hapus menonaktifkan akun dan melepas tautan pegawai |
| Pelanggan | ✔ | ✔ | ✔ | lunak | Super Admin, HR Admin | |
| Proyek | ✔ | ✔ | ✔ | lunak | Super Admin, HR Admin | Satu proyek untuk satu departemen |
| Departemen | ✔ | ✔ | ✔ | lunak | Super Admin, HR Admin | Ubah juga menyimpan tiga kursi peninjau |
| Pegawai | ✔ | ✔ | ✔ | lunak | Super Admin, HR Admin | PIN dari unggahan bisa membuat pegawai baru |
| Jadwal kerja | ✔ | ✔ | ✔ | keras | Super Admin, HR Admin | |
| Jadwal unggah | ✔ | ✔ | ✔ | keras | Super Admin, HR Admin | Baca juga untuk Auditor |
| Unggah | ✔ | ✔ | — | ✔ | Super Admin, HR Admin membuat dan menghapus | Auditor hanya baca dan unduh |
| Absensi harian | — | ✔ | — | — | Semua peran, sesuai lingkup | Tidak ada endpoint ubah langsung |
| Koreksi | ✔ | ✔ | putuskan | — | Buat: sesuai tabel izin. Putuskan: rantai peninjau | Satu koreksi terbuka per baris |
| Pengajuan | ✔ | ✔ | putuskan | — | Buat: sesuai tabel izin. Putuskan: rantai peninjau | Cuti, sakit, atau lembur |
| Anomali | sistem | ✔ | akui/tutup | — | Baca dan tutup sesuai tabel izin | Dibuat oleh unggah, bukan pengguna |
| Notifikasi | sistem | ✔ | dibaca | — | Pemilik notifikasi | Dibuat saat koreksi, cuti, sakit, atau lembur berganti giliran |
| Audit log | sistem | ✔ | — | — | Super Admin, Auditor | Tambah saja; tidak bisa diubah atau dihapus |
| Revisi absensi | sistem | — | — | — | Tidak ada API | Terbentuk dari unggah, koreksi, atau cuti/sakit |
| Laporan Excel | — | ✔ | — | — | Semua peran, sesuai lingkup | Rekap kehadiran dan timesheet |

Yang tidak pernah dihapus lewat aplikasi: audit log dan revisi absensi.
