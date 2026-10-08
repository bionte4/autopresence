/** Default office hours from the sample report: 08:00–17:05 Asia/Jakarta. */
export const DEFAULT_WORK_SCHEDULE = {
  name: "Standar 08:00-17:05",
  startMin: 8 * 60,
  endMin: 17 * 60 + 5,
  lateToleranceMin: 0,
} as const;

export const RECOMPUTE_TOLERANCE_MIN = 1;
