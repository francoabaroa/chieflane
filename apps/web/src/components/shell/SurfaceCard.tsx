"use client";

import Link from "next/link";
import type { StoredSurface } from "@chieflane/surface-schema";
import { formatRelativeTime } from "@chieflane/shared";
import { StatusChip } from "./StatusChip";
import {
  FileText,
  ListChecks,
  PenLine,
  Target,
  User,
  Layout,
  BarChart3,
  Clock,
  Radio,
} from "lucide-react";

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  brief: FileText,
  queue: ListChecks,
  composer: PenLine,
  prep: Target,
  debrief: Target,
  dossier: User,
  board: Layout,
  digest: BarChart3,
  timeline: Clock,
  flow_monitor: Radio,
};

function SurfaceCardContent({
  surface,
  selected = false,
}: {
  surface: StoredSurface;
  selected?: boolean;
}) {
  const TypeIcon = TYPE_ICONS[surface.payload.surfaceType] ?? FileText;

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 border-b border-border text-left transition-colors ${
        selected
          ? "bg-surface-hover border-l-[3px] border-l-accent pl-[calc(1rem-3px)]"
          : "hover:bg-surface-hover"
      }`}
    >
      <TypeIcon size={15} className="text-text-tertiary shrink-0 mt-0.5" aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[0.8125rem] font-semibold text-text-primary truncate">
            {surface.title}
          </p>
          <StatusChip status={surface.status} />
        </div>

        {surface.subtitle && (
          <p className="text-[0.75rem] text-text-tertiary truncate mt-0.5">
            {surface.subtitle}
          </p>
        )}

        <p className="mt-1 text-[0.75rem] text-text-secondary leading-relaxed line-clamp-2">
          {surface.summary}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[0.625rem] text-text-tertiary uppercase tracking-wider font-[family-name:var(--font-mono)]">
            {surface.payload.surfaceType}
          </span>
          {surface.actions.length > 0 && (
            <>
              <span className="text-text-tertiary" aria-hidden="true">&middot;</span>
              <span className="text-[0.625rem] text-accent font-[family-name:var(--font-mono)]">
                {surface.actions.length} action{surface.actions.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
          <span className="ml-auto text-[0.625rem] text-text-tertiary font-[family-name:var(--font-mono)] tabular-nums">
            {formatRelativeTime(surface.freshness.generatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SurfaceCard({
  surface,
  selected = false,
  onSelectSurface,
  laneRoute,
}: {
  surface: StoredSurface;
  selected?: boolean;
  onSelectSurface?: (surfaceId: string) => void;
  laneRoute?: string;
}) {
  if (!onSelectSurface || !laneRoute) {
    return (
      <Link href={`/surface/${surface.id}`}>
        <SurfaceCardContent surface={surface} selected={selected} />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onSelectSurface(surface.id)}
        aria-pressed={selected}
        className="hidden w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:block"
      >
        <SurfaceCardContent surface={surface} selected={selected} />
      </button>

      <Link href={`/surface/${surface.id}`} className="md:hidden">
        <SurfaceCardContent surface={surface} selected={selected} />
      </Link>
    </>
  );
}
