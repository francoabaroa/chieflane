import assert from "node:assert/strict";
import test from "node:test";
import { runPreflight } from "./preflight";
import type { IntegrationManifest } from "./manifest";

const manifest: IntegrationManifest = {
  $schema: "./packages/chieflane-cli/src/chieflane.integration.schema.json",
  id: "chieflane",
  version: "0.2.0",
  env: [],
  openclaw: {
    configPlanning: {
      gatewayPort: {
        requiredForIsolatedProfiles: true,
        baseStride: 20,
        defaultSharedPort: 18789,
        defaultDevPort: 19001,
        namedProfileStart: 19021,
        namedProfileEnd: 19981,
      },
    },
    config: [
      {
        path: "gateway.http.endpoints.responses.enabled",
        value: true,
      },
      {
        path: "plugins.entries.surface-lane.config.shellApiUrl",
        fromEnv: "SHELL_API_URL",
      },
      {
        path: "plugins.entries.surface-lane.config.shellInternalApiKey",
        fromEnv: "SHELL_INTERNAL_API_KEY",
      },
    ],
    plugin: {
      id: "surface-lane",
      source: {
        mode: "local-path",
        path: "./packages/openclaw-plugin-surface-lane",
      },
    },
    skills: [],
    scopeWarnings: [],
    workspace: {
      greenfieldTemplates: {},
      snippets: [],
    },
    cron: [],
    healthChecks: [],
  },
  modes: {
    demo: {
      seedDemoData: true,
    },
    live: {
      seedDemoData: false,
    },
  },
};

test("runPreflight auto-plans a unique gateway port for isolated named profiles", async () => {
  const plan = await runPreflight(
    {
      repoRoot: "/tmp/repo",
      profile: "chieflane",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      loadManifest: async () => manifest,
      primeOpenClawInvocationContext: () => ({ profile: "chieflane" }),
      getConfigValue: async (configPath: string) => {
        if (configPath === "agents.defaults.workspace") {
          return "/tmp/workspace";
        }
        if (configPath === "gateway.bind") {
          return "loopback";
        }
        return null;
      },
      runOpenClaw: async (args: string[]) => {
        if (args[0] === "gateway" && args[1] === "probe") {
          return {
            stdout: JSON.stringify({
              targets: [{ url: "http://127.0.0.1:18789", ok: true }],
            }),
            stderr: "",
            exitCode: 0,
          } as never;
        }

        return {
          stdout: JSON.stringify({}),
          stderr: "",
          exitCode: 0,
        } as never;
      },
      resolveShellApiUrl: async () => ({
        shellApiUrl: "http://localhost:3000",
        source: "default",
      }),
      readJson: async () => ({
        packageManager: "pnpm@10.19.0",
      }),
      hasCommand: () => true,
      chooseGatewayPort: async () => ({
        port: 19021,
        reservedRange: {
          start: 19021,
          end: 19040,
        },
        shouldWrite: true,
      }),
    }
  );

  assert.equal(plan.openclaw.gateway.plannedPort, 19021);
  assert.equal(
    plan.mutations.some(
      (mutation) =>
        mutation.target === "gateway.port" && mutation.value === 19021
    ),
    true
  );
});

test("runPreflight never previews a gateway.port write for the shared default profile", async () => {
  const plan = await runPreflight(
    {
      repoRoot: "/tmp/repo",
    },
    {
      findRepoRoot: () => "/tmp/repo",
      loadManifest: async () => manifest,
      primeOpenClawInvocationContext: () => ({}),
      getConfigValue: async (configPath: string) => {
        if (configPath === "agents.defaults.workspace") {
          return "/tmp/workspace";
        }
        if (configPath === "gateway.bind") {
          return "loopback";
        }
        return null;
      },
      runOpenClaw: async () =>
        ({
          stdout: JSON.stringify({}),
          stderr: "",
          exitCode: 0,
        }) as never,
      resolveShellApiUrl: async () => ({
        shellApiUrl: "http://localhost:3000",
        source: "default",
      }),
      readJson: async () => ({
        packageManager: "pnpm@10.19.0",
      }),
      hasCommand: () => true,
      chooseGatewayPort: async () => ({
        port: 18789,
        reservedRange: {
          start: 18789,
          end: 18808,
        },
        shouldWrite: false,
      }),
    }
  );

  assert.equal(
    plan.mutations.some((mutation) => mutation.target === "gateway.port"),
    false
  );
});
