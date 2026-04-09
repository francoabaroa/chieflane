import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { findRepoRoot, loadManifest } from "./manifest";
import {
  classifyHeartbeat,
  mergeWorkspaceFiles,
  upsertManagedBlock,
} from "./merge";
import { createInstallReport } from "./report";

const repoRoot = findRepoRoot();

async function withFixture(
  name: string,
  run: (workspace: string) => Promise<void>
) {
  const source = path.join(repoRoot, "packages/chieflane-cli/fixtures", name);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-cli-"));
  await fs.copy(source, workspace, { overwrite: true });
  await fs.remove(path.join(workspace, ".keep"));

  try {
    await run(workspace);
  } finally {
    await fs.remove(workspace);
  }
}

test("upsertManagedBlock inserts and updates a managed block", () => {
  const inserted = upsertManagedBlock("alpha", "test", "beta");
  assert.match(inserted, /chieflane:start:test/);
  assert.match(inserted, /beta/);

  const updated = upsertManagedBlock(inserted, "test", "gamma");
  assert.match(updated, /gamma/);
  assert.equal(updated.match(/chieflane:start:test/g)?.length, 1);
});

test("classifyHeartbeat detects supported heartbeat shapes", () => {
  assert.equal(classifyHeartbeat(null), "missing");
  assert.equal(classifyHeartbeat(""), "empty");
  assert.equal(
    classifyHeartbeat("<!-- chieflane:start:heartbeat -->\nmanaged\n<!-- chieflane:end:heartbeat -->"),
    "managed"
  );
  assert.equal(classifyHeartbeat("tasks:\n  - review"), "yaml-tasks");
  assert.equal(classifyHeartbeat("- [ ] review"), "markdown-checklist");
  assert.equal(classifyHeartbeat("# dashboard"), "unknown");
});

test("AGENTS.md and TOOLS.md blocks are updated in place", async () => {
  const manifest = await loadManifest(repoRoot);

  await withFixture("workspace-existing-custom", async (workspace) => {
    const report = createInstallReport({ workspace, mode: "live" });
    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      heartbeatMode: "skip",
      dryRun: false,
      report,
    });

    const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
    const tools = await fs.readFile(path.join(workspace, "TOOLS.md"), "utf8");

    assert.match(agents, /Existing Workspace Instructions/);
    assert.match(agents, /chieflane:start:chieflane-agents/);
    assert.match(tools, /Existing Tooling/);
    assert.match(tools, /chieflane:start:chieflane-tools/);
  });
});

test("existing task-style HEARTBEAT.md is skipped", async () => {
  const manifest = await loadManifest(repoRoot);

  await withFixture("workspace-existing-heartbeat-tasks", async (workspace) => {
    const before = await fs.readFile(path.join(workspace, "HEARTBEAT.md"), "utf8");
    const report = createInstallReport({ workspace, mode: "live" });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      heartbeatMode: "manage",
      dryRun: false,
      report,
    });

    const after = await fs.readFile(path.join(workspace, "HEARTBEAT.md"), "utf8");
    assert.equal(after, before);
    assert.ok(
      report.skipped.some(
        (item) =>
          item.target === "HEARTBEAT.md" &&
          item.reason === "appears-user-managed"
      )
    );
  });
});

test("dashboard-style HEARTBEAT.md is skipped as user managed", async () => {
  const manifest = await loadManifest(repoRoot);

  await withFixture("workspace-existing-heartbeat-dashboard", async (workspace) => {
    const before = await fs.readFile(path.join(workspace, "HEARTBEAT.md"), "utf8");
    const report = createInstallReport({ workspace, mode: "live" });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      heartbeatMode: "manage",
      dryRun: false,
      report,
    });

    const after = await fs.readFile(path.join(workspace, "HEARTBEAT.md"), "utf8");
    assert.equal(after, before);
    assert.ok(
      report.skipped.some(
        (item) =>
          item.target === "HEARTBEAT.md" &&
          item.reason === "appears-user-managed"
      )
    );
  });
});

test("heartbeat force replaces an existing user-managed heartbeat", async () => {
  const manifest = await loadManifest(repoRoot);

  await withFixture("workspace-existing-heartbeat-dashboard", async (workspace) => {
    const report = createInstallReport({ workspace, mode: "live" });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      heartbeatMode: "force",
      dryRun: false,
      report,
    });

    const after = await fs.readFile(path.join(workspace, "HEARTBEAT.md"), "utf8");
    assert.match(after, /chieflane:start:heartbeat/);
    assert.ok(
      report.changed.some(
        (item) =>
          item.target === "HEARTBEAT.md" &&
          item.action === "replaced-from-template"
      )
    );
  });
});

test("existing MEMORY.md is skipped and profile example is created", async () => {
  const manifest = await loadManifest(repoRoot);

  await withFixture("workspace-existing-memory", async (workspace) => {
    const before = await fs.readFile(path.join(workspace, "MEMORY.md"), "utf8");
    const report = createInstallReport({ workspace, mode: "live" });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      heartbeatMode: "skip",
      dryRun: false,
      report,
    });

    const after = await fs.readFile(path.join(workspace, "MEMORY.md"), "utf8");
    assert.equal(after, before);
    assert.ok(
      await fs.pathExists(path.join(workspace, ".chieflane", "profile.example.md"))
    );
    assert.ok(
      report.skipped.some(
        (item) =>
          item.target === "MEMORY.md" &&
          item.reason === "existing-memory-left-untouched"
      )
    );
  });
});

test("rerunning merge twice does not duplicate managed markers", async () => {
  const manifest = await loadManifest(repoRoot);

  await withFixture("workspace-rerun-idempotence", async (workspace) => {
    const report = createInstallReport({ workspace, mode: "live" });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      heartbeatMode: "skip",
      dryRun: false,
      report,
    });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      heartbeatMode: "skip",
      dryRun: false,
      report,
    });

    const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
    const tools = await fs.readFile(path.join(workspace, "TOOLS.md"), "utf8");

    assert.equal(agents.match(/chieflane:start:chieflane-agents/g)?.length, 1);
    assert.equal(tools.match(/chieflane:start:chieflane-tools/g)?.length, 1);
  });
});

test("greenfield templates stay idempotent on rerun", async () => {
  const manifest = await loadManifest(repoRoot);

  await withFixture("workspace-empty", async (workspace) => {
    const report = createInstallReport({ workspace, mode: "live" });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "force",
      heartbeatMode: "manage",
      dryRun: false,
      report,
    });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "force",
      heartbeatMode: "manage",
      dryRun: false,
      report,
    });

    const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
    const tools = await fs.readFile(path.join(workspace, "TOOLS.md"), "utf8");

    assert.equal(agents.match(/chieflane:start:chieflane-agents/g)?.length, 1);
    assert.equal(tools.match(/chieflane:start:chieflane-tools/g)?.length, 1);
    assert.equal(agents.match(/## Chieflane Shell Integration/g)?.length, 1);
    assert.equal(tools.match(/## Chieflane Surface Tools/g)?.length, 1);
  });
});
