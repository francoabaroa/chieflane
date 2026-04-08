"use client";

import { startTransition, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Lane, StoredSurface } from "@chieflane/surface-schema";
import { useSurfaceStore } from "@/lib/client/surface-store";
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
  const surfaceIds = useSurfaceStore((state) => state.laneSurfaceIds[lane] ?? []);
  const surfacesById = useSurfaceStore((state) => state.surfacesById);
  const surfaces = surfaceIds
    .map((surfaceId) => surfacesById[surfaceId])
    .filter((surface): surface is StoredSurface => Boolean(surface));

  useEffect(() => {
    replaceLane(lane, initialSurfaces);
  }, [initialSurfaces, lane, replaceLane]);

  const refreshLane = async () => {
    const response = await fetch(`/api/surfaces?lane=${lane}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const nextSurfaces = (await response.json()) as StoredSurface[];
    startTransition(() => {
      replaceLane(lane, nextSurfaces);
    });
  };

  useStream((event) => {
    if (event.type === "action.progress") {
      return;
    }
    void refreshLane();
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
        <SurfaceList surfaces={surfaces} emptyMessage={emptyMessage} />
      ) : (
        <div className="md:grid md:grid-cols-[360px_1fr]">
          <div className="md:overflow-y-auto md:max-h-[calc(100dvh-73px)] md:border-r md:border-border">
            <SurfaceList
              surfaces={surfaces}
              emptyMessage={emptyMessage}
              selectedSurfaceId={selectedSurface?.id}
              onSelectSurface={handleSelectSurface}
              laneRoute={pathname}
            />
          </div>

          <div className="hidden md:block">
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
