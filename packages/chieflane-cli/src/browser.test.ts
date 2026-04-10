import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { browserCheck } from "./browser";

async function withServer(
  handler: http.RequestListener,
  run: (url: string) => Promise<void>
) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("Server address unavailable");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test("browserCheck validates the Chieflane health payload", async () => {
  await withServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "other-app" }));
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html></html>");
  }, async (url) => {
    const result = await browserCheck(url);
    assert.equal(result.rootOk, true);
    assert.equal(result.healthStatus, 200);
    assert.equal(result.healthPayloadOk, false);
    assert.equal(result.healthOk, false);
  });
});

test("browserCheck resolves the health URL from the shell URL", async () => {
  const targets: string[] = [];

  await withServer((req, res) => {
    const target = `http://127.0.0.1:${(res.socket as typeof res.socket & { localPort: number }).localPort}${req.url ?? ""}`;
    targets.push(target);
    if (req.url === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "chieflane" }));
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html></html>");
  }, async (url) => {
    const result = await browserCheck(`${url}/?tenant=a#shell`);
    assert.equal(result.rootOk, true);
    assert.equal(result.healthOk, true);
    assert.deepEqual(targets, [`${url}/?tenant=a`, `${url}/api/health`]);
  });
});

test("browserCheck follows root redirects before deciding the shell is unhealthy", async () => {
  await withServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(307, { location: "/today" });
      res.end();
      return;
    }

    if (req.url === "/today") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html></html>");
      return;
    }

    if (req.url === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "chieflane" }));
      return;
    }

    res.writeHead(404);
    res.end();
  }, async (url) => {
    const result = await browserCheck(url);
    assert.equal(result.rootOk, true);
    assert.equal(result.rootStatus, 200);
    assert.equal(result.healthOk, true);
  });
});

test("browserCheck treats non-JSON health bodies as unhealthy instead of throwing", async () => {
  await withServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(502, { "content-type": "text/html" });
      res.end("<html>bad gateway</html>");
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html></html>");
  }, async (url) => {
    const result = await browserCheck(url);
    assert.equal(result.rootOk, true);
    assert.equal(result.healthStatus, 502);
    assert.equal(result.healthPayloadOk, false);
    assert.equal(result.healthOk, false);
  });
});
