"use client";

import type { StoredSurface } from "@chieflane/surface-schema";
import { FirstRunEmptyState } from "@/components/FirstRunEmptyState";
import { SurfaceCard } from "./SurfaceCard";

export function SurfaceList({
  surfaces,
  emptyMessage,
  selectedSurfaceId,
  onSelectSurface,
  laneRoute,
  lane,
}: {
  surfaces: StoredSurface[];
  emptyMessage?: string;
  selectedSurfaceId?: string | null;
  onSelectSurface?: (surfaceId: string) => void;
  laneRoute?: string;
  lane?: string;
}) {
  if (!surfaces.length) {
    return (
      <FirstRunEmptyState
        lane={lane ?? "today"}
        fallbackMessage={emptyMessage ?? "No surfaces yet"}
      />
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
