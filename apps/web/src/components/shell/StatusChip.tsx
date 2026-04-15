"use client";

import type { Status } from "@chieflane/surface-schema";

const STATUS_CONFIG: Record<
  Status,
  { dot: string; text: string; label: string }
> = {
  queued: { dot: "bg-info", text: "text-info", label: "Queued" },
  ready: { dot: "bg-success", text: "text-success", label: "Ready" },
  awaiting_review: {
    dot: "bg-warning",
    text: "text-warning",
    label: "Review",
  },
  blocked: {
    dot: "bg-critical",
    text: "text-critical",
    label: "Blocked",
  },
  done: { dot: "bg-success", text: "text-success", label: "Done" },
  archived: {
    dot: "bg-text-tertiary",
    text: "text-text-tertiary",
    label: "Archived",
  },
};

const TONE_CONFIG: Record<string, { dot: string; text: string }> = {
  neutral: { dot: "bg-text-tertiary", text: "text-text-secondary" },
  good: { dot: "bg-success", text: "text-success" },
  warn: { dot: "bg-warning", text: "text-warning" },
  critical: { dot: "bg-critical", text: "text-critical" },
};

export function StatusChip({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span className="text-[0.6875rem] font-medium font-[family-name:var(--font-mono)] uppercase tracking-normal">
        {config.label}
      </span>
    </span>
  );
}

export function ToneChip({
  tone,
  label,
}: {
  tone: string;
  label: string;
}) {
  const config = TONE_CONFIG[tone] ?? TONE_CONFIG.neutral;
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span className="text-[0.6875rem] font-medium font-[family-name:var(--font-mono)] uppercase tracking-normal">
        {label}
      </span>
    </span>
  );
}
