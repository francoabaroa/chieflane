"use client";

import type { QueueData, QueueItem as QueueItemType } from "@chieflane/surface-schema";
import { ChevronRight, Circle, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const STATE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ size?: number; className?: string }>; color: string }
> = {
  new: { icon: Circle, color: "text-info" },
  queued: { icon: Clock, color: "text-text-tertiary" },
  ready: { icon: Circle, color: "text-success" },
  blocked: { icon: AlertCircle, color: "text-critical" },
  done: { icon: CheckCircle2, color: "text-success" },
};

function QueueRow({ item }: { item: QueueItemType }) {
  const config = STATE_CONFIG[item.state ?? "ready"] ?? STATE_CONFIG.ready;
  const Icon = config.icon;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
      <Icon size={14} className={config.color} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[0.8125rem] font-medium text-text-primary truncate">
            {item.title}
          </p>
          {item.score !== undefined && (
            <span className="shrink-0 text-[0.625rem] font-[family-name:var(--font-mono)] text-text-tertiary tabular-nums">
              {item.score}
            </span>
          )}
        </div>
        <p className="text-[0.75rem] text-text-secondary mt-0.5 truncate">
          {item.reason}
        </p>
        {item.subtitle && (
          <p className="text-[0.625rem] text-text-tertiary mt-0.5">{item.subtitle}</p>
        )}
      </div>

      {item.dueAt && (
        <span className="shrink-0 text-[0.625rem] text-warning font-medium font-[family-name:var(--font-mono)]">
          {item.dueAt}
        </span>
      )}

      <ChevronRight
        size={12}
        className="shrink-0 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </div>
  );
}

export function QueueSurface({ data }: { data: QueueData }) {
  if (!data.items.length) {
    return (
      <div className="flex flex-col items-start py-12">
        <CheckCircle2 size={24} className="text-success mb-2" />
        <p className="text-[0.875rem] text-text-secondary">
          {data.emptyMessage ?? "All clear."}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border">
      <div className="px-4 py-2.5 border-b border-border bg-surface">
        <div className="flex items-center justify-between">
          <span className="text-[0.625rem] text-text-tertiary uppercase tracking-wider font-medium font-[family-name:var(--font-mono)]">
            {data.items.length} item{data.items.length !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-3">
            {["new", "ready", "blocked"].map((state) => {
              const count = data.items.filter((i) => i.state === state).length;
              if (!count) return null;
              const cfg = STATE_CONFIG[state];
              return (
                <span
                  key={state}
                  className={`text-[0.625rem] font-medium font-[family-name:var(--font-mono)] ${cfg.color}`}
                >
                  {count} {state}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {data.items.map((item) => (
        <QueueRow key={item.id} item={item} />
      ))}
    </div>
  );
}
