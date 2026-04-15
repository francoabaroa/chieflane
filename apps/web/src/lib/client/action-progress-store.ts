"use client";

import { create } from "zustand";

export type SurfaceActionProgress = {
  actionRunId?: string;
  actionKey?: string;
  event?: string;
  text?: string;
  status: "running" | "completed" | "failed";
  updatedAt: string;
};

type ActionProgressStore = {
  bySurfaceId: Record<string, SurfaceActionProgress>;
  setProgress: (
    surfaceId: string,
    data: {
      actionRunId?: unknown;
      actionKey?: unknown;
      event?: unknown;
      text?: unknown;
    }
  ) => void;
  clearProgress: (surfaceId: string) => void;
};

function getProgressStatus(event: unknown): SurfaceActionProgress["status"] {
  if (event === "completed") {
    return "completed";
  }

  if (event === "failed") {
    return "failed";
  }

  return "running";
}

export const useActionProgressStore = create<ActionProgressStore>((set) => ({
  bySurfaceId: {},
  setProgress: (surfaceId, data) =>
    set((state) => {
      const previous = state.bySurfaceId[surfaceId];
      const event = typeof data.event === "string" ? data.event : undefined;
      const text = typeof data.text === "string" ? data.text : undefined;
      const actionRunId =
        typeof data.actionRunId === "string"
          ? data.actionRunId
          : previous?.actionRunId;
      const isNewRun = Boolean(
        actionRunId && actionRunId !== previous?.actionRunId
      );
      const status = getProgressStatus(event);

      return {
        bySurfaceId: {
          ...state.bySurfaceId,
          [surfaceId]: {
            actionRunId,
            actionKey:
              typeof data.actionKey === "string"
                ? data.actionKey
                : previous?.actionKey,
            event: event ?? previous?.event,
            text: text ?? (isNewRun ? undefined : previous?.text),
            status,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }),
  clearProgress: (surfaceId) =>
    set((state) => {
      const next = { ...state.bySurfaceId };
      delete next[surfaceId];
      return { bySurfaceId: next };
    }),
}));
