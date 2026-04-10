import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "./route";

test.afterEach(() => {
  delete process.env.SHELL_INTERNAL_API_KEY;
});

test("surface by-key GET requires internal auth", async () => {
  process.env.SHELL_INTERNAL_API_KEY = "test-key";

  const response = await GET(
    new NextRequest("http://localhost/api/internal/surfaces/by-key?surfaceKey=demo")
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "unauthorized",
  });
});

test("surface by-key GET requires a surfaceKey param", async () => {
  process.env.SHELL_INTERNAL_API_KEY = "test-key";

  const response = await GET(
    new NextRequest("http://localhost/api/internal/surfaces/by-key", {
      headers: {
        authorization: "Bearer test-key",
      },
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "surfaceKey is required",
  });
});
