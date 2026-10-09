# Panduan admin

Untuk HR Admin dan Super Admin. Cara memakai dasbor, koreksi, dan pengajuan ada di [panduan pengguna](PANDUAN-PENGGUNA.md). Batas tiap peran ada di [matriks RBAC](RBAC.md).

HR Admin mengurus data operasional. Super Admin melakukan hal yang sama, plus akun login dan audit.

## Urutan data master

Isi data dari yang lebih umum ke yang lebih khusus. Menu ada di grup **Data master**.

1. **Pelanggan**, lalu **Proyek**. Satu proyek milik satu pelanggan.
2. **Departemen**. Satu departemen boleh diikat ke satu proyek, dan di sinilah manajer serta tiga kursi peninjau ditunjuk.
3. **Jadwal** kerja: jam masuk, jam keluar, dan toleransi terlambat, semuanya dalam hitungan menit lewat isian jam.
4. **Pegawai**: nama, PIN unik, departemen, dan jadwal. Akun login ditautkan kemudian oleh Super Admin.

Hapus pada pelanggan, proyek, departemen, dan pegawai menonaktifkan data (`deletedAt`). Jadwal kerja yang tidak terpakai boleh dihapus sungguhan.

PIN yang muncul di laporan tetapi belum ada di master akan dibuat otomatis saat unggah, memakai jadwal bawaan, tanpa departemen. Tempatkan pegawai itu ke departemen yang benar supaya manajer dan peninjau bisa melihatnya. Tanpa jadwal bawaan, PIN baru tidak dibuat dan unggah mencatat anomali **PIN tidak terdaftar**.

## Kursi peninjau

Buka departemen, lalu isi tiga kursi:

| Kursi | Giliran |
| --- | --- |
| Team Leader | Pertama |
| Operation Manager | Kedua |
| Project Manager | Terakhir |

Pilih akun yang aktif dan bukan Auditor atau Pelanggan. Satu orang boleh memegang lebih dari satu kursi, tetapi ia harus menyetujui tiap tahap secara terpisah. Kursi kosong membuat koreksi dan pengajuan departemen itu berhenti dengan pesan bahwa kursi belum ada.

Menunjuk manajer departemen mengatur lingkup data manajer. Itu terpisah dari kursi peninjau.

## Akun login

Hanya Super Admin, lewat **Akun login**.

- Email unik, nama, peran, dan kata sandi awal.
- Tautkan akun ke satu pegawai jika orang itu harus melihat absensinya sendiri.
- Peran **Manajer** perlu juga ditunjuk pada departemen, kalau tidak ia tidak melihat data tim.
- Peran **Pelanggan** wajib memilih satu pelanggan. Akun itu hanya membuka dasbor pegawai pada departemen proyek pelanggan tersebut. Proyek dan departemen harus sudah dihubungkan. Akun ini tidak ditautkan ke pegawai dan tidak bisa duduk di kursi peninjau.
- Menonaktifkan akun melepas tautan pegawai. Akun tidak dihapus permanen.

Jangan memakai kata sandi bawaan pengembangan di lingkungan sungguhan.

## Unggah laporan

Menu **Unggah** menerima berkas **Laporan Per Atribut** (`.xlsx`), paling besar 10 MB. Berkas berisi makro ditolak.

Pilih jenis periode:

| Jenis | Rentang yang diterima |
| --- | --- |
| Harian | Tepat satu hari |
| Mingguan | Paling lama 7 hari |
| Bulanan | Paling lama 35 hari |

Periode yang lebih pendek tetap diterima pada jenis yang lebih lebar, tanpa anomali. Anomali **Jenis periode tidak sesuai** muncul jika periodenya lebih panjang dari jenis yang dipilih, misalnya laporan sebulan diunggah sebagai harian.

Setelah unggah, aplikasi membuka halaman berkas: status, pegawai baru, bentrok data, dan temuan yang dikelompokkan. **Lihat di dasbor** membuka ringkasan tanggal berkas itu. **Unduh berkas asli** mengambil salinan yang tersimpan.

Daftar unggah adalah arsip. Cari nama berkas atau saring status di atas daftar. Hapus hanya ada di halaman berkas, dan hanya untuk HR Admin serta Super Admin.

Hapus berkas ikut menghapus baris absensi yang bersumber dari berkas itu dan anomalinya. Pegawai tetap ada. Hapus ditolak jika baris dari berkas itu sudah punya revisi atau koreksi. Berkas yang sama (hash sama) tidak bisa diunggah dua kali; setelah dihapus, berkas yang sama boleh diunggah lagi.

Jika laporan baru mengubah hari yang sudah lengkap, data lama tidak ditimpa. Aplikasi membuat anomali **Data berubah** dan menunggu penyelesaian HR. Jika baris lama hanya belum punya jam keluar dan berkas baru melengkapinya, baris itu diperbarui dan revisinya disimpan.

## Pemantauan unggah

**Pemantauan** menunjukkan apakah laporan harian, mingguan, atau bulanan sudah masuk sebelum batas waktu. Jadwal dibuat di halaman yang sama.

| Status | Arti |
| --- | --- |
| Diterima | Berkas periode itu sudah masuk |
| Belum jatuh tempo | Batas waktu belum lewat |
| Belum diterima | Batas sudah lewat dan berkas belum ada |

Worker membuat anomali **Upload belum ada** sekali untuk periode yang terlewat. Menonaktifkan jadwal menghentikan pantauan itu.

## Anomali dan audit

HR Admin dan Super Admin melihat semua anomali dan boleh menutup semua tingkat keparahan. Catatan wajib saat menutup. Detail tiap jenis ada di [jenis anomali](ANOMALI.md).

Layar pengaturan aturan anomali belum tersedia. Aturan bawaan aktif dari data awal.

**Audit** hanya untuk Super Admin dan Auditor. Setiap masuk, unggah, perubahan data, dan keputusan peninjau menambah baris. Rantai hash bisa diperiksa dari halaman itu. Audit dan revisi absensi tidak bisa diubah atau dihapus lewat aplikasi.

## Laporan resmi

Angka Excel pada menu **Laporan** dihitung ulang dari baris harian, sama seperti dasbor. Jangan memakai baris Total pada berkas sumber sebagai angka resmi jika dasbor atau anomali menunjukkan selisih.
