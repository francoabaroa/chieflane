import test from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, formatRelativeTime } from "@chieflane/shared";

test("formatRelativeTime returns a fallback for invalid dates", () => {
  assert.equal(formatRelativeTime("not-a-date"), "unknown time");
});

test("formatDateTime returns a fallback for invalid dates", () => {
  assert.equal(formatDateTime("not-a-date"), "Unknown date");
});
