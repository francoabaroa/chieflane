"use client";

import type { BoardData } from "@chieflane/surface-schema";
import { Clock } from "lucide-react";

const TAG_COLORS: Record<string, string> = {
  critical: "text-critical",
  overdue: "text-warning",
  meeting: "text-info",
  outreach: "text-accent",
  content: "text-success",
  finance: "text-info",
  hiring: "text-accent",
  ops: "text-text-secondary",
};

export function BoardSurface({ data }: { data: BoardData }) {
  return (
    <div className="md:grid md:grid-cols-3 md:divide-x md:divide-border border border-border">
      {data.columns.map((column) => (
        <div key={column.id}>
          <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
            <h3 className="text-[0.6875rem] font-semibold text-text-primary uppercase tracking-wider font-[family-name:var(--font-mono)]">
              {column.label}
            </h3>
            <span className="text-[0.625rem] text-text-tertiary font-[family-name:var(--font-mono)] tabular-nums">
              {column.items.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {column.items.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-surface-hover transition-colors"
              >
                <p className="text-[0.8125rem] font-medium text-text-primary">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-[0.75rem] text-text-tertiary mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {item.dueAt && (
                    <span className="inline-flex items-center gap-1 text-[0.625rem] text-warning font-medium font-[family-name:var(--font-mono)]">
                      <Clock size={9} aria-hidden="true" />
                      {item.dueAt}
                    </span>
                  )}
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[0.5625rem] font-semibold uppercase tracking-wider font-[family-name:var(--font-mono)] ${TAG_COLORS[tag] ?? "text-text-tertiary"}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {column.items.length === 0 && (
              <div className="px-4 py-8 text-center text-[0.75rem] text-text-tertiary">
                No items
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
