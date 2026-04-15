import test from "node:test";
import assert from "node:assert/strict";
import type { StoredSurface } from "@chieflane/surface-schema";
import {
  getQuickSurfaceActions,
  getSurfaceActions,
} from "./surface-actions";

function makeSurface(overrides: Partial<StoredSurface> = {}): StoredSurface {
  return {
    id: "surface-1",
    surfaceKey: "task:linear:CHEF-1",
    lane: "today",
    status: "ready",
    priority: 80,
    title: "Task surface",
    summary: "A task that needs action.",
    payload: {
      surfaceType: "brief",
      data: {
        headline: "Task surface",
        sections: [],
        metrics: [],
      },
    },
    actions: [],
    fallbackText: "Task surface",
    entityRefs: [{ type: "task", id: "CHEF-1" }],
    sourceRefs: [{ kind: "linear", title: "Linear CHEF-1" }],
    freshness: { generatedAt: "2026-04-14T12:00:00.000Z" },
    meta: {},
    version: 1,
    createdAt: "2026-04-14T12:00:00.000Z",
    updatedAt: "2026-04-14T12:00:00.000Z",
    ...overrides,
  };
}

test("getQuickSurfaceActions adds canonical task actions and archive", () => {
  const actions = getQuickSurfaceActions(makeSurface());

  assert.deepEqual(
    actions.map((action) => action.id),
    [
      "quick-complete-canonical",
      "quick-update-openclaw",
      "quick-mark-blocked",
      "quick-archive",
    ]
  );
  assert.equal(actions[1]?.kind, "agent");
  assert.equal(actions[1]?.inputSpec?.required, true);
});

test("getSurfaceActions does not duplicate an existing canonical action", () => {
  const actions = getSurfaceActions(
    makeSurface({
      actions: [
        {
          id: "existing-complete",
          kind: "agent",
          label: "Finish",
          actionKey: "complete_surface_canonical",
          input: {},
          style: "primary",
        },
      ],
    })
  );

  assert.equal(
    actions.filter(
      (action) =>
        action.kind === "agent" &&
        action.actionKey === "complete_surface_canonical"
    ).length,
    1
  );
});
