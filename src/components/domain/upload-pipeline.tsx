import { Check, Circle, CircleAlert } from "lucide-react";

const STEPS = ["Periksa berkas", "Hitung hash", "Baca data", "Cek konsistensi", "Simpan"] as const;

type StepState = "waiting" | "done" | "failed";

export function UploadPipeline({ status }: { status: "RECEIVED" | "PARSED" | "PARSED_WITH_ANOMALIES" | "REJECTED" }) {
  const states: StepState[] =
    status === "REJECTED"
      ? ["failed", "waiting", "waiting", "waiting", "waiting"]
      : status === "RECEIVED"
        ? ["done", "waiting", "waiting", "waiting", "waiting"]
        : ["done", "done", "done", "done", "done"];

  return (
    <ol className="flex flex-col gap-3">
      {STEPS.map((label, index) => {
        const state = states[index];
        const Icon = state === "done" ? Check : state === "failed" ? CircleAlert : Circle;
        const color = state === "done" ? "text-ok" : state === "failed" ? "text-danger" : "text-ink-2";
        return (
          <li key={label} className="flex items-center gap-3 text-sm">
            <Icon aria-hidden="true" size={16} strokeWidth={1.75} className={color} />
            <span className={state === "waiting" ? "text-ink-2" : "font-semibold"}>
              {label}
              <span className="sr-only">
                {state === "done" ? ", selesai" : state === "failed" ? ", gagal" : ", menunggu"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
