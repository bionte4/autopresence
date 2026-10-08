# Panduan pengguna

Dokumen ini menjelaskan cara memakai Absensi Monitor sehari-hari. Izin lengkap ada di [matriks RBAC](RBAC.md). Pengaturan data master dan unggah berkas ada di [panduan admin](PANDUAN-ADMIN.md).

## Masuk

Buka halaman masuk, isi email dan kata sandi, lalu pilih **Masuk ke aplikasi**.

Lima kali kata sandi salah mengunci akun selama 15 menit. Minta Super Admin jika akun terkunci atau perlu kata sandi baru.

Di pojok atas:

- Lonceng membuka notifikasi Anda sendiri.
- **Nyaman / Ringkas** mengubah kerapatan tampilan.
- Ikon matahari atau bulan mengubah tema terang dan gelap.
- **Keluar** mengakhiri sesi.

Di layar lebar, **Cari halaman** atau pintasan Ctrl+K / Cmd+K mencari menu. Di ponsel, empat menu pertama ada di bawah; sisanya lewat **Lainnya**.

## Siapa melihat apa

| Peran | Yang biasa dipakai |
| --- | --- |
| Pegawai | Dasbor, timesheet, koreksi, pengajuan, dan laporan miliknya |
| Manajer | Data pegawai di departemen yang dikelolanya, plus anomali tingkat rendah dan sedang |
| Peninjau | Pengajuan dan koreksi departemen tempat ia memegang kursi, selain data perannya |
| Auditor | Melihat unggah, anomali, dasbor, dan audit. Tidak mengubah data |
| HR Admin dan Super Admin | Semua data operasional. Akun login hanya Super Admin |

Pegawai yang akunnya belum ditautkan ke data pegawai tidak melihat baris kehadiran. Manajer yang belum ditunjuk pada departemen juga tidak melihat data tim.

## Dasbor

Dasbor merangkum satu periode, biasanya periode unggah terakhir. Ubah tanggal **Dari** dan **Sampai**, lalu **Terapkan**. Rentang paling lama 366 hari.

Angka dihitung ulang dari absensi harian:

- Pegawai yang punya baris pada periode itu
- Kejadian terlambat dan total jam telat
- Kurang presensi
- Hari tanpa keterangan
- Anomali yang masih terbuka

Hari yang keterangannya diawali **cuti** atau **sakit** tidak dihitung sebagai kurang presensi di dasbor.

Pilih departemen atau pegawai untuk mempersempit. Nama pegawai membuka kalender keterlambatannya. **Unduh Excel** pada tabel mengunduh rekap periode yang sedang tampil.

**Lihat di dasbor** dari halaman berkas membuka dasbor dengan tanggal awal dan akhir berkas itu. Angkanya tetap seluruh absensi pada rentang tanggal, termasuk unggahan lain yang tumpang tindih dan koreksi yang sudah selesai.

## Timesheet

Menu **Timesheet** menampilkan jam harian satu pegawai: jadwal, jam masuk, jam keluar, telat, dan keterangan. Pegawai hanya melihat dirinya. Manajer melihat timnya.

## Koreksi jam

Absensi harian tidak bisa diedit langsung. Perubahan jam lewat **Koreksi**.

1. Pilih baris kehadiran.
2. Isi jam masuk baru, jam keluar baru, atau keterangan baru. Kosongkan kolom yang tidak berubah.
3. Tulis alasan. Bukti bersifat opsional.
4. **Ajukan koreksi**.

Satu baris hanya boleh punya satu koreksi yang masih berjalan. Jam baru belum berlaku sampai rantai peninjau selesai.

## Pengajuan cuti, sakit, dan lembur

Di **Pengajuan**:

- **Cuti** dan **Sakit** memakai tanggal mulai dan selesai.
- **Lembur** memakai satu tanggal dan jam selesai.

Alasan wajib diisi. Cuti dan sakit baru tertulis pada absensi setelah tahap terakhir menyetujui. Lembur dicatat pada pengajuan; jam absensi harian tidak diubah oleh lembur.

## Rantai peninjau

Koreksi dan pengajuan melewati tiga kursi departemen pegawai, berurutan:

1. Team Leader
2. Operation Manager
3. Project Manager

Buka detailnya untuk melihat tahap yang sedang berjalan. Hanya pemegang kursi tahap itu yang bisa **Setujui** atau **Tolak**. Catatan wajib diisi.

- Pengaju tidak menyetujui tahapnya sendiri. Tahap itu dilewati.
- Kursi yang belum ditunjuk menghentikan proses. HR Admin mengisi kursi di data departemen.
- Penolakan di tahap mana pun menutup pengajuan. Absensi belum berubah.
- Persetujuan tahap terakhir menerapkan perubahan dan mencatat revisi.

Peran login tidak menentukan giliran. Seorang pegawai bisa meninjau jika ia memegang kursi departemen itu.

## Anomali

Menu **Anomali** hanya untuk manajer, auditor, HR, dan Super Admin. Pegawai tidak melihat daftar ini.

Setiap baris menjelaskan apa yang tidak cocok, pegawai atau seluruh berkas, dan tanggalnya. Arti tiap jenis ada di [jenis anomali](ANOMALI.md).

- **Akui** menandai bahwa temuan sudah dilihat. Catatan opsional.
- **Selesai** atau **Bukan masalah** menutup temuan. Catatan wajib.
- Manajer hanya menutup tingkat rendah dan sedang pada timnya.
- HR Admin dan Super Admin menutup semua tingkat.

Menutup anomali tidak mengubah jam absensi. Jam yang salah diperbaiki lewat koreksi.

## Laporan

Menu **Laporan** mengunduh Excel dari data yang tersimpan.

- **Rekap kehadiran** untuk satu periode, boleh dipersempit per departemen atau pegawai.
- **Timesheet** untuk satu pegawai pada satu periode. Pilih nama pegawai sebelum mengunduh.

Berkas yang diunduh aman dibuka di Excel: sel yang diawali rumus diberi tanda kutip agar tidak jalan sebagai rumus.

## Notifikasi

Lonceng berbunyi untuk koreksi jam serta pengajuan cuti, sakit, dan lembur. Anomali tidak mengirim notifikasi.

Penerimanya mengikuti rantai peninjau. Saat giliran sebuah kursi, pemegang kursi itu yang diberitahu. Setelah tahap terakhir menyetujui atau ada yang menolak, pengaju yang diberitahu. Kursi yang kosong tidak punya penerima sampai diisi.

Membuka daftar menandai yang belum dibaca. Anda tidak bisa membaca notifikasi orang lain.
