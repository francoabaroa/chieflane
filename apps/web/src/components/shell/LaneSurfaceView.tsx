"use client";

import { startTransition, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Lane, StoredSurface } from "@chieflane/surface-schema";
import { useSurfaceStore } from "@/lib/client/surface-store";
import { useActionProgressStore } from "@/lib/client/action-progress-store";
import { isVisibleLaneSurface } from "@/lib/surfaces/visibility";
import { useStream } from "@/hooks/useStream";
import { SurfaceList } from "./SurfaceList";
import { SurfaceDetailShell } from "./SurfaceDetailShell";

export function LaneSurfaceView({
  lane,
  initialSurfaces,
  emptyMessage,
}: {
  lane: Lane;
  initialSurfaces: StoredSurface[];
  emptyMessage: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const replaceLane = useSurfaceStore((state) => state.replaceLane);
  const upsertSurface = useSurfaceStore((state) => state.upsertSurface);
  const removeSurface = useSurfaceStore((state) => state.removeSurface);
  const setActionProgress = useActionProgressStore((state) => state.setProgress);
  const surfaceIds = useSurfaceStore((state) => state.laneSurfaceIds[lane] ?? []);
  const surfacesById = useSurfaceStore((state) => state.surfacesById);
  const surfaces = surfaceIds
    .map((surfaceId) => surfacesById[surfaceId])
    .filter((surface): surface is StoredSurface => Boolean(surface));

  useEffect(() => {
    replaceLane(lane, initialSurfaces);
  }, [initialSurfaces, lane, replaceLane]);

  useStream((event) => {
    if (event.type === "action.progress") {
      setActionProgress(event.surfaceId, event.data ?? {});
      return;
    }

    if (event.type === "surface.closed") {
      startTransition(() => {
        removeSurface(event.surfaceId);
      });
      return;
    }

    if (event.type === "surface.updated" && event.data?.surface) {
      const surface = event.data.surface;
      startTransition(() => {
        if (isVisibleLaneSurface(surface, lane)) {
          upsertSurface(surface);
        } else {
          removeSurface(surface.id);
        }
      });
      return;
    }

    const eventLane = event.data?.lane;
    const eventStatus = event.data?.status;
    if (
      (eventLane && eventLane !== lane) ||
      eventStatus === "done" ||
      eventStatus === "archived"
    ) {
      startTransition(() => {
        removeSurface(event.surfaceId);
      });
      return;
    }

    void (async () => {
      const response = await fetch(`/api/surfaces?id=${event.surfaceId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const surface = (await response.json()) as StoredSurface;
      startTransition(() => {
        if (isVisibleLaneSurface(surface, lane)) {
          upsertSurface(surface);
        } else {
          removeSurface(surface.id);
        }
      });
    })();
  });

  const selectedSurfaceId =
    searchParams.get("surface") ?? surfaces[0]?.id ?? null;
  const selectedSurface =
    surfaces.find((surface) => surface.id === selectedSurfaceId) ?? surfaces[0] ?? null;

  const handleSelectSurface = (surfaceId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("surface", surfaceId);
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  return (
    <div>
      {surfaces.length === 0 ? (
        <SurfaceList surfaces={surfaces} emptyMessage={emptyMessage} lane={lane} />
      ) : (
        <div className="md:grid md:grid-cols-[360px_1fr] md:h-[calc(100dvh-var(--lane-header-h,73px))]">
          <div className="md:overflow-y-auto md:border-r md:border-border">
            <SurfaceList
              surfaces={surfaces}
              emptyMessage={emptyMessage}
              selectedSurfaceId={selectedSurface?.id}
              onSelectSurface={handleSelectSurface}
              laneRoute={pathname}
              lane={lane}
            />
          </div>

          <div className="hidden md:block md:overflow-y-auto">
            {selectedSurface ? (
              <SurfaceDetailShell surface={selectedSurface} embedded />
            ) : (
              <div className="flex min-h-[28rem] items-center justify-center text-[0.8125rem] text-text-tertiary">
                Select a surface to review it here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
