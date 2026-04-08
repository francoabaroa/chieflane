import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { surfaceEnvelopeSchema } from "@chieflane/surface-schema";
import { subscribe } from "@/lib/realtime";
import { resetDb } from "@/lib/db";
import { getSurfaceById, upsertSurfaceByKey } from "@/lib/db/surfaces";
import { getActionDefinition } from "./registry";

function createTempDbPath() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "chieflane-actions-")),
    "chieflane.db"
  );
}

test.afterEach(() => {
  resetDb();
  delete process.env.DATABASE_PATH;
});

test("set_status done closes the surface and emits surface.closed", async () => {
  process.env.DATABASE_PATH = createTempDbPath();

  const surface = upsertSurfaceByKey(
    surfaceEnvelopeSchema.parse({
      surfaceKey: "brief:action-test:2026-04-08",
      lane: "today",
      title: "Action Test",
      summary: "Verify done behavior.",
      payload: {
        surfaceType: "brief",
        data: {
          headline: "Action test",
          sections: [],
        },
      },
      actions: [],
      fallbackText: "Action test",
      freshness: {
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    })
  );

  const definition = getActionDefinition("set_status");
  assert.ok(definition);
  assert.equal(definition?.kind, "shell");
  if (!definition || definition.kind !== "shell") {
    throw new Error("set_status definition missing");
  }

  let eventType: string | null = null;
  const unsubscribe = subscribe((event) => {
    if (event.surfaceId === surface.id) {
      eventType = event.type;
    }
  });

  try {
    await definition.handler({
      surface,
      input: { status: "done" },
    });
  } finally {
    unsubscribe();
  }

  assert.equal(eventType, "surface.closed");
  assert.equal(getSurfaceById(surface.id)?.status, "done");
});
