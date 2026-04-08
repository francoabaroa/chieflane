import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getSafePostLoginRedirect } from "@/lib/auth/redirect";
import { POST } from "./route";

test.afterEach(() => {
  delete process.env.SHELL_APP_PASSWORD;
});

test("getSafePostLoginRedirect rejects protocol-relative URLs", () => {
  assert.equal(getSafePostLoginRedirect("//evil.example"), "/today");
  assert.equal(getSafePostLoginRedirect("/surface/123"), "/surface/123");
});

test("login POST falls back to /today for protocol-relative redirects", async () => {
  process.env.SHELL_APP_PASSWORD = "secret";

  const response = await POST(
    new NextRequest("http://localhost/api/auth/login?next=//evil.example", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "secret" }),
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    redirectTo: "/today",
  });
});
