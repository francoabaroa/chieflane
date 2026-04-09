import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getDbEnvPaths } from "./init";

test("getDbEnvPaths prefers the repo-root .env before the cwd .env", () => {
  const envPaths = getDbEnvPaths();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const expectedRepoRootEnvPath = path.resolve(moduleDir, "../../../../../.env");

  assert.equal(envPaths[0], expectedRepoRootEnvPath);
  assert.ok(envPaths.includes(path.resolve(process.cwd(), ".env")));
});
