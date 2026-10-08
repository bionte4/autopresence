/** Official lateness is the file's Telat column after the schedule tolerance, not a fresh clock subtraction. */
export function isLate(record: { lateMin: number | null }, schedule: { lateToleranceMin: number }): boolean {
  return (record.lateMin ?? 0) > schedule.lateToleranceMin;
}
