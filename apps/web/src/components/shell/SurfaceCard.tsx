"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import type { StoredSurface } from "@chieflane/surface-schema";
import { formatRelativeTime } from "@chieflane/shared";
import { useActionProgressStore } from "@/lib/client/action-progress-store";
import { StatusChip } from "./StatusChip";
import { CardQuickActions } from "./CardQuickActions";
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

const TYPE_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
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
}: {
  surface: StoredSurface;
}) {
  const TypeIcon = TYPE_ICONS[surface.payload.surfaceType] ?? FileText;
  const progress = useActionProgressStore(
    (state) => state.bySurfaceId[surface.id]
  );

  return (
    <div className="flex items-start gap-3 px-4 py-3 text-left">
      <TypeIcon size={15} className="text-text-tertiary shrink-0 mt-0.5" aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold leading-tight text-text-primary break-words sm:truncate">
              {surface.title}
            </p>

            {surface.subtitle ? (
              <p className="mt-0.5 text-[0.75rem] text-text-tertiary break-words sm:truncate">
                {surface.subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <StatusChip status={surface.status} />
            {progress?.status === "running" ? (
              <span className="inline-flex shrink-0 whitespace-nowrap rounded-md bg-info-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-info">
                Updating
              </span>
            ) : null}
          </div>
        </div>

        <p className="mt-1 text-[0.75rem] text-text-secondary leading-relaxed line-clamp-2">
          {surface.summary}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[0.6875rem] text-text-tertiary uppercase tracking-normal font-[family-name:var(--font-mono)]">
            {surface.payload.surfaceType}
          </span>
          {surface.actions.length > 0 ? (
            <>
              <span className="text-text-tertiary" aria-hidden="true">&middot;</span>
              <span className="text-[0.6875rem] text-text-secondary font-[family-name:var(--font-mono)]">
                {surface.actions.length} action{surface.actions.length !== 1 ? "s" : ""}
              </span>
            </>
          ) : null}
          <span className="text-[0.6875rem] text-text-tertiary font-[family-name:var(--font-mono)] tabular-nums sm:ml-auto">
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
  const wrapperClass = `group border-b border-border transition-colors ${
    selected
      ? "bg-surface-hover ring-1 ring-inset ring-accent/30"
      : "hover:bg-surface-hover"
  }`;

  if (!onSelectSurface || !laneRoute) {
    return (
      <div className={wrapperClass}>
        <Link
          href={`/surface/${surface.id}`}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <SurfaceCardContent surface={surface} />
        </Link>
        <CardQuickActions surface={surface} />
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={() => onSelectSurface(surface.id)}
        aria-pressed={selected}
        className="hidden w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:block"
      >
        <SurfaceCardContent surface={surface} />
      </button>

      <Link href={`/surface/${surface.id}`} className="md:hidden">
        <SurfaceCardContent surface={surface} />
      </Link>
      <CardQuickActions surface={surface} />
    </div>
  );
}
