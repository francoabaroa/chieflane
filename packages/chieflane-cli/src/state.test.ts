import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeLastBootstrapState } from "./state";
import { resolveVerifyWorkspace } from "./verify";
import { defaultWorkspacePath, resolveWorkspacePath } from "./openclaw";

test("resolveVerifyWorkspace prefers the last bootstrapped workspace", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-state-"));

  try {
    const expected = path.join(repoRoot, "custom-workspace");
    await writeLastBootstrapState(repoRoot, {
      workspace: expected,
      mode: "live",
      updatedAt: new Date().toISOString(),
    });

    const resolved = await resolveVerifyWorkspace(repoRoot, "auto");
    assert.equal(resolved, expected);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("resolveVerifyWorkspace honors an explicit workspace path", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-state-"));

  try {
    const explicit = path.join(repoRoot, "explicit-workspace");
    const resolved = await resolveVerifyWorkspace(repoRoot, explicit);
    assert.equal(resolved, explicit);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("resolveWorkspacePath expands home-relative paths", () => {
  const resolved = resolveWorkspacePath("~/example-workspace");
  assert.equal(resolved, path.join(os.homedir(), "example-workspace"));
});

test("defaultWorkspacePath uses the active OPENCLAW_PROFILE fallback", () => {
  const previous = process.env.OPENCLAW_PROFILE;
  process.env.OPENCLAW_PROFILE = "work";

  try {
    assert.equal(
      defaultWorkspacePath(),
      path.join(os.homedir(), ".openclaw", "workspace-work")
    );
  } finally {
    if (previous == null) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = previous;
    }
  }
});
