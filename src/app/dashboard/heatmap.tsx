import Link from "next/link";
import { formatCalendarDate, formatMinutes } from "@/lib/format";

const WEEKDAYS = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"];

function tone(minutes: number): string {
  if (minutes <= 0) return "bg-surface-2 text-ink-2";
  if (minutes <= 60) return "bg-warn-soft text-warn";
  if (minutes <= 120) return "bg-warn-soft text-ink ring-1 ring-warn";
  return "bg-danger-soft text-danger";
}

function mondayIndex(iso: string): number {
  const date = new Date(`${iso}T12:00:00Z`);
  return (date.getUTCDay() + 6) % 7;
}

export function Heatmap({
  cells,
  anomalyDates = [],
  anomalyHref,
}: {
  cells: Array<{ date: string; lateMinutes: number }>;
  anomalyDates?: readonly string[];
  anomalyHref?: (date: string) => string;
}) {
  if (cells.length === 0) return null;
  const marked = new Set(anomalyDates);
  const pad = mondayIndex(cells[0].date);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-2">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: pad }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {cells.map((cell) => {
          const hasAnomaly = marked.has(cell.date);
          const label = `${formatCalendarDate(cell.date)}, telat ${formatMinutes(cell.lateMinutes)}${hasAnomaly ? ", ada anomali" : ""}`;
          const className = `relative flex h-9 items-center justify-center rounded text-[10px] ${tone(cell.lateMinutes)}`;
          const day = cell.date.slice(8);
          const dot = hasAnomaly ? <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" /> : null;
          const href = hasAnomaly ? anomalyHref?.(cell.date) : undefined;
          if (href) {
            return (
              <Link
                key={cell.date}
                href={href}
                aria-label={label}
                title={label}
                className={`${className} outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                {dot}
                {day}
              </Link>
            );
          }
          return (
            <div key={cell.date} role="img" aria-label={label} title={label} className={className}>
              {dot}
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
