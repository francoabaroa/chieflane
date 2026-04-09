import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildOpenClawArgs,
  defaultWorkspacePath,
  getOpenClawContextKey,
  getOpenClawProfileLabel,
  primeOpenClawInvocationContext,
  resolveOpenClawInvocationContext,
  setOpenClawInvocationContext,
} from "./openclaw";

test("buildOpenClawArgs prepends --profile", () => {
  assert.deepEqual(
    buildOpenClawArgs(["gateway", "status"], { profile: "chieflane" }),
    ["--profile", "chieflane", "gateway", "status"]
  );
});

test("buildOpenClawArgs prepends --dev", () => {
  assert.deepEqual(buildOpenClawArgs(["status"], { dev: true }), ["--dev", "status"]);
});

test("getOpenClawContextKey keeps --dev distinct from a literal dev profile", () => {
  assert.equal(getOpenClawContextKey({ dev: true }), "dev-mode");
  assert.equal(getOpenClawContextKey({ profile: "dev" }), "dev");
});

test("defaultWorkspacePath respects the current invocation context", () => {
  setOpenClawInvocationContext({ profile: "work" });

  try {
    assert.equal(
      defaultWorkspacePath(),
      path.join(os.homedir(), ".openclaw", "workspace-work")
    );
  } finally {
    setOpenClawInvocationContext({});
  }
});

test("resolveOpenClawInvocationContext falls back to OPENCLAW_PROFILE", () => {
  const previous = process.env.OPENCLAW_PROFILE;
  process.env.OPENCLAW_PROFILE = "work";

  try {
    assert.deepEqual(resolveOpenClawInvocationContext({}), { profile: "work" });
    assert.equal(getOpenClawProfileLabel({}), "work");
  } finally {
    if (previous == null) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = previous;
    }
  }
});

test("primeOpenClawInvocationContext loads repo env before resolving the profile", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-openclaw-"));
  const previous = process.env.OPENCLAW_PROFILE;

  try {
    await fs.writeFile(path.join(repoRoot, ".env.local"), "OPENCLAW_PROFILE=work\n", "utf8");
    const context = primeOpenClawInvocationContext({ repoRoot });
    assert.deepEqual(context, { profile: "work" });
  } finally {
    if (previous == null) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = previous;
    }
    setOpenClawInvocationContext({});
    await fs.remove(repoRoot);
  }
});

test(".env.local overrides .env for OPENCLAW_PROFILE", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-openclaw-"));
  const previous = process.env.OPENCLAW_PROFILE;

  try {
    await fs.writeFile(path.join(repoRoot, ".env"), "OPENCLAW_PROFILE=shared\n", "utf8");
    await fs.writeFile(path.join(repoRoot, ".env.local"), "OPENCLAW_PROFILE=local\n", "utf8");

    const context = primeOpenClawInvocationContext({ repoRoot });
    assert.deepEqual(context, { profile: "local" });
  } finally {
    if (previous == null) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = previous;
    }
    setOpenClawInvocationContext({});
    await fs.remove(repoRoot);
  }
});

test("primeOpenClawInvocationContext falls back to the last bootstrapped profile", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-openclaw-"));
  const previous = process.env.OPENCLAW_PROFILE;
  delete process.env.OPENCLAW_PROFILE;

  try {
    await fs.ensureDir(path.join(repoRoot, ".chieflane"));
    await fs.writeJson(path.join(repoRoot, ".chieflane", "last-bootstrap.json"), {
      workspace: "/tmp/workspace",
      mode: "live",
      openclawProfile: "chieflane",
      updatedAt: new Date().toISOString(),
    });

    const context = primeOpenClawInvocationContext({ repoRoot });
    assert.deepEqual(context, { profile: "chieflane" });
  } finally {
    if (previous == null) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = previous;
    }
    setOpenClawInvocationContext({});
    await fs.remove(repoRoot);
  }
});

test("primeOpenClawInvocationContext falls back to the last bootstrapped dev context", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-openclaw-"));
  const previous = process.env.OPENCLAW_PROFILE;
  delete process.env.OPENCLAW_PROFILE;

  try {
    await fs.ensureDir(path.join(repoRoot, ".chieflane"));
    await fs.writeJson(path.join(repoRoot, ".chieflane", "last-bootstrap.json"), {
      workspace: "/tmp/workspace",
      mode: "live",
      openclawProfile: "dev",
      openclawContext: { dev: true },
      updatedAt: new Date().toISOString(),
    });

    const context = primeOpenClawInvocationContext({ repoRoot });
    assert.deepEqual(context, { dev: true });
  } finally {
    if (previous == null) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = previous;
    }
    setOpenClawInvocationContext({});
    await fs.remove(repoRoot);
  }
});

test("primeOpenClawInvocationContext preserves a literal dev profile from legacy state", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-openclaw-"));
  const previous = process.env.OPENCLAW_PROFILE;
  delete process.env.OPENCLAW_PROFILE;

  try {
    await fs.ensureDir(path.join(repoRoot, ".chieflane"));
    await fs.writeJson(path.join(repoRoot, ".chieflane", "last-bootstrap.json"), {
      workspace: "/tmp/workspace",
      mode: "live",
      openclawProfile: "dev",
      updatedAt: new Date().toISOString(),
    });

    const context = primeOpenClawInvocationContext({ repoRoot });
    assert.deepEqual(context, { profile: "dev" });
  } finally {
    if (previous == null) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = previous;
    }
    setOpenClawInvocationContext({});
    await fs.remove(repoRoot);
  }
});

test("primeOpenClawInvocationContext rejects --dev with --profile before resolving context", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-openclaw-"));

  try {
    assert.throws(
      () =>
        primeOpenClawInvocationContext({
          repoRoot,
          profile: "prod",
          dev: true,
        }),
      /either --dev or --profile/
    );
  } finally {
    setOpenClawInvocationContext({});
    await fs.remove(repoRoot);
  }
});
