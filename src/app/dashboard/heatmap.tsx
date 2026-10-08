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

export function Heatmap({ cells }: { cells: Array<{ date: string; lateMinutes: number }> }) {
  if (cells.length === 0) return null;
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
        {cells.map((cell) => (
          <div
            key={cell.date}
            role="img"
            aria-label={`${formatCalendarDate(cell.date)}, telat ${formatMinutes(cell.lateMinutes)}`}
            title={`${formatCalendarDate(cell.date)} · ${formatMinutes(cell.lateMinutes)}`}
            className={`flex h-9 items-center justify-center rounded text-[10px] ${tone(cell.lateMinutes)}`}
          >
            {cell.date.slice(8)}
          </div>
        ))}
      </div>
    </div>
  );
}
