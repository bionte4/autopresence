const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  sep: 9,
  okt: 10,
  nov: 11,
  des: 12,
};

const DAY_PREFIX = /^(Sn|Sl|Rb|Km|Jm|Sb|Mg)$/i;

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function calendarDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const lengths = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const max = month === 2 && leap ? 29 : lengths[month];
  if (day > max) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Inclusive day count. UTC noon keeps the calendar date stable without parsing a display string. */
export function inclusiveDays(start: string, end: string): number {
  const startMs = Date.parse(`${start}T12:00:00Z`);
  const endMs = Date.parse(`${end}T12:00:00Z`);
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

export function parseClock(raw: string): number | null | "invalid" {
  const value = raw.trim();
  if (value === "" || value === "-" || value.toLowerCase() === "null") return null;
  const match = /^(\d+):([0-5]\d)$/.exec(value);
  if (!match) return "invalid";
  return Number(match[1]) * 60 + Number(match[2]);
}

export function parseDisplayDate(raw: string): string | null | "invalid" {
  const value = raw.trim();
  if (value === "") return null;
  const match = /^(?:(Sn|Sl|Rb|Km|Jm|Sb|Mg),\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(value);
  if (!match) return "invalid";
  if (match[1] && !DAY_PREFIX.test(match[1])) return "invalid";
  const month = MONTHS[match[3].toLowerCase()];
  if (!month) return "invalid";
  const date = calendarDate(Number(match[4]), month, Number(match[2]));
  return date ?? "invalid";
}

export function parsePeriod(raw: string): { start: string; end: string } | null {
  const match = /^:?\s*(\d{1,2})\s+([A-Za-z]+)\s+-\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/.exec(raw.trim());
  if (!match) return null;
  const endMonth = MONTHS[match[4].toLowerCase()];
  const startMonth = MONTHS[match[2].toLowerCase()];
  if (!endMonth || !startMonth) return null;
  const endYear = Number(match[5]);
  const startYear = startMonth > endMonth ? endYear - 1 : endYear;
  const start = calendarDate(startYear, startMonth, Number(match[1]));
  const end = calendarDate(endYear, endMonth, Number(match[3]));
  if (!start || !end || start > end) return null;
  return { start, end };
}
