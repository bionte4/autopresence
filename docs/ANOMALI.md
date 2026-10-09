# Jenis anomali

Temuan dibuat oleh sistem saat berkas diperiksa atau saat jadwal unggah terlewat. Pengguna tidak membuat anomali dari formulir. Menutup temuan tidak mengubah jam. Perbaikan jam lewat koreksi yang selesai ditinjau.

Tingkat: **Rendah**, **Sedang**, **Tinggi**, **Kritis**. Manajer departemen menutup tingkat rendah dan sedang pada timnya. HR Admin dan Super Admin menutup semuanya. Auditor hanya melihat.

## Pada berkas atau baris harian

| Tampil di aplikasi | Tingkat bawaan | Artinya |
| --- | --- | --- |
| Baris tidak cocok | Tinggi | Jam turunan (telat, pulang awal, dan sejenisnya) tidak cocok dengan hitung ulang dari jam masuk dan keluar. Selisih satu menit masih diterima karena laporan memotong detik |
| Total tidak cocok | Tinggi | Baris Total pada laporan tidak sama dengan jumlah baris harian. Angka resmi adalah jumlah harian |
| Jumlah hari tidak cocok | Sedang | Angka hari pada baris Total tidak sama dengan jumlah hari kerja |
| Data berubah | Kritis | Hari yang sudah lengkap berbeda dari unggahan baru. Data lama tidak ditimpa. HR menyelesaikan bentrok ini |
| Berkas duplikat | Rendah | Byte berkas yang sama sudah pernah diunggah. Unggahan kedua ditolak |
| Kurang presensi | Rendah | Keterangan hari itu persis **kurang presensi masuk** (jam masuk kosong) atau **kurang presensi keluar** (jam pulang kosong). Lihat bagian di bawah |
| Terlambat berulang | Sedang | Telat tercatat beberapa kali dalam satu periode. Ambang bawaan tiga kali, dihitung dari kolom telat |
| Tanpa keterangan | Sedang | Hari kerja yang keterangannya persis **tanpa keterangan** |
| Format tidak dikenal | Tinggi | Tata letak bukan Laporan Per Atribut, atau periode bukan rentang `7 Okt - 7 Okt 2026`. Satu tanggal seperti `7 Okt 2026` menolak seluruh berkas. Nama dan PIN yang sudah terisi tidak menyelamatkan unggahan |
| Jenis periode tidak sesuai | Rendah | Panjang periode berkas tidak muat pada jenis yang dipilih saat unggah |
| Metadata mencurigakan | Sedang | Pembuat dan pengubah berbeda, aplikasi bukan sumber asli, atau berkas diubah lebih dari sehari setelah dibuat |
| PIN tidak terdaftar | Sedang | PIN belum ada di data pegawai dan tidak bisa dibuat karena jadwal bawaan tidak ada |
| Keterangan tidak dikenal | Rendah | Keterangan di luar daftar yang dikenali |
| Upload belum ada | Tinggi | Jadwal unggah sudah lewat dan berkas periode itu belum masuk |

Keterangan yang tidak menimbulkan **Keterangan tidak dikenal**: libur, terlambat, kurang presensi masuk, kurang presensi keluar, dan tanpa keterangan. **Tanpa keterangan** tetap memunculkan temuannya sendiri.

## Kurang presensi

Temuan ini mencatat satu hari yang presensinya belum lengkap. Tingkatnya rendah. Menutupnya tidak mengubah jam.

| Pesan | Artinya |
| --- | --- |
| Kurang presensi masuk | Hari kerja itu tidak punya jam masuk. Keterangan pada laporan persis **Kurang Presensi Masuk** |
| Kurang presensi keluar | Hari kerja itu punya jam masuk, tetapi jam pulang kosong. Keterangan pada laporan persis **Kurang Presensi Keluar** |

Contoh: jadwal 08:00–17:05, masuk 07:57, jam keluar kosong, keterangan **Kurang Presensi Keluar**. Dasbor tetap menghitung hari itu sebagai kurang presensi.

Di halaman detail:

- **Tandai diketahui** menandai bahwa temuan sudah dilihat. Status menjadi Diketahui dan tetap terbuka. Catatan bersifat opsional.
- **Selesaikan** menutupnya karena perlu ditindaklanjuti. Catatan wajib.
- **Bukan masalah** menutupnya karena tidak perlu diperbaiki. Catatan wajib.

Jam yang hilang diperbaiki lewat **Koreksi**, setelah Team Leader, Operation Manager, dan Project Manager menyetujui. Menutup anomali saja tidak mengisi jam.

Dasbor tidak menghitung kurang presensi untuk keterangan yang diawali cuti atau sakit. Pemeriksaan berkas tetap menandai keterangan itu sebagai tidak dikenal sampai daftar keterangan resmi diperluas.

## Status

| Status | Arti |
| --- | --- |
| Terbuka | Belum ditindak |
| Diketahui | Sudah diakui, masih terbuka |
| Selesai | Ditutup dengan catatan |
| Bukan masalah | Ditutup sebagai temuan yang tidak perlu diperbaiki |

Temuan tidak mengirim notifikasi. Lonceng dipakai untuk koreksi serta pengajuan cuti, sakit, dan lembur yang sedang ditinjau.
