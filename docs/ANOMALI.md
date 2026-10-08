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
| Kurang presensi | Rendah | Keterangan hari itu persis **kurang presensi masuk** atau **kurang presensi keluar** |
| Terlambat berulang | Sedang | Telat tercatat beberapa kali dalam satu periode. Ambang bawaan tiga kali, dihitung dari kolom telat |
| Tanpa keterangan | Sedang | Hari kerja yang keterangannya persis **tanpa keterangan** |
| Format tidak dikenal | Tinggi | Tata letak bukan Laporan Per Atribut. Berkas ditolak dan tidak ditebak |
| Jenis periode tidak sesuai | Rendah | Panjang periode berkas tidak muat pada jenis yang dipilih saat unggah |
| Metadata mencurigakan | Sedang | Pembuat dan pengubah berbeda, aplikasi bukan sumber asli, atau berkas diubah lebih dari sehari setelah dibuat |
| PIN tidak terdaftar | Sedang | PIN belum ada di data pegawai dan tidak bisa dibuat karena jadwal bawaan tidak ada |
| Keterangan tidak dikenal | Rendah | Keterangan di luar daftar yang dikenali |
| Upload belum ada | Tinggi | Jadwal unggah sudah lewat dan berkas periode itu belum masuk |

Keterangan yang tidak menimbulkan **Keterangan tidak dikenal**: libur, terlambat, kurang presensi masuk, kurang presensi keluar, dan tanpa keterangan. **Tanpa keterangan** tetap memunculkan temuannya sendiri.

Dasbor tidak menghitung kurang presensi untuk keterangan yang diawali cuti atau sakit. Pemeriksaan berkas tetap menandai keterangan itu sebagai tidak dikenal sampai daftar keterangan resmi diperluas.

## Status

| Status | Arti |
| --- | --- |
| Terbuka | Belum ditindak |
| Diketahui | Sudah diakui, masih terbuka |
| Selesai | Ditutup dengan catatan |
| Bukan masalah | Ditutup sebagai temuan yang tidak perlu diperbaiki |

Temuan tidak mengirim notifikasi. Lonceng dipakai untuk koreksi serta pengajuan cuti, sakit, dan lembur yang sedang ditinjau.
