import { AlertTriangle, CircleAlert, Minus, OctagonAlert } from "lucide-react";
import type { Severity } from "@prisma/client";
import { SEVERITY_LABEL } from "@/modules/anomalies/labels";

const STYLE = {
  LOW: { className: "bg-low-soft text-low", Icon: Minus },
  MEDIUM: { className: "bg-warn-soft text-warn", Icon: AlertTriangle },
  HIGH: { className: "bg-danger-soft text-danger", Icon: CircleAlert },
  CRITICAL: { className: "bg-critical-soft text-critical", Icon: OctagonAlert },
} as const;

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = STYLE[severity];
  const Icon = style.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${style.className}`}>
      <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
