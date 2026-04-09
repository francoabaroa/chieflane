import assert from "node:assert/strict";
import test from "node:test";
import { browserCheck } from "./browser";

function makeJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

test("browserCheck validates the Chieflane health payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    if (target.endsWith("/api/health")) {
      return makeJsonResponse({ ok: true, service: "other-app" });
    }
    return makeJsonResponse("<html></html>");
  }) as typeof fetch;

  try {
    const result = await browserCheck("http://localhost:3000");
    assert.equal(result.rootOk, true);
    assert.equal(result.healthStatus, 200);
    assert.equal(result.healthPayloadOk, false);
    assert.equal(result.healthOk, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browserCheck resolves the health URL from the shell URL", async () => {
  const originalFetch = globalThis.fetch;
  const targets: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    targets.push(target);
    if (target === "http://localhost:3000/api/health") {
      return makeJsonResponse({ ok: true, service: "chieflane" });
    }
    return makeJsonResponse("<html></html>");
  }) as typeof fetch;

  try {
    const result = await browserCheck("http://localhost:3000/?tenant=a#shell");
    assert.equal(result.rootOk, true);
    assert.equal(result.healthOk, true);
    assert.deepEqual(targets, [
      "http://localhost:3000/?tenant=a#shell",
      "http://localhost:3000/api/health",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
