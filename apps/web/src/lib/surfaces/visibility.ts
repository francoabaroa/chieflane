import type { Lane, StoredSurface } from "@chieflane/surface-schema";

export function isVisibleLaneSurface(surface: StoredSurface, lane: Lane) {
  return (
    surface.lane === lane &&
    surface.status !== "done" &&
    surface.status !== "archived"
  );
}
