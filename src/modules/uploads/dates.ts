/** Calendar dates are stored at UTC midnight so the DATE column does not shift with the server timezone. */
export function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
