import { formatMinutes } from "@/lib/format";

const LABELS: Record<string, string> = {
  clockInMin: "Jam masuk",
  clockOutMin: "Jam keluar",
  lateMin: "Telat",
  actualLateMin: "Terlambat aktual",
  earlyArrivalMin: "Datang cepat",
  earlyLeaveMin: "Pulang cepat",
  lateLeaveMin: "Pulang telat",
  note: "Keterangan",
};

function show(value: unknown): string {
  if (typeof value === "number") return formatMinutes(value);
  if (value === null || value === undefined || value === "") return "kosong";
  return String(value);
}

export function DiffTable({ details }: { details: unknown }) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const record = details as { before?: unknown; after?: unknown };
  if (!record.before || !record.after || typeof record.before !== "object" || typeof record.after !== "object") return null;
  const before = record.before as Record<string, unknown>;
  const after = record.after as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => key in LABELS);
  if (keys.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Perbandingan nilai sebelum dan sesudah</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-3 font-semibold">Kolom</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Sebelum</th>
            <th scope="col" className="py-2 font-semibold">Sesudah</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const changed = show(before[key]) !== show(after[key]);
            return (
              <tr key={key} className="border-b border-line">
                <th scope="row" className="py-2 pr-3 font-medium">{LABELS[key]}</th>
                <td className="py-2 pr-3">{show(before[key])}</td>
                <td className={`py-2 ${changed ? "bg-warn-soft font-semibold" : ""}`}>
                  {show(after[key])}
                  {changed ? <span className="sr-only">, berubah dari {show(before[key])}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
