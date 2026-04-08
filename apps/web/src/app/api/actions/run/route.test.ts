import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "./route";

test("action run POST rejects JSON null with a 400", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/actions/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "null",
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "surfaceId, actionId, and actionKey are required",
  });
});

test("action run POST rejects malformed JSON with a 400", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/actions/run", {
      method: "POST",
      headers: {
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
