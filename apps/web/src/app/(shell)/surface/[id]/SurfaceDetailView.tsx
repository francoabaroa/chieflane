"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StoredSurface } from "@chieflane/surface-schema";
import { useStream } from "@/hooks/useStream";
import { SurfaceDetailShell } from "@/components/shell/SurfaceDetailShell";
import { useSurfaceStore } from "@/lib/client/surface-store";
import { useActionProgressStore } from "@/lib/client/action-progress-store";

export function SurfaceDetailView({ surface }: { surface: StoredSurface }) {
  const router = useRouter();
  const upsertSurface = useSurfaceStore((state) => state.upsertSurface);
  const removeSurface = useSurfaceStore((state) => state.removeSurface);
  const setActionProgress = useActionProgressStore((state) => state.setProgress);
  const cachedSurface = useSurfaceStore(
    (state) => state.surfacesById[surface.id] ?? surface
  );

  useEffect(() => {
    upsertSurface(surface);
  }, [surface, upsertSurface]);

  useStream((event) => {
    if (event.surfaceId !== surface.id) {
      return;
    }

    if (event.type === "action.progress") {
      setActionProgress(event.surfaceId, event.data ?? {});
      return;
    }

    if (event.type === "surface.closed") {
      startTransition(() => {
        removeSurface(surface.id);
      });
      router.replace(`/${surface.lane}`);
      return;
    }

    if (event.data?.surface) {
      startTransition(() => {
        upsertSurface(event.data!.surface!);
      });
      return;
    }

    void (async () => {
      const response = await fetch(`/api/surfaces?id=${surface.id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextSurface = (await response.json()) as StoredSurface;
      startTransition(() => {
        upsertSurface(nextSurface);
      });
    })();
  });

  return <SurfaceDetailShell surface={cachedSurface} />;
}
