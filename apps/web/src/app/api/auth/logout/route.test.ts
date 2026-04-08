import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route";

const env = process.env as Record<string, string | undefined>;

test.afterEach(() => {
  delete env.NODE_ENV;
});

test("logout POST clears the auth cookie with matching attributes", async () => {
  env.NODE_ENV = "production";

  const response = await POST();
  const setCookie = response.headers.get("set-cookie");

  assert.ok(setCookie);
  assert.match(setCookie, /chieflane_session=/);
  assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /Path=\//i);
});
