import type { AnomalyStatus, AnomalyType, Severity } from "@prisma/client";

export const ANOMALY_TYPE_LABEL: Record<AnomalyType, string> = {
  ROW_MISMATCH: "Baris tidak cocok",
  TOTAL_MISMATCH: "Total tidak cocok",
  DAYS_MISMATCH: "Jumlah hari tidak cocok",
  DATA_CHANGED: "Data berubah",
  DUPLICATE_FILE: "Berkas duplikat",
  MISSING_UPLOAD: "Upload belum ada",
  MISSING_PUNCH: "Kurang presensi",
  REPEATED_LATE: "Terlambat berulang",
  NO_REASON: "Tanpa keterangan",
  FORMAT_UNKNOWN: "Format tidak dikenal",
  GRANULARITY_MISMATCH: "Jenis periode tidak sesuai",
  FILE_METADATA_SUSPICIOUS: "Metadata mencurigakan",
  UNKNOWN_EMPLOYEE: "PIN tidak terdaftar",
  UNKNOWN_NOTE: "Keterangan tidak dikenal",
};

export const ANOMALY_STATUS_LABEL: Record<AnomalyStatus, string> = {
  OPEN: "Terbuka",
  ACKNOWLEDGED: "Diketahui",
  RESOLVED: "Selesai",
  FALSE_POSITIVE: "Bukan masalah",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};
