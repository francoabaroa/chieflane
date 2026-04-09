import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("health GET returns ok", async () => {
  const response = await GET();
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "chieflane");
});
