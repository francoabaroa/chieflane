"use client";

import type { BriefData } from "@chieflane/surface-schema";
import { ToneChip } from "@/components/shell/StatusChip";

export function BriefSurface({ data }: { data: BriefData }) {
  return (
    <div className="space-y-5">
      <h2 className="font-[family-name:var(--font-display)] text-[1.5rem] md:text-[2rem] text-text-primary leading-[1.1]">
        {data.headline}
      </h2>

      {data.metrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 py-3 border-y border-border">
          {data.metrics.map((metric, i) => (
            <div key={i}>
              <p className="text-[0.625rem] text-text-tertiary uppercase tracking-wider font-medium font-[family-name:var(--font-mono)]">
                {metric.label}
              </p>
              <p className="text-[1.125rem] font-semibold text-text-primary mt-0.5 font-[family-name:var(--font-mono)] tabular-nums">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {data.sections.map((section, i) => {
          const borderColor: Record<string, string> = {
            neutral: "border-border",
            good: "border-success",
            warn: "border-warning",
            critical: "border-critical",
          };

          return (
            <div
              key={i}
              className={`border-l-[3px] ${borderColor[section.tone ?? "neutral"]} pl-4 py-1`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[0.875rem] font-semibold text-text-primary">
                  {section.title}
                </h3>
                {section.tone && section.tone !== "neutral" && (
                  <ToneChip tone={section.tone} label={section.tone} />
                )}
              </div>
              <p className="text-[0.8125rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-[65ch]">
                {section.body}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
