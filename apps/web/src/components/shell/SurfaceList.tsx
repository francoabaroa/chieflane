"use client";

import type { StoredSurface } from "@chieflane/surface-schema";
import { SurfaceCard } from "./SurfaceCard";

export function SurfaceList({
  surfaces,
  emptyMessage,
  selectedSurfaceId,
  onSelectSurface,
  laneRoute,
}: {
  surfaces: StoredSurface[];
  emptyMessage?: string;
  selectedSurfaceId?: string | null;
  onSelectSurface?: (surfaceId: string) => void;
  laneRoute?: string;
}) {
  if (!surfaces.length) {
    return (
      <div className="flex flex-col items-start px-4 py-16 md:py-20 animate-fade-in">
        <p className="text-[0.875rem] text-text-secondary font-medium">
          {emptyMessage ?? "No surfaces yet"}
        </p>
        <p className="text-[0.75rem] text-text-tertiary mt-1 max-w-[40ch] leading-relaxed">
          Surfaces appear here when your agent publishes work.
        </p>
      </div>
    );
  }

  return (
    <div>
      {surfaces.map((surface, i) => (
        <div
          key={surface.id}
          className="stagger-item"
          style={{ "--stagger-index": Math.min(i, 8) } as React.CSSProperties}
        >
          <SurfaceCard
            surface={surface}
            selected={selectedSurfaceId === surface.id}
            onSelectSurface={onSelectSurface}
            laneRoute={laneRoute}
          />
        </div>
      ))}
    </div>
  );
}
