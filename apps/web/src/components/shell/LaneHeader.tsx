"use client";

import type { Lane } from "@chieflane/surface-schema";
import { useSurfaceStore } from "@/lib/client/surface-store";
import {
  Zap,
  Inbox,
  Calendar,
  PenLine,
  Users,
  BookOpen,
  Activity,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Zap,
  Inbox,
  Calendar,
  PenLine,
  Users,
  BookOpen,
  Activity,
};

export function LaneHeader({
  lane,
  icon,
  title,
  description,
  initialCount = 0,
}: {
  lane: Lane;
  icon: string;
  title: string;
  description: string;
  initialCount?: number;
}) {
  const Icon = ICON_MAP[icon];
  const count = useSurfaceStore((state) =>
    state.laneHydrated[lane]
      ? state.laneSurfaceIds[lane]?.length ?? 0
      : initialCount
  );

  return (
    <div className="sticky top-0 z-10 bg-base border-b border-border px-4 py-5 md:px-6 md:py-6">
      <div className="flex items-baseline gap-3">
        {Icon && (
          <Icon size={18} className="text-accent relative top-[2px]" aria-hidden="true" />
        )}
        <h1 className="font-[family-name:var(--font-display)] text-[1.75rem] md:text-[2.25rem] text-text-primary leading-none">
          {title}
        </h1>
        {count > 0 && (
          <span className="text-[0.6875rem] font-[family-name:var(--font-mono)] text-text-tertiary tabular-nums">
            {count}
          </span>
        )}
      </div>
      <p className="text-[0.8125rem] text-text-secondary mt-1.5 ml-[calc(18px+0.75rem)] md:ml-[calc(18px+0.75rem)]">
        {description}
      </p>
    </div>
  );
}
