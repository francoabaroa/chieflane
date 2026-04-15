import test from "node:test";
import assert from "node:assert/strict";
import type { StoredSurface } from "@chieflane/surface-schema";
import { isVisibleLaneSurface } from "./visibility";

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
    entityRefs: [],
    sourceRefs: [],
    freshness: { generatedAt: "2026-04-14T12:00:00.000Z" },
    meta: {},
    version: 1,
    createdAt: "2026-04-14T12:00:00.000Z",
    updatedAt: "2026-04-14T12:00:00.000Z",
    ...overrides,
  };
}

test("isVisibleLaneSurface excludes surfaces that moved lanes", () => {
  assert.equal(
    isVisibleLaneSurface(makeSurface({ lane: "inbox" }), "today"),
    false
  );
});

test("isVisibleLaneSurface excludes closed surfaces", () => {
  assert.equal(
    isVisibleLaneSurface(makeSurface({ status: "done" }), "today"),
    false
  );
  assert.equal(
    isVisibleLaneSurface(makeSurface({ status: "archived" }), "today"),
    false
  );
});

test("isVisibleLaneSurface includes open surfaces in the lane", () => {
  assert.equal(isVisibleLaneSurface(makeSurface(), "today"), true);
});
