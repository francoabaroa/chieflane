import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { surfaceEnvelopeSchema } from "@chieflane/surface-schema";
import { resetDb } from "./index";
import {
  closeSurface,
  createActionRun,
  getAllSurfaces,
  getTotalSurfaceCount,
  getUserSurfaceCount,
  getSurfaceByKey,
  getSurfaceById,
  getSurfacesByLane,
  patchSurface,
  upsertSurfaceByKey,
  updateActionRun,
} from "./surfaces";

function createTempDbPath() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "chieflane-test-")),
    "chieflane.db"
  );
}

test.afterEach(() => {
  resetDb();
  delete process.env.DATABASE_PATH;
});

test("surface persistence stores blocks, patches, and close state", () => {
  process.env.DATABASE_PATH = createTempDbPath();

  const surface = upsertSurfaceByKey(
    surfaceEnvelopeSchema.parse({
      surfaceKey: "digest:kaizen:2026-w15",
      lane: "ops",
      title: "Kaizen Digest",
      summary: "Two repeat issues need decisions.",
      payload: {
        surfaceType: "digest",
        data: {
          summary: "Friction is recurring in the draft approval flow.",
          sections: [
            {
              title: "Issue",
              body: "Drafts keep stalling at final approval.",
              tone: "warn",
            },
          ],
        },
      },
      actions: [
        {
          id: "apply",
          kind: "agent",
          label: "Apply",
          actionKey: "apply_kaizen",
        },
      ],
      blocks: {
        type: "StatusBanner",
        props: {
          message: "2 improvements await review.",
          tone: "warn",
        },
      },
      fallbackText: "Kaizen Digest: 2 improvements await review.",
      freshness: {
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    })
  );

  const firstAction = surface.actions[0];
  assert.equal(firstAction?.kind, "agent");
  if (firstAction?.kind === "agent") {
    assert.deepEqual(firstAction.input, {});
  }
  assert.deepEqual(surface.blocks, {
    type: "StatusBanner",
    props: {
      message: "2 improvements await review.",
      tone: "warn",
    },
  });

  const patched = patchSurface(surface.surfaceKey, {
    status: "awaiting_review",
    blocks: {
      type: "TextBlock",
      props: { content: "Awaiting your decision." },
    },
  });

  assert.equal(patched.status, "awaiting_review");
  assert.deepEqual(patched.blocks, {
    type: "TextBlock",
    props: { content: "Awaiting your decision." },
  });

  const closed = closeSurface(surface.surfaceKey, "done");
  assert.equal(closed.status, "done");
  assert.ok(closed.archivedAt);

  const loaded = getSurfaceById(surface.id);
  assert.equal(loaded?.status, "done");
  assert.equal(getSurfaceByKey(surface.surfaceKey)?.id, surface.id);
});

test("action runs can be created and completed", () => {
  process.env.DATABASE_PATH = createTempDbPath();

  const surface = upsertSurfaceByKey(
    surfaceEnvelopeSchema.parse({
      surfaceKey: "brief:morning:2026-04-08",
      lane: "today",
      title: "Morning Brief",
      summary: "Three meetings and two follow-ups.",
      payload: {
        surfaceType: "brief",
        data: {
          headline: "Protect the afternoon.",
          sections: [
            {
              title: "Priorities",
              body: "Board deck and follow-ups.",
              tone: "critical",
            },
          ],
        },
      },
      fallbackText: "Morning Brief: 3 meetings.",
      freshness: {
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    })
  );

  const actionRunId = createActionRun({
    surfaceId: surface.id,
    actionId: "refresh",
    actionKey: "refresh_surface",
  });

  updateActionRun({
    id: actionRunId,
    status: "completed",
    output: { transcript: "Refreshed." },
  });

  assert.ok(actionRunId);
});

test("lane and global queries exclude closed surfaces", () => {
  process.env.DATABASE_PATH = createTempDbPath();

  const openSurface = upsertSurfaceByKey(
    surfaceEnvelopeSchema.parse({
      surfaceKey: "brief:open:2026-04-08",
      lane: "today",
      title: "Open Surface",
      summary: "Should still be visible.",
      payload: {
        surfaceType: "brief",
        data: {
          headline: "Stay visible",
          sections: [],
        },
      },
      fallbackText: "Open Surface",
      freshness: {
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    })
  );

  const doneSurface = upsertSurfaceByKey(
    surfaceEnvelopeSchema.parse({
      surfaceKey: "brief:done:2026-04-08",
      lane: "today",
      title: "Done Surface",
      summary: "Should be hidden once done.",
      payload: {
        surfaceType: "brief",
        data: {
          headline: "Hide me",
          sections: [],
        },
      },
      fallbackText: "Done Surface",
      freshness: {
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    })
  );

  const archivedSurface = upsertSurfaceByKey(
    surfaceEnvelopeSchema.parse({
      surfaceKey: "brief:archived:2026-04-08",
      lane: "today",
      title: "Archived Surface",
      summary: "Should stay hidden when archived.",
      payload: {
        surfaceType: "brief",
        data: {
          headline: "Archive me",
          sections: [],
        },
      },
      fallbackText: "Archived Surface",
      freshness: {
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    })
  );

  closeSurface(doneSurface.surfaceKey, "done");
  closeSurface(archivedSurface.surfaceKey, "archived");

  assert.deepEqual(
    getSurfacesByLane("today").map((surface) => surface.id),
    [openSurface.id]
  );
  assert.deepEqual(
    getAllSurfaces().map((surface) => surface.id),
    [openSurface.id]
  );
  assert.equal(getTotalSurfaceCount(), 3);
  assert.equal(getUserSurfaceCount(), 3);
});

test("user surface count excludes verification surfaces", () => {
  process.env.DATABASE_PATH = createTempDbPath();

  const verifySurface = upsertSurfaceByKey(
    surfaceEnvelopeSchema.parse({
      surfaceKey: "verify:chieflane:2026-04-10",
      lane: "ops",
      title: "Verify Surface",
      summary: "Should not count as first-run history.",
      payload: {
        surfaceType: "brief",
        data: {
          headline: "Verify",
          sections: [],
        },
      },
      fallbackText: "Verify Surface",
      freshness: {
        generatedAt: "2026-04-10T09:00:00.000Z",
      },
    })
  );
  closeSurface(verifySurface.surfaceKey, "archived");

  assert.equal(getAllSurfaces().length, 0);
  assert.equal(getTotalSurfaceCount(), 1);
  assert.equal(getUserSurfaceCount(), 0);
});
