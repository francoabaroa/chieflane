import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { isPublicPath, middleware } from "./middleware";

test("isPublicPath treats /api/health as public", () => {
  assert.equal(isPublicPath("/api/health"), true);
});

test("middleware allows /api/health without an app session", () => {
  process.env.SHELL_APP_PASSWORD = "secret";

  const response = middleware(new NextRequest("http://localhost:3000/api/health"));

  assert.notEqual(response.status, 401);
  assert.equal(response.headers.get("x-chieflane-cache-scope"), "public");
});
