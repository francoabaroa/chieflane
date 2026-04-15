import type { StoredSurface, SurfaceAction } from "@chieflane/surface-schema";
import { getActionKey } from "./key";

const QUICK_ACTION_IDS = new Set([
  "quick-complete-canonical",
  "quick-update-openclaw",
  "quick-mark-blocked",
  "quick-archive",
]);

function hasActionKey(actions: SurfaceAction[], actionKey: string) {
  return actions.some((action) => getActionKey(action) === actionKey);
}

function isOpenSurface(surface: StoredSurface) {
  return surface.status !== "done" && surface.status !== "archived";
}

function isTaskLikeSurface(surface: StoredSurface) {
  const surfaceType = surface.payload.surfaceType;

  return (
    surfaceType === "brief" ||
    surfaceType === "queue" ||
    surfaceType === "board" ||
    surfaceType === "prep" ||
    surfaceType === "debrief" ||
    surface.entityRefs.some((ref) =>
      ["task", "commitment", "linear", "todo"].includes(ref.type)
    ) ||
    surface.sourceRefs.some((ref) =>
      ["task", "linear", "github", "jira", "todo"].includes(ref.kind)
    ) ||
    typeof surface.meta.taskId === "string" ||
    typeof surface.meta.commitmentId === "string"
  );
}

export function getSyntheticSurfaceActions(
  surface: StoredSurface
): SurfaceAction[] {
  if (!isOpenSurface(surface)) {
    return [];
  }

  const actions: SurfaceAction[] = [];

  if (isTaskLikeSurface(surface)) {
    actions.push({
      id: "quick-complete-canonical",
      kind: "agent",
      label: "Complete",
      actionKey: "complete_surface_canonical",
      input: {},
      style: "primary",
    });

    actions.push({
      id: "quick-update-openclaw",
      kind: "agent",
      label: "Update",
      actionKey: "message_openclaw_about_surface",
      input: {},
      inputSpec: {
        mode: "textarea",
        label: "Update",
        placeholder: "What changed?",
        submitLabel: "Send update",
        required: true,
        maxLength: 1000,
      },
      style: "secondary",
    });

    actions.push({
      id: "quick-mark-blocked",
      kind: "agent",
      label: "Blocked",
      actionKey: "mark_blocked_canonical",
      input: {},
      inputSpec: {
        mode: "textarea",
        label: "Blocker",
        placeholder: "What is blocking this?",
        submitLabel: "Mark blocked",
        required: true,
        maxLength: 1000,
      },
      style: "secondary",
    });
  }

  actions.push({
    id: "quick-archive",
    kind: "mutation",
    label: "Archive",
    mutation: "archive",
    input: {},
    style: "ghost",
  });

  return actions.filter((action) => {
    const actionKey = getActionKey(action);
    return actionKey ? !hasActionKey(surface.actions, actionKey) : true;
  });
}

export function getSurfaceActions(surface: StoredSurface): SurfaceAction[] {
  return [...surface.actions, ...getSyntheticSurfaceActions(surface)];
}

export function getQuickSurfaceActions(surface: StoredSurface): SurfaceAction[] {
  return getSurfaceActions(surface).filter((action) =>
    QUICK_ACTION_IDS.has(action.id)
  );
}
