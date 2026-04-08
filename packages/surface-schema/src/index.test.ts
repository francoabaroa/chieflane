import test from "node:test";
import assert from "node:assert/strict";
import {
  surfaceEnvelopeSchema,
  surfacePatchRequestSchema,
} from "./index";

test("surface envelope accepts blocks and action defaults", () => {
  const parsed = surfaceEnvelopeSchema.parse({
    surfaceKey: "brief:morning:2026-04-08",
    lane: "today",
    title: "Morning Brief",
    summary: "Calendar is heavy this morning.",
    payload: {
      surfaceType: "brief",
      data: {
        headline: "Protect the afternoon for deep work.",
        sections: [{ title: "Calendar", body: "3 meetings", tone: "warn" }],
      },
    },
    actions: [
      {
        id: "refresh",
        kind: "agent",
        label: "Refresh",
        actionKey: "refresh_surface",
      },
    ],
    blocks: {
      type: "SectionCard",
      props: { title: "Notes", tone: "neutral" },
      children: [{ type: "TextBlock", props: { content: "Fresh summary." } }],
    },
    fallbackText: "Morning Brief: 3 meetings.",
    freshness: {
      generatedAt: "2026-04-08T09:00:00.000Z",
    },
  });

  assert.equal(parsed.status, "ready");
  const firstAction = parsed.actions[0];
  assert.equal(firstAction?.kind, "agent");
  if (firstAction?.kind === "agent") {
    assert.deepEqual(firstAction.input, {});
  }
  assert.ok(parsed.blocks);
});

test("surface patch request rejects empty patches", () => {
  const parsed = surfacePatchRequestSchema.safeParse({
    surfaceKey: "brief:morning:2026-04-08",
    patch: {},
  });

  assert.equal(parsed.success, false);
});

test("surface schema rejects unsupported mutation kinds", () => {
  const parsed = surfaceEnvelopeSchema.safeParse({
    surfaceKey: "brief:morning:2026-04-08",
    lane: "today",
    title: "Morning Brief",
    summary: "Calendar is heavy this morning.",
    payload: {
      surfaceType: "brief",
      data: {
        headline: "Protect the afternoon for deep work.",
        sections: [{ title: "Calendar", body: "3 meetings", tone: "warn" }],
      },
    },
    actions: [
      {
        id: "pin",
        kind: "mutation",
        label: "Pin",
        mutation: "pin",
      },
    ],
    fallbackText: "Morning Brief: 3 meetings.",
    freshness: {
      generatedAt: "2026-04-08T09:00:00.000Z",
    },
  });

  assert.equal(parsed.success, false);
});
