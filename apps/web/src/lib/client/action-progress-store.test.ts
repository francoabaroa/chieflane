import test from "node:test";
import assert from "node:assert/strict";
import { useActionProgressStore } from "./action-progress-store";

test.afterEach(() => {
  useActionProgressStore.setState({ bySurfaceId: {} });
});

test("setProgress clears stale text when a new run starts without text", () => {
  useActionProgressStore.getState().setProgress("surface-1", {
    actionRunId: "run-1",
    actionKey: "refresh_surface",
    event: "failed",
    text: "Previous failure",
  });

  useActionProgressStore.getState().setProgress("surface-1", {
    actionRunId: "run-2",
    actionKey: "refresh_surface",
    event: "running",
  });

  assert.deepEqual(useActionProgressStore.getState().bySurfaceId["surface-1"], {
    actionRunId: "run-2",
    actionKey: "refresh_surface",
    event: "running",
    text: undefined,
    status: "running",
    updatedAt:
      useActionProgressStore.getState().bySurfaceId["surface-1"]?.updatedAt,
  });
});

test("setProgress keeps same-run text when a later progress event has no text", () => {
  useActionProgressStore.getState().setProgress("surface-1", {
    actionRunId: "run-1",
    actionKey: "refresh_surface",
    event: "message",
    text: "Working",
  });

  useActionProgressStore.getState().setProgress("surface-1", {
    actionRunId: "run-1",
    actionKey: "refresh_surface",
    event: "message",
  });

  assert.equal(
    useActionProgressStore.getState().bySurfaceId["surface-1"]?.text,
    "Working"
  );
});
