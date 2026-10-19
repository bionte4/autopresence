# Laporan lembur (pembinaan)

Laporan Excel untuk **pembinaan internal** (jam mingguan, istirahat, lembur vs pengajuan). Bukan putusan hukum, bukan sanksi otomatis, dan bukan pengganti nasihat hukum.

Di halaman **Laporan**: tombol **Pratinjau** menampilkan ringkasan di layar; **Unduh Excel** mengunduh berkas yang sama. Peran pelanggan (CUSTOMER) tidak punya akses. Lingkup data mengikuti RBAC yang sama dengan rekap kehadiran.

## Apa yang diukur (lingkup awal)

| Lembar | Acuan | Sumber data |
| --- | --- | --- |
| Ringkasan | Gabungan temuan per pegawai + catatan pembinaan | Agregasi dari dua lembar detail |
| Jam mingguan | Acuan umum **40 jam/minggu** | Jam aktual harian (`actualMin`, atau selisih masuk–keluar jika actual kosong) |
| Lembur | Jam di luar jadwal vs **pengajuan lembur yang disetujui** | `lateLeaveMin` atau selisih pulang vs `scheduleOut`; dibanding `AttendanceRequest` kind OVERTIME status APPROVED |

Istirahat: ditandai di ringkasan jika ada **7 hari kalender beruntun** dengan jam kerja tercatat (> 0 menit) dalam periode yang dipilih.

## Cara membaca

- Status “Perlu ditinjau” / catatan pembinaan = bahan diskusi dengan atasan atau HR, bukan pelanggaran yang diputus sistem.
- Minggu di atas 40 jam memakai jumlah jam aktual dalam minggu ISO, bukan baris Total dari berkas sumber.
- Selisih lembur tanpa persetujuan = menit di luar jadwal dikurangi menit pengajuan yang sudah disetujui pada tanggal yang sama.
- Toleransi detik laporan sumber tidak dipakai di sini; angka diambil dari data yang sudah tersimpan setelah ingest.

## Batasan sengaja

Belum dihitung: istirahat antar-shift, cuti/sakit sebagai hari istirahat resmi, lembur lintas hari, dan aturan upah lembur. Perluas hanya setelah lingkup awal dipakai dan disepakati.