import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { requestJson } from "./http-client";

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

test("requestJson preserves non-JSON error bodies", async () => {
  await withServer((_req, res) => {
    res.writeHead(502, { "content-type": "text/html" });
    res.end("<html>bad gateway</html>");
  }, async (url) => {
    const response = await requestJson<Record<string, unknown>>(url);
    assert.equal(response.ok, false);
    assert.equal(response.status, 502);
    assert.equal(response.json, null);
    assert.match(response.text, /bad gateway/i);
    assert.match(response.parseError ?? "", /Unexpected token/i);
  });
});

test("requestJson follows 307 redirects for POST requests", async () => {
  await withServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(307, { location: "/target" });
      res.end();
      return;
    }

    if (req.url === "/target" && req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(Buffer.concat(chunks).toString("utf8"));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  }, async (url) => {
    const response = await requestJson<{ ok?: boolean }>(`${url}/redirect`, {
      method: "POST",
      body: { ok: true },
      followRedirects: true,
    });

    assert.equal(response.ok, true);
    assert.deepEqual(response.json, { ok: true });
  });
});
