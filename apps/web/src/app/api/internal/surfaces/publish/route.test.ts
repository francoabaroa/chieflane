import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "./route";

test.afterEach(() => {
  delete process.env.SHELL_INTERNAL_API_KEY;
});

test("surface publish POST rejects malformed JSON with a 400", async () => {
  process.env.SHELL_INTERNAL_API_KEY = "test-key";

  const response = await POST(
    new NextRequest("http://localhost/api/internal/surfaces/publish", {
      method: "POST",
      headers: {
        authorization: "Bearer test-key",
        "content-type": "application/json",
      },
      body: "{",
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Invalid JSON body",
  });
});

test("surface publish POST returns a targeted validation error", async () => {
  process.env.SHELL_INTERNAL_API_KEY = "test-key";

  const response = await POST(
    new NextRequest("http://localhost/api/internal/surfaces/publish", {
      method: "POST",
      headers: {
        authorization: "Bearer test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        surfaceKey: "brief:test",
        lane: "today",
        title: "Broken brief",
        summary: "Missing payload shape.",
        payload: "brief",
        fallbackText: "Broken brief",
        freshness: {
          generatedAt: "2026-04-10T09:00:00.000Z",
        },
      }),
    })
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /Invalid surface_publish payload/);
  assert.match(body.error, /payload must be an object/);
});
