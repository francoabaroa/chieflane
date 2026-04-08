import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "./route";

test.afterEach(() => {
  delete process.env.SHELL_INTERNAL_API_KEY;
});

test("surface patch POST rejects malformed JSON with a 400", async () => {
  process.env.SHELL_INTERNAL_API_KEY = "test-key";

  const response = await POST(
    new NextRequest("http://localhost/api/internal/surfaces/patch", {
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
