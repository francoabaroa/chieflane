"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Lane, StoredSurface } from "@chieflane/surface-schema";

type SurfaceStore = {
  surfacesById: Record<string, StoredSurface>;
  laneSurfaceIds: Record<Lane, string[]>;
  replaceLane: (lane: Lane, surfaces: StoredSurface[]) => void;
  upsertSurface: (surface: StoredSurface) => void;
  removeSurface: (surfaceId: string) => void;
};

const EMPTY_LANES: Record<Lane, string[]> = {
  today: [],
  inbox: [],
  meetings: [],
  drafts: [],
  people: [],
  research: [],
  ops: [],
};

export const useSurfaceStore = create<SurfaceStore>()(
  persist(
    (set) => ({
      surfacesById: {},
      laneSurfaceIds: EMPTY_LANES,

      replaceLane: (lane, surfaces) =>
        set((state) => {
          const nextSurfacesById = { ...state.surfacesById };
          const previousIds = state.laneSurfaceIds[lane] ?? [];
          const nextIds = surfaces.map((surface) => surface.id);

          for (const previousId of previousIds) {
            if (!nextIds.includes(previousId)) {
              delete nextSurfacesById[previousId];
            }
          }

          for (const surface of surfaces) {
            nextSurfacesById[surface.id] = surface;
          }

          return {
            surfacesById: nextSurfacesById,
            laneSurfaceIds: {
              ...state.laneSurfaceIds,
              [lane]: nextIds,
            },
          };
        }),

      upsertSurface: (surface) =>
        set((state) => {
          const laneSurfaceIds = Object.fromEntries(
            Object.entries(state.laneSurfaceIds).map(([lane, ids]) => [
              lane,
              ids.filter((id) => id !== surface.id),
            ])
          ) as Record<Lane, string[]>;

          laneSurfaceIds[surface.lane] = [
            surface.id,
            ...laneSurfaceIds[surface.lane],
          ].sort((leftId, rightId) => {
            const left =
              leftId === surface.id
                ? surface
                : state.surfacesById[leftId];
            const right =
              rightId === surface.id
                ? surface
                : state.surfacesById[rightId];

            if (!left || !right) {
              return 0;
            }

            if (right.priority !== left.priority) {
              return right.priority - left.priority;
            }

            return (
              new Date(right.updatedAt).getTime() -
              new Date(left.updatedAt).getTime()
            );
          });

          return {
            surfacesById: {
              ...state.surfacesById,
              [surface.id]: surface,
            },
            laneSurfaceIds,
          };
        }),

      removeSurface: (surfaceId) =>
        set((state) => {
          const nextSurfacesById = { ...state.surfacesById };
          delete nextSurfacesById[surfaceId];

          const laneSurfaceIds = Object.fromEntries(
            Object.entries(state.laneSurfaceIds).map(([lane, ids]) => [
              lane,
              ids.filter((id) => id !== surfaceId),
            ])
          ) as Record<Lane, string[]>;

          return {
            surfacesById: nextSurfacesById,
            laneSurfaceIds,
          };
        }),
    }),
    {
      name: "chieflane-surface-cache-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        surfacesById: state.surfacesById,
        laneSurfaceIds: state.laneSurfaceIds,
      }),
    }
  )
);
