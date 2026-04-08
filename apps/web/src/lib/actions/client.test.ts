import test from "node:test";
import assert from "node:assert/strict";
import { getActionKey } from "./key";

test("getActionKey maps archive mutations to the shell registry key", () => {
  assert.equal(
    getActionKey({
      id: "archive",
      kind: "mutation",
      label: "Archive",
      mutation: "archive",
      input: {},
      style: "ghost",
    }),
    "archive_surface"
  );
});

test("getActionKey preserves non-archive mutation keys", () => {
  assert.equal(
    getActionKey({
      id: "dismiss",
      kind: "mutation",
      label: "Dismiss",
      mutation: "dismiss",
      input: {},
      style: "ghost",
    }),
    "dismiss"
  );
});
