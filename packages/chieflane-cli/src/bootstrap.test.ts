import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  runBootstrap,
  syncActiveWorkspace,
  validateBootstrapOptions,
} from "./bootstrap";
import { getShellHealthUrl } from "./local-shell";
import { createInstallReport } from "./report";

const REQUIRED_ENV = [
  "SHELL_API_URL",
  "SHELL_INTERNAL_API_KEY",
  "OPENCLAW_GATEWAY_URL",
  "OPENCLAW_GATEWAY_TOKEN",
] as const;

test("runBootstrap dry-run does not require integration secrets", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-bootstrap-"));
  const previous = new Map<string, string | undefined>(
    REQUIRED_ENV.map((name) => [name, process.env[name]])
  );

  for (const name of REQUIRED_ENV) {
    delete process.env[name];
  }

  try {
    const report = await runBootstrap({
      mode: "live",
      workspace,
      merge: "safe",
      heartbeat: "skip",
      pluginSource: "path",
      dryRun: true,
    });

    assert.equal(report.workspace, workspace);
    assert.ok(
      report.changed.some(
        (item) => item.kind === "bootstrap" && item.action === "dry-run"
      )
    );
    assert.equal(
      await fs.pathExists(path.join(workspace, "skills")),
      false
    );
    assert.equal(report.openclawProfile, "default");
    assert.deepEqual(
      report.gatewayScopedChanges.map((item) => item.kind),
      ["config", "plugin", "gateway-restart"]
    );
  } finally {
    for (const [name, value] of previous) {
      if (value == null) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await fs.remove(workspace);
  }
});

test("validateBootstrapOptions rejects an invalid mode before side effects", () => {
  assert.throws(
    () =>
      validateBootstrapOptions({
        mode: "lvie" as "live",
        workspace: "auto",
        merge: "safe",
        heartbeat: "skip",
        pluginSource: "path",
        dryRun: false,
      }),
    /Invalid mode: lvie/
  );
});

test("validateBootstrapOptions rejects --dev with --profile", () => {
  assert.throws(
    () =>
      validateBootstrapOptions({
        mode: "live",
        workspace: "auto",
        merge: "safe",
        heartbeat: "skip",
        pluginSource: "path",
        dryRun: false,
        profile: "chieflane",
        dev: true,
      }),
    /either --dev or --profile/
  );
});

test("syncActiveWorkspace only persists explicit workspace overrides", async () => {
  const report = createInstallReport({
    workspace: "/tmp/chieflane-workspace",
    mode: "live",
  });
  const calls: Array<{ path: string; value: string | boolean | number }> = [];

  await syncActiveWorkspace({
    workspaceOption: "auto",
    workspace: "/tmp/chieflane-workspace",
    report,
    setConfigFn: async (configPath, value, targetReport) => {
      calls.push({ path: configPath, value });
      targetReport.changed.push({
        kind: "config",
        path: configPath,
        action: "set",
        value,
      });
    },
  });

  assert.equal(
    report.changed.some(
      (item) =>
        item.kind === "config" && item.path === "agents.defaults.workspace"
    ),
    false
  );

  await syncActiveWorkspace({
    workspaceOption: "~/custom-workspace",
    workspace: "/tmp/chieflane-workspace",
    report,
    setConfigFn: async (configPath, value, targetReport) => {
      calls.push({ path: configPath, value });
      targetReport.changed.push({
        kind: "config",
        path: configPath,
        action: "set",
        value,
      });
    },
  });

  assert.deepEqual(calls, [
    {
      path: "agents.defaults.workspace",
      value: "/tmp/chieflane-workspace",
    },
  ]);
});

test("getShellHealthUrl preserves an existing base path", () => {
  assert.equal(
    getShellHealthUrl("https://example.com/chieflane"),
    "https://example.com/chieflane/api/health"
  );
});
