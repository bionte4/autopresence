import type { ChainStep } from "@/modules/review/chain";

const STATE_LABEL = {
  done: "Disetujui",
  current: "Giliran ini",
  waiting: "Berikutnya",
  rejected: "Ditolak",
  skipped: "Dilewati",
} as const;

export function ReviewChain({ steps }: { steps: ChainStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="panel flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={step.seat} className="flex items-start justify-between gap-3 text-sm">
          <span>
            <span className="font-semibold">
              {index + 1}. {step.label}
            </span>
            {step.reviewerName ? <span className="block text-xs text-ink-2">{step.reviewerName}</span> : null}
            {step.note ? <span className="block text-ink-2">{step.note}</span> : null}
          </span>
          <span className={step.state === "rejected" ? "text-danger" : "text-ink-2"}>{STATE_LABEL[step.state]}</span>
        </li>
      ))}
    </ol>
  );
}
