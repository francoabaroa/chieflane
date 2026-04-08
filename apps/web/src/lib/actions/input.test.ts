import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_BLOCK_INPUT_KEY, resolveActionExecutionInput } from "./input";

test("resolveActionExecutionInput keeps persisted action input authoritative", () => {
  const input = resolveActionExecutionInput(
    {
      id: "mark-done",
      kind: "mutation",
      label: "Mark done",
      mutation: "set_status",
      input: { status: "done" },
      style: "primary",
    },
    {
      status: "archived",
      note: "operator override attempt",
    }
  );

  assert.deepEqual(input, {
    status: "done",
    [ACTION_BLOCK_INPUT_KEY]: {
      status: "archived",
      note: "operator override attempt",
    },
  });
});

test("resolveActionExecutionInput ignores malformed block input payloads", () => {
  const input = resolveActionExecutionInput(
    {
      id: "refresh",
      kind: "agent",
      label: "Refresh",
      actionKey: "refresh_surface",
      input: { scope: "surface" },
      style: "secondary",
    },
    "not-an-object"
  );

  assert.deepEqual(input, { scope: "surface" });
});
