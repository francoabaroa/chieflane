import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createInstallReport } from "./report";
import type { ResolvedRuntimeEnv } from "./runtime-env";
import { ensureEnvLocal, runSetupLocal } from "./setup-local";

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

test("ensureEnvLocal preserves existing .env.local overrides", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-setup-"));

  try {
    await fs.writeFile(
      path.join(repoRoot, ".env.local"),
      "DATABASE_PATH=./data/custom.db\nOPENCLAW_GATEWAY_TOKEN=stale\n",
      "utf8"
    );

    await ensureEnvLocal(repoRoot);

    const body = await fs.readFile(path.join(repoRoot, ".env.local"), "utf8");
    assert.ok(body.includes("DATABASE_PATH=./data/custom.db"));
    assert.ok(body.includes("OPENCLAW_GATEWAY_TOKEN=stale"));
  } finally {
    await fs.remove(repoRoot);
  }
});

test("runSetupLocal writes .env.local, runs bootstrap, and starts the persistent shell", async () => {
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
        startPersistentLocalShell: async () => {
          shellStarted = true;
          return {
            reused: false,
            started: true,
            pid: 4242,
            logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
          };
        },
        writeFile: fs.writeFile.bind(fs),
        readFile: fs.readFile.bind(fs),
        chmod: fs.chmod.bind(fs),
      }
    );

    const body = await fs.readFile(path.join(repoRoot, ".env.local"), "utf8");
    assert.equal(capturedProfile, "chieflane");
    assert.equal(bootstrapCalled, true);
    assert.equal(shellStarted, true);
    assert.equal(summary.openclawProfile, "chieflane");
    assert.equal(body.trim(), "");
    assert.ok(logs.some((entry) => entry.includes("\"shellApiUrl\"")));
  } finally {
    console.log = originalLog;
    await fs.remove(repoRoot);
  }
});

test("runSetupLocal preserves shell and gateway overrides for runtime resolution", async () => {
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
        resolveRuntimeEnv: async (options) => {
          const body = await fs.readFile(path.join(repoRoot, ".env.local"), "utf8");
          assert.equal(body.includes("SHELL_API_URL=http://localhost:4310"), true);
          assert.equal(body.includes("SHELL_INTERNAL_API_KEY=custom-key"), true);
          assert.equal(body.includes("OPENCLAW_GATEWAY_TOKEN=stale-token"), true);
          assert.equal(options.profile, "chieflane");
          return overriddenRuntimeEnv;
        },
        runBootstrap: async () =>
          createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          }),
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
        writeFile: fs.writeFile.bind(fs),
        readFile: fs.readFile.bind(fs),
        chmod: fs.chmod.bind(fs),
      }
    );

    assert.equal(startedShellApiUrl, overriddenRuntimeEnv.shellApiUrl);
    assert.equal(startedShellKey, overriddenRuntimeEnv.shellInternalApiKey);
  } finally {
    await fs.remove(repoRoot);
  }
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
        resolveRuntimeEnv: async () => runtimeEnv,
        runBootstrap: async () =>
          createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          }),
        startPersistentLocalShell: async () => {
          shellStarted = true;
          return {
            reused: false,
            started: true,
            pid: 1,
            logFile: "",
          };
        },
        writeFile: fs.writeFile.bind(fs),
        readFile: fs.readFile.bind(fs),
        chmod: fs.chmod.bind(fs),
      }
    );

    assert.equal(summary.openclawProfile, "dev");
    assert.equal(summary.shell, null);
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
        resolveRuntimeEnv: async () => remoteRuntimeEnv,
        runBootstrap: async () =>
          createInstallReport({
            workspace: "/tmp/workspace",
            mode: "live",
          }),
        startPersistentLocalShell: async () => {
          shellStarted = true;
          return {
            reused: false,
            started: true,
            pid: 1,
            logFile: "",
          };
        },
        writeFile: fs.writeFile.bind(fs),
        readFile: fs.readFile.bind(fs),
        chmod: fs.chmod.bind(fs),
      }
    );

    assert.equal(shellStarted, false);
    assert.equal(summary.shell, null);
    assert.equal(
      summary.warnings.some((warning) =>
        warning.includes("Skipping persistent shell start because SHELL_API_URL points to a remote shell")
      ),
      true
    );
  } finally {
    await fs.remove(repoRoot);
  }
});
