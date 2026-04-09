import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createInstallReport } from "./report";
import type { ResolvedRuntimeEnv } from "./runtime-env";
import {
  getMissingSkillsForVerification,
  getMissingWorkspaceSkills,
  runVerify,
} from "./verify";
import type { PreflightPlan } from "./preflight-types";

const runtimeEnv: ResolvedRuntimeEnv = {
  shellApiUrl: "http://localhost:3000",
  shellInternalApiKey: "shell-key",
  gatewayUrl: "http://127.0.0.1:18789",
  gatewayToken: "gateway-token",
  sources: {
    shellApiUrl: "default",
    shellInternalApiKey: "generated",
    gatewayUrl: "config",
    gatewayToken: "config",
  },
  warnings: [],
};

const preflightPlan: PreflightPlan = {
  ok: true,
  blockers: [],
  warnings: [],
  repoRoot: "/tmp/repo",
  openclaw: {
    profile: "default",
    contextKey: "default",
    isolated: false,
    stateDir: {
      value: "/Users/test/.openclaw",
      source: "inferred",
    },
    configPath: {
      value: "/Users/test/.openclaw/openclaw.json",
      source: "inferred",
    },
    workspace: {
      value: "/tmp/workspace",
      source: "state",
    },
    gateway: {
      configuredPort: 18789,
      plannedPort: 18789,
      reservedRange: {
        start: 18789,
        end: 18808,
      },
      url: "http://127.0.0.1:18789",
      probe: {
        ok: true,
        multipleGateways: false,
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

test("getMissingWorkspaceSkills checks both skills roots", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-verify-"));

  try {
    await fs.ensureDir(path.join(workspace, "skills", "chief-shell"));
    await fs.writeFile(
      path.join(workspace, "skills", "chief-shell", "SKILL.md"),
      "# chief-shell\n",
      "utf8"
    );
    await fs.ensureDir(path.join(workspace, ".agents", "skills", "morning-ops"));
    await fs.writeFile(
      path.join(workspace, ".agents", "skills", "morning-ops", "SKILL.md"),
      "# morning-ops\n",
      "utf8"
    );

    const missing = getMissingWorkspaceSkills(workspace, [
      "chief-shell",
      "morning-ops",
      "meeting-ops",
    ]);

    assert.deepEqual(missing, ["meeting-ops"]);
  } finally {
    await fs.remove(workspace);
  }
});

test("getMissingSkillsForVerification checks the requested workspace even when skills are visible", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-verify-"));

  try {
    await fs.ensureDir(path.join(workspace, "skills", "chief-shell"));
    await fs.writeFile(
      path.join(workspace, "skills", "chief-shell", "SKILL.md"),
      "# chief-shell\n",
      "utf8"
    );

    const missing = getMissingSkillsForVerification({
      workspace,
      desired: ["chief-shell", "morning-ops"],
      visibleSlugs: ["chief-shell", "morning-ops"],
    });

    assert.deepEqual(missing, ["morning-ops"]);
  } finally {
    await fs.remove(workspace);
  }
});

test("runVerify auto-starts a temporary shell when ensure-shell is auto", async () => {
  let autoStartCalled = false;
  let verifyCalled = false;

  await runVerify(
    {
      full: true,
      workspace: "/tmp/workspace",
      ensureShell: "auto",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      resolveVerifyWorkspace: async () => "/tmp/workspace",
      createInstallReport,
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => runtimeEnv,
      withTemporaryShellIfNeeded: async ({ run }) => {
        autoStartCalled = true;
        return run();
      },
      runVerifyInternal: async (args) => {
        verifyCalled = true;
        assert.equal(args.runtimeEnv.shellApiUrl, runtimeEnv.shellApiUrl);
      },
      primeOpenClawInvocationContext: () => ({}),
    }
  );

  assert.equal(autoStartCalled, true);
  assert.equal(verifyCalled, true);
});

test("runVerify skips shell auto-start when ensure-shell is never", async () => {
  let autoStartCalled = false;
  let verifyCalled = false;

  await runVerify(
    {
      full: true,
      workspace: "/tmp/workspace",
      ensureShell: "never",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      resolveVerifyWorkspace: async () => "/tmp/workspace",
      createInstallReport,
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => runtimeEnv,
      withTemporaryShellIfNeeded: async ({ run }) => {
        autoStartCalled = true;
        return run();
      },
      runVerifyInternal: async () => {
        verifyCalled = true;
      },
      primeOpenClawInvocationContext: () => ({}),
    }
  );

  assert.equal(autoStartCalled, false);
  assert.equal(verifyCalled, true);
});

test("runVerify skips auto-start for remote shell URLs and still runs verification", async () => {
  let autoStartCalled = false;
  let verifyCalled = false;

  await runVerify(
    {
      workspace: "/tmp/workspace",
      ensureShell: "auto",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      resolveVerifyWorkspace: async () => "/tmp/workspace",
      createInstallReport,
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => ({
        ...runtimeEnv,
        shellApiUrl: "https://shell.example.com",
      }),
      withTemporaryShellIfNeeded: async ({ run }) => {
        autoStartCalled = true;
        return run();
      },
      runVerifyInternal: async () => {
        verifyCalled = true;
      },
      primeOpenClawInvocationContext: () => ({}),
    }
  );

  assert.equal(autoStartCalled, false);
  assert.equal(verifyCalled, true);
});

test("runVerify records the selected profile in the report", async () => {
  const report = await runVerify(
    {
      workspace: "/tmp/workspace",
      ensureShell: "never",
      profile: "chieflane",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      resolveVerifyWorkspace: async () => "/tmp/workspace",
      createInstallReport,
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => runtimeEnv,
      withTemporaryShellIfNeeded: async ({ run }) => run(),
      runVerifyInternal: async () => undefined,
      primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
    }
  );

  assert.equal(report.openclawProfile, "chieflane");
  assert.equal(report.runtimeEnv?.gatewayToken.redacted, "[REDACTED]");
});

test("runVerify does not require SHELL_INTERNAL_API_KEY when the shell does not need to be started", async () => {
  let verifyCalled = false;

  await runVerify(
    {
      workspace: "/tmp/workspace",
      ensureShell: "never",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      resolveVerifyWorkspace: async () => "/tmp/workspace",
      createInstallReport,
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => ({
        ...runtimeEnv,
        shellInternalApiKey: "",
        sources: {
          ...runtimeEnv.sources,
          shellInternalApiKey: "unresolved",
        },
      }),
      withTemporaryShellIfNeeded: async ({ run }) => run(),
      runVerifyInternal: async (args) => {
        verifyCalled = true;
        assert.equal(args.runtimeEnv.shellInternalApiKey, "");
      },
      primeOpenClawInvocationContext: () => ({}),
    }
  );

  assert.equal(verifyCalled, true);
});

test("runVerify skips shell auto-start when no internal API key is available", async () => {
  let autoStartCalled = false;
  let verifyCalled = false;

  await runVerify(
    {
      workspace: "/tmp/workspace",
      ensureShell: "auto",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      resolveVerifyWorkspace: async () => "/tmp/workspace",
      createInstallReport,
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => ({
        ...runtimeEnv,
        shellInternalApiKey: "",
        sources: {
          ...runtimeEnv.sources,
          shellInternalApiKey: "unresolved",
        },
      }),
      withTemporaryShellIfNeeded: async ({ run }) => {
        autoStartCalled = true;
        return run();
      },
      runVerifyInternal: async () => {
        verifyCalled = true;
      },
      primeOpenClawInvocationContext: () => ({}),
    }
  );

  assert.equal(autoStartCalled, false);
  assert.equal(verifyCalled, true);
});

test("runVerify respects an env-backed profile before workspace resolution", async () => {
  let capturedProfile: string | undefined;

  const report = await runVerify(
    {
      workspace: "/tmp/workspace",
      ensureShell: "never",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      resolveVerifyWorkspace: async () => "/tmp/workspace",
      createInstallReport,
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async (_options) => {
        capturedProfile = _options.profile;
        return runtimeEnv;
      },
      withTemporaryShellIfNeeded: async ({ run }) => run(),
      runVerifyInternal: async () => undefined,
      primeOpenClawInvocationContext: () => ({ profile: "work" }),
    }
  );

  assert.equal(capturedProfile, "work");
  assert.equal(report.openclawProfile, "work");
});
