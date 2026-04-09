import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createInstallReport } from "./report";
import type { PreflightPlan } from "./preflight-types";
import type { ResolvedRuntimeEnv } from "./runtime-env";
import { runSetupLocal } from "./setup-local";

const runtimeEnv: ResolvedRuntimeEnv = {
  shellApiUrl: "http://localhost:3000",
  shellInternalApiKey: "shell-key",
  gatewayUrl: "http://127.0.0.1:19021",
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
      source: "config",
    },
    gateway: {
      configuredPort: null,
      plannedPort: 19021,
      reservedRange: {
        start: 19021,
        end: 19040,
      },
      url: "http://127.0.0.1:19021",
      probe: {
        ok: true,
        multipleGateways: true,
        targets: [
          { url: "http://127.0.0.1:18789", ok: true },
          { url: "http://127.0.0.1:19021", ok: true },
        ],
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

test("runSetupLocal --check returns the preflight plan without bootstrapping", async () => {
  let bootstrapCalled = false;
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (value?: unknown) => {
    logs.push(String(value));
  };

  try {
    const result = await runSetupLocal(
      {
        profile: "chieflane",
        check: true,
      },
      {
        findRepoRoot: () => "/tmp/repo",
        primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
        runPreflight: async () => preflightPlan,
        resolveRuntimeEnv: async () => runtimeEnv,
        runBootstrap: async () => {
          bootstrapCalled = true;
          return createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          });
        },
        withTemporaryShellIfNeeded: async ({ run }) => run(),
        isShellHealthy: async () => true,
        startPersistentLocalShell: async () => ({
          reused: false,
          started: true,
          pid: 1,
          logFile: "",
        }),
        browserCheck: async () => ({
          rootOk: true,
          rootStatus: 200,
          healthOk: true,
          healthStatus: 200,
          healthPayloadOk: true,
        }),
        openBrowser: async () => true,
      }
    );

    assert.equal(bootstrapCalled, false);
    assert.equal(result, preflightPlan);
    assert.ok(logs.some((entry) => entry.includes("\"plannedPort\": 19021")));
  } finally {
    console.log = originalLog;
  }
});

test("runSetupLocal bootstraps and starts the persistent shell without rewriting .env.local", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-setup-"));
  let bootstrapCalled = false;
  let shellStarted = false;
  let capturedProfile: string | undefined;
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (value?: unknown) => {
    logs.push(String(value));
  };

  try {
    await fs.writeFile(
      path.join(repoRoot, ".env.local"),
      "DATABASE_PATH=./data/custom.db\n",
      "utf8"
    );

    const summary = await runSetupLocal(
      {
        profile: "chieflane",
      },
      {
        findRepoRoot: () => repoRoot,
        primeOpenClawInvocationContext: (args: {
          repoRoot: string;
          profile?: string;
          dev?: boolean;
        }) => {
          capturedProfile = args.profile;
          return { profile: args.profile, dev: args.dev };
        },
        runPreflight: async () => ({
          ...preflightPlan,
          repoRoot,
        }),
        resolveRuntimeEnv: async () => runtimeEnv,
        runBootstrap: async () => {
          bootstrapCalled = true;
          const report = createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          });
          report.workspace = "/tmp/workspace";
          return report;
        },
        withTemporaryShellIfNeeded: async ({ run }) => run(),
        isShellHealthy: async () => true,
        startPersistentLocalShell: async () => {
          shellStarted = true;
          return {
            reused: false,
            started: true,
            pid: 4242,
            logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
          };
        },
        browserCheck: async () => ({
          rootOk: true,
          rootStatus: 200,
          healthOk: true,
          healthStatus: 200,
          healthPayloadOk: true,
        }),
        openBrowser: async () => true,
      }
    );

    const body = await fs.readFile(path.join(repoRoot, ".env.local"), "utf8");
    const typedSummary = summary as {
      openclaw: { profile: string };
      shell: { apiUrl: string; port: string; process: { pid: number } | null };
      reports: { installJson: string };
    };

    assert.equal(capturedProfile, "chieflane");
    assert.equal(bootstrapCalled, true);
    assert.equal(shellStarted, true);
    assert.equal(typedSummary.openclaw.profile, "chieflane");
    assert.equal(typedSummary.shell.apiUrl, runtimeEnv.shellApiUrl);
    assert.equal(typedSummary.shell.port, "3000");
    assert.equal(body, "DATABASE_PATH=./data/custom.db\n");
    assert.ok(logs.some((entry) => entry.includes("\"installJson\"")));
    assert.equal(logs.some((entry) => entry.includes("\"doctorJson\"")), false);
  } finally {
    console.log = originalLog;
    await fs.remove(repoRoot);
  }
});

test("runSetupLocal preserves runtime overrides for the shell", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-setup-"));
  let startedShellApiUrl: string | null = null;
  let startedShellKey: string | null = null;
  const overriddenRuntimeEnv: ResolvedRuntimeEnv = {
    ...runtimeEnv,
    shellApiUrl: "http://localhost:4310",
    shellInternalApiKey: "custom-key",
    sources: {
      ...runtimeEnv.sources,
      shellApiUrl: "env.local",
      shellInternalApiKey: "env.local",
    },
  };

  try {
    await fs.writeFile(
      path.join(repoRoot, ".env.local"),
      [
        "SHELL_API_URL=http://localhost:4310",
        "SHELL_INTERNAL_API_KEY=custom-key",
        "OPENCLAW_GATEWAY_TOKEN=stale-token",
      ].join("\n"),
      "utf8"
    );

    await runSetupLocal(
      {
        profile: "chieflane",
      },
      {
        findRepoRoot: () => repoRoot,
        primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
        runPreflight: async () => ({
          ...preflightPlan,
          repoRoot,
        }),
        resolveRuntimeEnv: async () => overriddenRuntimeEnv,
        runBootstrap: async () =>
          createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          }),
        withTemporaryShellIfNeeded: async ({ run }) => run(),
        isShellHealthy: async () => true,
        startPersistentLocalShell: async ({ runtimeEnv: resolved }) => {
          startedShellApiUrl = resolved.shellApiUrl;
          startedShellKey = resolved.shellInternalApiKey;
          return {
            reused: false,
            started: true,
            pid: 4242,
            logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
          };
        },
        browserCheck: async () => ({
          rootOk: true,
          rootStatus: 200,
          healthOk: true,
          healthStatus: 200,
          healthPayloadOk: true,
        }),
        openBrowser: async () => true,
      }
    );

    assert.equal(startedShellApiUrl, overriddenRuntimeEnv.shellApiUrl);
    assert.equal(startedShellKey, overriddenRuntimeEnv.shellInternalApiKey);
    const typedSummary = (await runSetupLocal(
      {
        profile: "chieflane",
        keepShell: false,
      },
      {
        findRepoRoot: () => repoRoot,
        primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
        runPreflight: async () => ({
          ...preflightPlan,
          repoRoot,
          shell: {
            ...preflightPlan.shell,
            plannedPort: 3000,
          },
        }),
        resolveRuntimeEnv: async () => overriddenRuntimeEnv,
        runBootstrap: async () =>
          createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          }),
        withTemporaryShellIfNeeded: async ({ run }) => run(),
        isShellHealthy: async () => true,
        startPersistentLocalShell: async () => ({
          reused: false,
          started: true,
          pid: 4242,
          logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
        }),
        browserCheck: async () => ({
          rootOk: true,
          rootStatus: 200,
          healthOk: true,
          healthStatus: 200,
          healthPayloadOk: true,
        }),
        openBrowser: async () => true,
      }
    )) as {
      shell: { port: string };
    };
    assert.equal(typedSummary.shell.port, "4310");
  } finally {
    await fs.remove(repoRoot);
  }
});

test("runSetupLocal resolves the reported shell health URL from the runtime shell URL", async () => {
  const queriedRuntimeEnv: ResolvedRuntimeEnv = {
    ...runtimeEnv,
    shellApiUrl: "http://localhost:4310/?tenant=a#shell",
  };

  const summary = (await runSetupLocal(
    {
      profile: "chieflane",
      keepShell: false,
    },
    {
      findRepoRoot: () => "/tmp/repo",
      primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => queriedRuntimeEnv,
      runBootstrap: async () =>
        createInstallReport({
          workspace: "/tmp/workspace",
          mode: "live",
        }),
      withTemporaryShellIfNeeded: async ({ run }) => run(),
      isShellHealthy: async () => true,
      startPersistentLocalShell: async () => ({
        reused: false,
        started: true,
        pid: 1,
        logFile: "",
      }),
      browserCheck: async () => ({
        rootOk: true,
        rootStatus: 200,
        healthOk: true,
        healthStatus: 200,
        healthPayloadOk: true,
      }),
      openBrowser: async () => true,
    }
  )) as {
    shell: { apiUrl: string; healthUrl: string; port: string };
  };

  assert.equal(summary.shell.apiUrl, queriedRuntimeEnv.shellApiUrl);
  assert.equal(summary.shell.healthUrl, "http://localhost:4310/api/health");
  assert.equal(summary.shell.port, "4310");
});

test("runSetupLocal respects --dev without keeping the shell", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-setup-"));
  let shellStarted = false;

  try {
    const summary = await runSetupLocal(
      {
        dev: true,
        keepShell: false,
      },
      {
        findRepoRoot: () => repoRoot,
        primeOpenClawInvocationContext: () => ({ dev: true }),
        runPreflight: async () => ({
          ...preflightPlan,
          repoRoot,
          openclaw: {
            ...preflightPlan.openclaw,
            profile: "dev",
            contextKey: "dev-mode",
          },
        }),
        resolveRuntimeEnv: async () => runtimeEnv,
        runBootstrap: async () =>
          createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          }),
        withTemporaryShellIfNeeded: async ({ run }) => run(),
        isShellHealthy: async () => true,
        startPersistentLocalShell: async () => {
          shellStarted = true;
          return {
            reused: false,
            started: true,
            pid: 1,
            logFile: "",
          };
        },
        browserCheck: async () => ({
          rootOk: true,
          rootStatus: 200,
          healthOk: true,
          healthStatus: 200,
          healthPayloadOk: true,
        }),
        openBrowser: async () => true,
      }
    );

    const typedSummary = summary as {
      openclaw: { profile: string };
      shell: { process: unknown };
    };
    assert.equal(typedSummary.openclaw.profile, "dev");
    assert.equal(typedSummary.shell.process, null);
    assert.equal(shellStarted, false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("runSetupLocal skips persistent shell start for remote shell URLs", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-setup-"));
  let shellStarted = false;
  const remoteRuntimeEnv: ResolvedRuntimeEnv = {
    ...runtimeEnv,
    shellApiUrl: "https://shell.example.com",
  };

  try {
    const summary = await runSetupLocal(
      {
        profile: "work",
      },
      {
        findRepoRoot: () => repoRoot,
        primeOpenClawInvocationContext: () => ({ profile: "work" }),
        runPreflight: async () => ({
          ...preflightPlan,
          repoRoot,
          openclaw: {
            ...preflightPlan.openclaw,
            profile: "work",
            contextKey: "work",
          },
        }),
        resolveRuntimeEnv: async () => remoteRuntimeEnv,
        runBootstrap: async () =>
          createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          }),
        withTemporaryShellIfNeeded: async ({ run }) => run(),
        isShellHealthy: async () => false,
        startPersistentLocalShell: async () => {
          shellStarted = true;
          return {
            reused: false,
            started: true,
            pid: 1,
            logFile: "",
          };
        },
        browserCheck: async () => ({
          rootOk: true,
          rootStatus: 200,
          healthOk: true,
          healthStatus: 200,
          healthPayloadOk: true,
        }),
        openBrowser: async () => true,
      }
    );

    const typedSummary = summary as {
      shell: { process: unknown };
      warnings: string[];
    };
    assert.equal(shellStarted, false);
    assert.equal(typedSummary.shell.process, null);
    assert.equal(
      typedSummary.warnings.some((warning) =>
        warning.includes(
          "Skipping persistent shell start because SHELL_API_URL points to a remote shell"
        )
      ),
      true
    );
  } finally {
    await fs.remove(repoRoot);
  }
});

test("runSetupLocal optionally browser-checks and opens the shell URL", async () => {
  let checkedUrl: string | null = null;
  let openedUrl: string | null = null;

  const summary = await runSetupLocal(
    {
      profile: "chieflane",
      browserCheck: true,
      open: true,
    },
    {
      findRepoRoot: () => "/tmp/repo",
      primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => runtimeEnv,
      runBootstrap: async () =>
        createInstallReport({
          workspace: "/tmp/workspace",
          mode: "live",
        }),
      withTemporaryShellIfNeeded: async ({ run }) => run(),
      isShellHealthy: async () => true,
      startPersistentLocalShell: async () => ({
        reused: false,
        started: true,
        pid: 1,
        logFile: "",
      }),
      browserCheck: async (url) => {
        checkedUrl = url;
        return {
          rootOk: true,
          rootStatus: 200,
          healthOk: true,
          healthStatus: 200,
          healthPayloadOk: true,
        };
      },
      openBrowser: async (url) => {
        openedUrl = url;
        return true;
      },
    }
  );

  const typedSummary = summary as unknown as {
    browser: { rootOk: boolean; healthOk: boolean };
    browserOpened?: boolean;
  };
  assert.equal(checkedUrl, runtimeEnv.shellApiUrl);
  assert.equal(openedUrl, runtimeEnv.shellApiUrl);
  assert.equal(typedSummary.browser.rootOk, true);
  assert.equal(typedSummary.browser.healthOk, true);
  assert.equal(typedSummary.browserOpened, true);
});

test("runSetupLocal fails when the browser opener exits unsuccessfully", async () => {
  await assert.rejects(
    () =>
      runSetupLocal(
        {
          profile: "chieflane",
          open: true,
        },
        {
          findRepoRoot: () => "/tmp/repo",
          primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
          runPreflight: async () => preflightPlan,
          resolveRuntimeEnv: async () => runtimeEnv,
          runBootstrap: async () =>
            createInstallReport({
              workspace: "/tmp/workspace",
              mode: "live",
            }),
          withTemporaryShellIfNeeded: async ({ run }) => run(),
          isShellHealthy: async () => true,
          startPersistentLocalShell: async () => ({
            reused: false,
            started: true,
            pid: 1,
            logFile: "",
          }),
          browserCheck: async () => ({
            rootOk: true,
            rootStatus: 200,
            healthOk: true,
            healthStatus: 200,
            healthPayloadOk: true,
          }),
          openBrowser: async () => false,
        }
      ),
    /Failed to open a browser/
  );
});

test("runSetupLocal fails when browser-check reports an unhealthy shell", async () => {
  await assert.rejects(
    () =>
      runSetupLocal(
        {
          profile: "chieflane",
          browserCheck: true,
          keepShell: false,
        },
        {
          findRepoRoot: () => "/tmp/repo",
          primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
          runPreflight: async () => preflightPlan,
          resolveRuntimeEnv: async () => runtimeEnv,
          runBootstrap: async () =>
            createInstallReport({
              workspace: "/tmp/workspace",
              mode: "live",
            }),
          withTemporaryShellIfNeeded: async ({ run }) => run(),
          isShellHealthy: async () => true,
          startPersistentLocalShell: async () => ({
            reused: false,
            started: true,
            pid: 1,
            logFile: "",
          }),
          browserCheck: async () => ({
            rootOk: true,
            rootStatus: 200,
            healthOk: false,
            healthStatus: 200,
            healthPayloadOk: false,
          }),
          openBrowser: async () => true,
        }
      ),
    /Browser check failed/
  );
});

test("runSetupLocal uses a temporary shell for browser-check when keep-shell is false", async () => {
  let usedTemporaryShell = false;

  const summary = await runSetupLocal(
    {
      profile: "chieflane",
      browserCheck: true,
      keepShell: false,
    },
    {
      findRepoRoot: () => "/tmp/repo",
      primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
      runPreflight: async () => preflightPlan,
      resolveRuntimeEnv: async () => runtimeEnv,
      runBootstrap: async () =>
        createInstallReport({
          workspace: "/tmp/workspace",
          mode: "live",
        }),
      withTemporaryShellIfNeeded: async ({ run }) => {
        usedTemporaryShell = true;
        return run();
      },
      isShellHealthy: async () => false,
      startPersistentLocalShell: async () => ({
        reused: false,
        started: true,
        pid: 1,
        logFile: "",
      }),
      browserCheck: async () => ({
        rootOk: true,
        rootStatus: 200,
        healthOk: true,
        healthStatus: 200,
        healthPayloadOk: true,
      }),
      openBrowser: async () => true,
    }
  );

  const typedSummary = summary as unknown as {
    browser: { healthOk: boolean };
  };
  assert.equal(usedTemporaryShell, true);
  assert.equal(typedSummary.browser.healthOk, true);
});

test("runSetupLocal rejects --open when keep-shell is false and no local shell is already running", async () => {
  await assert.rejects(
    () =>
      runSetupLocal(
        {
          profile: "chieflane",
          open: true,
          keepShell: false,
        },
        {
          findRepoRoot: () => "/tmp/repo",
          primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
          runPreflight: async () => preflightPlan,
          resolveRuntimeEnv: async () => runtimeEnv,
          runBootstrap: async () =>
            createInstallReport({
              workspace: "/tmp/workspace",
              mode: "live",
            }),
          withTemporaryShellIfNeeded: async ({ run }) => run(),
          isShellHealthy: async () => false,
          startPersistentLocalShell: async () => ({
            reused: false,
            started: true,
            pid: 1,
            logFile: "",
          }),
          browserCheck: async () => ({
            rootOk: true,
            rootStatus: 200,
            healthOk: true,
            healthStatus: 200,
            healthPayloadOk: true,
          }),
          openBrowser: async () => true,
        }
      ),
    /Cannot use --open with --keep-shell=false/
  );
});
