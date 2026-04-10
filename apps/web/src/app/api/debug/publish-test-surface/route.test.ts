import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "./route";

const originalFetch = global.fetch;

test.afterEach(() => {
  delete process.env.SHELL_APP_PASSWORD;
  delete process.env.SHELL_INTERNAL_API_KEY;
  delete process.env.OPENCLAW_GATEWAY_URL;
  delete process.env.OPENCLAW_GATEWAY_TOKEN;
  global.fetch = originalFetch;
});

test("debug publish rejects remote unauthenticated requests when app auth is disabled", async () => {
  const response = await POST(
    new NextRequest("https://shell.example.com/api/debug/publish-test-surface", {
      method: "POST",
      body: JSON.stringify({ lane: "today" }),
      headers: {
        "content-type": "application/json",
      },
    })
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "unauthorized",
  });
});

test("debug publish allows authenticated app sessions", async () => {
  process.env.SHELL_APP_PASSWORD = "secret";
  process.env.OPENCLAW_GATEWAY_URL = "https://gateway.example.com";
  process.env.OPENCLAW_GATEWAY_TOKEN = "gateway-token";
  global.fetch = (async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })) as typeof fetch;

  const response = await POST(
    new NextRequest("https://shell.example.com/api/debug/publish-test-surface", {
      method: "POST",
      body: JSON.stringify({ lane: "today" }),
      headers: {
        "content-type": "application/json",
        cookie: "chieflane_session=chieflane:secret:session",
      },
    })
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok?: boolean; surfaceKey?: string };
  assert.equal(body.ok, true);
  assert.match(body.surfaceKey ?? "", /^demo:welcome:/);
});
