"use client";

import type { SurfaceAction } from "@chieflane/surface-schema";
import { getActionKey } from "./key";

export async function runSurfaceAction(
  surfaceId: string,
  action: SurfaceAction,
  blockInput?: Record<string, unknown>
) {
  if (action.kind === "navigate") {
    return { ok: true };
  }

  const actionKey = getActionKey(action);
  if (!actionKey) {
    throw new Error("Unsupported action");
  }

  const response = await fetch("/api/actions/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surfaceId,
      actionId: action.id,
      actionKey,
      ...(blockInput ? { blockInput } : {}),
    }),
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    message?: string;
  };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? "Action failed");
  }

  return payload;
}
