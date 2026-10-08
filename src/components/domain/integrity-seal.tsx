"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CircleAlert, OctagonAlert, ShieldCheck } from "lucide-react";

const TONE = {
  ok: { className: "border-ok bg-ok-soft text-ok", Icon: ShieldCheck },
  warn: { className: "border-warn bg-warn-soft text-warn", Icon: AlertTriangle },
  danger: { className: "border-danger bg-danger-soft text-danger", Icon: CircleAlert },
  critical: { className: "border-critical bg-critical-soft text-critical", Icon: OctagonAlert },
} as const;

export function IntegritySeal({
  tone,
  title,
  detail,
  hash,
  action,
}: {
  tone: keyof typeof TONE;
  title: string;
  detail: string;
  hash?: string | null;
  action?: { href: string; label: string };
}) {
  const style = TONE[tone];
  const Icon = style.Icon;
  const [copied, setCopied] = useState(false);
  const short = hash ? hash.slice(0, 8) : null;

  return (
    <section className={`flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${style.className}`}>
      <div className="flex gap-3">
        <Icon aria-hidden="true" size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-sm text-ink-2">{detail}</p>
          {short ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 whitespace-nowrap font-mono text-xs text-ink"
              onClick={() => {
                void navigator.clipboard.writeText(hash ?? "").then(() => setCopied(true)).catch(() => setCopied(false));
              }}
            >
              <span>{short}</span>
              <span className="font-sans font-semibold underline">{copied ? "Tersalin" : "Salin"}</span>
            </button>
          ) : null}
        </div>
      </div>
      {action ? (
        <Link href={action.href} className="btn shrink-0">
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}
