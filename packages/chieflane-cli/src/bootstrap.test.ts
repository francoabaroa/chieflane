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
import type { PreflightPlan } from "./preflight-types";

const REQUIRED_ENV = [
  "SHELL_API_URL",
  "SHELL_INTERNAL_API_KEY",
  "OPENCLAW_GATEWAY_URL",
  "OPENCLAW_GATEWAY_TOKEN",
] as const;

const blockedPreflightPlan: PreflightPlan = {
  ok: false,
  blockers: [
    {
      kind: "gateway-port",
      message: "Could not find a free isolated gateway base port.",
    },
  ],
  warnings: [],
  repoRoot: "/tmp/repo",
  openclaw: {
    profile: "chieflane",
    contextKey: "chieflane",
    isolated: true,
    stateDir: {
      value: "/Users/test/.openclaw-chieflane",
      source: "inferred",
    },
    configPath: {
      value: "/Users/test/.openclaw-chieflane/openclaw.json",
      source: "inferred",
    },
    workspace: {
      value: "/tmp/workspace",
      source: "arg",
    },
    gateway: {
      configuredPort: null,
      plannedPort: 18789,
      reservedRange: {
        start: 18789,
        end: 18808,
      },
      url: "http://127.0.0.1:18789",
      probe: {
        ok: true,
        multipleGateways: true,
        targets: [{ url: "http://127.0.0.1:18789", ok: true }],
      },
    },
  },
  shell: {
    plannedPort: 3000,
    apiUrl: "http://localhost:3000",
    healthUrl: "http://localhost:3000/api/health",
  },
  packageManager: {
    pnpmAvailable: true,
    corepackAvailable: true,
    action: "none",
    pinnedSpec: "pnpm@10.19.0",
  },
  mutations: [],
};

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

test("runBootstrap aborts live mutations when preflight reports blockers", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-bootstrap-"));

  try {
    await assert.rejects(
      () =>
        runBootstrap({
          mode: "live",
          workspace,
          merge: "safe",
          heartbeat: "skip",
          pluginSource: "path",
          dryRun: false,
          profile: "chieflane",
          preflightPlan: {
            ...blockedPreflightPlan,
            openclaw: {
              ...blockedPreflightPlan.openclaw,
              workspace: {
                value: workspace,
                source: "arg",
              },
            },
          },
        }),
      /Preflight blocked: gateway-port/
    );

    const report = (await fs.readJson(
      path.join(workspace, ".chieflane", "install-report.json")
    )) as { preflight?: { ok: boolean } };
    assert.equal(report.preflight?.ok, false);
  } finally {
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
