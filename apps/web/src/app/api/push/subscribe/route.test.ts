import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "./route";

test("push subscribe POST rejects malformed JSON with a 400", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/push/subscribe", {
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
