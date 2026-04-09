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
      openclawProfile: "default",
      updatedAt: new Date().toISOString(),
    });

    const resolved = await resolveVerifyWorkspace(repoRoot, "auto");
    assert.equal(resolved, expected);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("resolveVerifyWorkspace falls back to the selected profile workspace when the cache is for another profile", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-state-"));

  try {
    await writeLastBootstrapState(repoRoot, {
      workspace: path.join(repoRoot, "workspace-b"),
      mode: "live",
      openclawProfile: "profile-b",
      updatedAt: new Date().toISOString(),
    });

    const expected = path.join(repoRoot, "workspace-a");
    const resolved = await resolveVerifyWorkspace(
      repoRoot,
      "auto",
      { profile: "profile-a" },
      async () => expected
    );

    assert.equal(resolved, expected);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("resolveVerifyWorkspace ignores legacy bootstrap state without a recorded profile", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-state-"));

  try {
    await writeLastBootstrapState(repoRoot, {
      workspace: path.join(repoRoot, "legacy-workspace"),
      mode: "live",
      updatedAt: new Date().toISOString(),
    });

    const expected = path.join(repoRoot, "active-profile-workspace");
    const resolved = await resolveVerifyWorkspace(
      repoRoot,
      "auto",
      { profile: "profile-a" },
      async () => expected
    );

    assert.equal(resolved, expected);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("resolveVerifyWorkspace reuses legacy bootstrap state for the default profile", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-state-"));

  try {
    const legacyWorkspace = path.join(repoRoot, "legacy-workspace");
    await writeLastBootstrapState(repoRoot, {
      workspace: legacyWorkspace,
      mode: "live",
      updatedAt: new Date().toISOString(),
    });

    const resolved = await resolveVerifyWorkspace(
      repoRoot,
      "auto",
      {},
      async () => path.join(repoRoot, "active-profile-workspace")
    );

    assert.equal(resolved, legacyWorkspace);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("resolveVerifyWorkspace keeps --dev distinct from a literal dev profile", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-state-"));

  try {
    await writeLastBootstrapState(repoRoot, {
      workspace: path.join(repoRoot, "workspace-dev-mode"),
      mode: "live",
      openclawProfile: "dev",
      openclawContext: { dev: true },
      updatedAt: new Date().toISOString(),
    });

    const resolved = await resolveVerifyWorkspace(
      repoRoot,
      "auto",
      { profile: "dev" },
      async () => path.join(repoRoot, "workspace-profile-dev")
    );

    assert.equal(resolved, path.join(repoRoot, "workspace-profile-dev"));
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
