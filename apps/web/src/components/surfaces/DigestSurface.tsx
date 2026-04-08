"use client";

import type { DigestData } from "@chieflane/surface-schema";
import { ToneChip } from "@/components/shell/StatusChip";
import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";

const DECISION_CONFIG: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; dot: string }> = {
  pending: { icon: Clock, color: "text-warning", dot: "bg-warning" },
  apply: { icon: CheckCircle2, color: "text-success", dot: "bg-success" },
  defer: { icon: ArrowRight, color: "text-info", dot: "bg-info" },
  reject: { icon: XCircle, color: "text-critical", dot: "bg-critical" },
};

export function DigestSurface({ data }: { data: DigestData }) {
  return (
    <div className="space-y-5">
      <p className="text-[0.8125rem] text-text-secondary leading-relaxed max-w-[65ch]">
        {data.summary}
      </p>

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

      {data.recommendations.length > 0 && (
        <div>
          <h3 className="text-[0.6875rem] font-medium uppercase tracking-wider text-text-tertiary font-[family-name:var(--font-mono)] mb-2">
            Recommendations
          </h3>
          <div className="border border-border divide-y divide-border">
            {data.recommendations.map((rec) => {
              const config = DECISION_CONFIG[rec.decision ?? "pending"];

              return (
                <div key={rec.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 ${config.dot}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] font-medium text-text-primary">
                        {rec.label}
                      </p>
                      <p className="text-[0.75rem] text-text-secondary mt-0.5">
                        {rec.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[0.5625rem] font-bold uppercase tracking-wider font-[family-name:var(--font-mono)] ${config.color}`}
                    >
                      {rec.decision}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
