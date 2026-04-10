import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "./route";

test.afterEach(() => {
  delete process.env.SHELL_APP_PASSWORD;
  delete process.env.SHELL_INTERNAL_API_KEY;
});

test("setup-status rejects remote unauthenticated requests when app auth is disabled", async () => {
  const response = await GET(
    new NextRequest("https://shell.example.com/api/debug/setup-status")
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "unauthorized",
  });
});
