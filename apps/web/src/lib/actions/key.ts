import type { SurfaceAction } from "@chieflane/surface-schema";

export function getActionKey(action: SurfaceAction) {
  if (action.kind === "agent") {
    return action.actionKey;
  }

  if (action.kind === "mutation") {
    return action.mutation === "archive" ? "archive_surface" : action.mutation;
  }

  return null;
}
