import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Buffer } from "node:buffer";
import {
  resolveRuntimeEnv,
  resolveShellApiUrl,
  type RuntimeEnvDependencies,
} from "./runtime-env";

function createDeps(
  overrides: Partial<RuntimeEnvDependencies> = {}
): RuntimeEnvDependencies {
  return {
    readJson: fs.readJson.bind(fs),
    ensureDir: fs.ensureDir.bind(fs),
    writeJson: fs.writeJson.bind(fs),
    chmod: fs.chmod.bind(fs),
    readFile: fs.readFile.bind(fs),
    getConfigValue: async () => null,
    runOpenClaw: async () =>
      ({
        stdout: "",
        stderr: "",
        exitCode: 1,
      }) as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>,
    randomBytes: ((size: number) => Buffer.alloc(size, 7)) as RuntimeEnvDependencies["randomBytes"],
    ...overrides,
  };
}

function withEnv<T>(fn: () => Promise<T>) {
  const snapshot = { ...process.env };
  return fn().finally(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in snapshot)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(snapshot)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

test("resolveRuntimeEnv reads SHELL_API_URL from .env.local", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";
      await fs.writeFile(
        path.join(repoRoot, ".env.local"),
        ["SHELL_API_URL=http://localhost:4010"].join("\n"),
        "utf8"
      );

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps()
      );

      assert.equal(runtimeEnv.shellApiUrl, "http://localhost:4010");
      assert.equal(runtimeEnv.sources.shellApiUrl, "env.local");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv falls back to the default local shell URL", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps()
      );

      assert.equal(runtimeEnv.shellApiUrl, "http://localhost:3000");
      assert.equal(runtimeEnv.sources.shellApiUrl, "default");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv reuses a configured shell URL from OpenClaw config", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          runOpenClaw: async (args: string[]) => {
            if (
              args[0] === "config" &&
              args[2] === "plugins.entries.surface-lane.config.shellApiUrl"
            ) {
              return {
                stdout: JSON.stringify("http://127.0.0.1:4310"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.shellApiUrl, "http://127.0.0.1:4310");
      assert.equal(runtimeEnv.sources.shellApiUrl, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv derives the gateway URL from loopback config", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          getConfigValue: async (configPath: string) => {
            if (configPath === "gateway.port") {
              return "19191";
            }
            if (configPath === "gateway.bind") {
              return "loopback";
            }
            return null;
          },
        })
      );

      assert.equal(runtimeEnv.gatewayUrl, "http://127.0.0.1:19191");
      assert.equal(runtimeEnv.sources.gatewayUrl, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv preserves IPv6 loopback gateway binds", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          getConfigValue: async (configPath: string) => {
            if (configPath === "gateway.port") {
              return "19191";
            }
            if (configPath === "gateway.bind") {
              return "::1";
            }
            return null;
          },
        })
      );

      assert.equal(runtimeEnv.gatewayUrl, "http://[::1]:19191");
      assert.equal(runtimeEnv.sources.gatewayUrl, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv reuses a plaintext gateway token from OpenClaw config", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          getConfigValue: async (configPath: string) =>
            configPath === "gateway.auth.mode" ? "token" : null,
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: JSON.stringify("plaintext-token"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }
            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.gatewayToken, "plaintext-token");
      assert.equal(runtimeEnv.sources.gatewayToken, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv reuses the configured shell key when generation is disabled", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
          allowGenerateShellInternalApiKey: false,
        },
        createDeps({
          runOpenClaw: async (args: string[]) => {
            if (
              args[0] === "config" &&
              args[2] ===
                "plugins.entries.surface-lane.config.shellInternalApiKey"
            ) {
              return {
                stdout: JSON.stringify("configured-shell-key"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.shellInternalApiKey, "configured-shell-key");
      assert.equal(runtimeEnv.sources.shellInternalApiKey, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv honors repo env file shell keys over configured values", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";
      await fs.writeFile(
        path.join(repoRoot, ".env.local"),
        "SHELL_INTERNAL_API_KEY=stale-file-key\n",
        "utf8"
      );

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
          allowGenerateShellInternalApiKey: false,
        },
        createDeps({
          runOpenClaw: async (args: string[]) => {
            if (
              args[0] === "config" &&
              args[2] ===
                "plugins.entries.surface-lane.config.shellInternalApiKey"
            ) {
              return {
                stdout: JSON.stringify("configured-shell-key"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.shellInternalApiKey, "stale-file-key");
      assert.equal(runtimeEnv.sources.shellInternalApiKey, "env.local");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv leaves SHELL_INTERNAL_API_KEY unresolved when verify does not need it", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
          allowGenerateShellInternalApiKey: false,
          requireShellInternalApiKey: false,
        },
        createDeps()
      );

      assert.equal(runtimeEnv.shellInternalApiKey, "");
      assert.equal(runtimeEnv.sources.shellInternalApiKey, "unresolved");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveShellApiUrl reads SHELL_API_URL from .env.local", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      await fs.writeFile(
        path.join(repoRoot, ".env.local"),
        "SHELL_API_URL=http://localhost:4310\n",
        "utf8"
      );

      const result = await resolveShellApiUrl({ repoRoot }, createDeps());
      assert.equal(result.shellApiUrl, "http://localhost:4310");
      assert.equal(result.source, "env.local");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveShellApiUrl falls back to the configured plugin shell URL", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      const result = await resolveShellApiUrl(
        { repoRoot },
        createDeps({
          runOpenClaw: async (args: string[]) => {
            if (
              args[0] === "config" &&
              args[2] === "plugins.entries.surface-lane.config.shellApiUrl"
            ) {
              return {
                stdout: JSON.stringify("http://127.0.0.1:4310"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(result.shellApiUrl, "http://127.0.0.1:4310");
      assert.equal(result.source, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveShellApiUrl keeps runtime state scoped to the selected profile", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      await fs.ensureDir(path.join(repoRoot, ".chieflane"));
      await fs.writeJson(path.join(repoRoot, ".chieflane", "local-state.work.json"), {
        shellApiUrl: "http://localhost:4310",
      });

      const result = await resolveShellApiUrl(
        { repoRoot, profile: "play" },
        createDeps()
      );
      assert.equal(result.shellApiUrl, "http://localhost:3000");
      assert.equal(result.source, "default");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv ignores repo-file gateway settings when a profile is selected", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      await fs.writeFile(
        path.join(repoRoot, ".env.local"),
        [
          "OPENCLAW_PROFILE=work",
          "OPENCLAW_GATEWAY_URL=http://127.0.0.1:9999",
          "OPENCLAW_GATEWAY_TOKEN=stale-token",
        ].join("\n"),
        "utf8"
      );

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          getConfigValue: async (configPath: string) => {
            if (configPath === "gateway.port") {
              return "19191";
            }
            if (configPath === "gateway.bind") {
              return "loopback";
            }
            if (configPath === "gateway.auth.mode") {
              return "token";
            }
            return null;
          },
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: JSON.stringify("real-token"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.gatewayUrl, "http://127.0.0.1:19191");
      assert.equal(runtimeEnv.gatewayToken, "real-token");
      assert.equal(runtimeEnv.sources.gatewayUrl, "config");
      assert.equal(runtimeEnv.sources.gatewayToken, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv reuses a repo-file gateway token on the shared profile", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      await fs.writeFile(
        path.join(repoRoot, ".env.local"),
        [
          "OPENCLAW_GATEWAY_URL=http://127.0.0.1:19999",
          "OPENCLAW_GATEWAY_TOKEN=repo-token",
        ].join("\n"),
        "utf8"
      );

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          getConfigValue: async (configPath: string) =>
            configPath === "gateway.auth.mode" ? "token" : null,
          runOpenClaw: async () =>
            ({
              stdout: "secret:gateway.auth.token",
              stderr: "",
              exitCode: 0,
            }) as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>,
        })
      );

      assert.equal(runtimeEnv.gatewayUrl, "http://127.0.0.1:18789");
      assert.equal(runtimeEnv.gatewayToken, "repo-token");
      assert.equal(runtimeEnv.sources.gatewayUrl, "default");
      assert.equal(runtimeEnv.sources.gatewayToken, "env.local");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv prefers shared-profile config over repo-file gateway settings", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      await fs.writeFile(
        path.join(repoRoot, ".env.local"),
        [
          "OPENCLAW_GATEWAY_URL=http://127.0.0.1:19999",
          "OPENCLAW_GATEWAY_TOKEN=repo-token",
        ].join("\n"),
        "utf8"
      );

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          getConfigValue: async (configPath: string) => {
            if (configPath === "gateway.port") {
              return "18789";
            }
            if (configPath === "gateway.bind") {
              return "loopback";
            }
            if (configPath === "gateway.auth.mode") {
              return "token";
            }
            return null;
          },
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: JSON.stringify("config-token"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.gatewayUrl, "http://127.0.0.1:18789");
      assert.equal(runtimeEnv.gatewayToken, "config-token");
      assert.equal(runtimeEnv.sources.gatewayUrl, "config");
      assert.equal(runtimeEnv.sources.gatewayToken, "config");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv honors exported gateway vars for an isolated profile", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:19999";
      process.env.OPENCLAW_GATEWAY_TOKEN = "legacy-export";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          profile: "work",
          allowGenerateGatewayToken: false,
        },
        createDeps({
          getConfigValue: async (configPath: string) => {
            if (configPath === "gateway.port") {
              return "18789";
            }
            if (configPath === "gateway.bind") {
              return "loopback";
            }
            if (configPath === "gateway.auth.mode") {
              return "token";
            }
            return null;
          },
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: JSON.stringify("profile-token"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.gatewayUrl, "http://127.0.0.1:19999");
      assert.equal(runtimeEnv.gatewayToken, "legacy-export");
      assert.equal(runtimeEnv.sources.gatewayUrl, "env");
      assert.equal(runtimeEnv.sources.gatewayToken, "env");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv keeps generated shell keys scoped to the selected profile", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";
      await fs.ensureDir(path.join(repoRoot, ".chieflane"));
      await fs.writeJson(path.join(repoRoot, ".chieflane", "local-state.work.json"), {
        shellInternalApiKey: "work-shell-key",
      });

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          profile: "play",
          allowGenerateGatewayToken: false,
          allowGenerateShellInternalApiKey: true,
        },
        createDeps({
          getConfigValue: async (configPath: string) => {
            if (configPath === "gateway.port") {
              return "18789";
            }
            if (configPath === "gateway.bind") {
              return "loopback";
            }
            if (configPath === "gateway.auth.mode") {
              return "token";
            }
            return null;
          },
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: JSON.stringify("profile-token"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.notEqual(runtimeEnv.shellInternalApiKey, "work-shell-key");
      assert.equal(runtimeEnv.sources.shellInternalApiKey, "generated");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv honors repo-file shell values for isolated profiles", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      await fs.writeFile(
        path.join(repoRoot, ".env.local"),
        [
          "SHELL_API_URL=http://localhost:4310",
          "SHELL_INTERNAL_API_KEY=repo-shell-key",
        ].join("\n"),
        "utf8"
      );

      await fs.ensureDir(path.join(repoRoot, ".chieflane"));
      await fs.writeJson(
        path.join(repoRoot, ".chieflane", "local-state.work.json"),
        {
          shellApiUrl: "http://localhost:4410",
          shellInternalApiKey: "profile-shell-key",
        },
        { spaces: 2 }
      );

      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
          allowGenerateShellInternalApiKey: false,
          profile: "work",
        },
        createDeps({
          getConfigValue: async (configPath: string) =>
            configPath === "gateway.auth.mode" ? "token" : null,
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: JSON.stringify("profile-gateway-token"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.shellApiUrl, "http://localhost:4310");
      assert.equal(runtimeEnv.sources.shellApiUrl, "env.local");
      assert.equal(runtimeEnv.shellInternalApiKey, "repo-shell-key");
      assert.equal(runtimeEnv.sources.shellInternalApiKey, "env.local");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv refuses to generate a gateway token on the shared profile", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";

      await assert.rejects(
        () =>
          resolveRuntimeEnv(
            {
              repoRoot,
              allowGenerateGatewayToken: true,
            },
            createDeps({
              getConfigValue: async (configPath: string) =>
                configPath === "gateway.auth.mode" ? "token" : null,
            })
          ),
        /Refusing to generate or rotate a gateway token/
      );
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv treats OPENCLAW_PROFILE as isolated for token generation", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));
    let generated = false;

    try {
      process.env.OPENCLAW_PROFILE = "work";
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: true,
        },
        createDeps({
          getConfigValue: async (configPath: string) =>
            configPath === "gateway.auth.mode" ? "token" : null,
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "doctor" && args.includes("--generate-gateway-token")) {
              generated = true;
              return {
                stdout: "",
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: generated ? JSON.stringify("generated-from-env-profile") : "",
                stderr: "",
                exitCode: generated ? 0 : 1,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(generated, true);
      assert.equal(runtimeEnv.gatewayToken, "generated-from-env-profile");
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv allows token generation for an isolated profile", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));
    let generated = false;

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: true,
          profile: "chieflane",
        },
        createDeps({
          getConfigValue: async (configPath: string) =>
            configPath === "gateway.auth.mode" ? "token" : null,
          runOpenClaw: async (args: string[]) => {
            if (
              args[0] === "doctor" &&
              args.includes("--generate-gateway-token")
            ) {
              generated = true;
              return {
                stdout: "",
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: generated ? JSON.stringify("generated-token") : "",
                stderr: "",
                exitCode: generated ? 0 : 1,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      assert.equal(runtimeEnv.gatewayToken, "generated-token");
      assert.equal(runtimeEnv.sources.gatewayToken, "generated");
      assert.equal(generated, true);
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv does not persist isolated shell keys into .env.local", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: true,
          profile: "chieflane",
        },
        createDeps({
          randomBytes: ((size: number) => Buffer.alloc(size, 2)) as RuntimeEnvDependencies["randomBytes"],
          getConfigValue: async (configPath: string) =>
            configPath === "gateway.auth.mode" ? "token" : null,
          runOpenClaw: async (args: string[]) => {
            if (args[0] === "doctor" && args.includes("--generate-gateway-token")) {
              return {
                stdout: "",
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            if (args[0] === "config" && args[2] === "gateway.auth.token") {
              return {
                stdout: JSON.stringify("generated-token"),
                stderr: "",
                exitCode: 0,
              } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
            }

            return {
              stdout: "",
              stderr: "",
              exitCode: 1,
            } as Awaited<ReturnType<RuntimeEnvDependencies["runOpenClaw"]>>;
          },
        })
      );

      const envLocal = await fs.pathExists(path.join(repoRoot, ".env.local"))
        ? await fs.readFile(path.join(repoRoot, ".env.local"), "utf8")
        : "";

      assert.equal(runtimeEnv.sources.shellInternalApiKey, "generated");
      assert.equal(
        envLocal.includes(`SHELL_INTERNAL_API_KEY=${runtimeEnv.shellInternalApiKey}`),
        false
      );
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv generates and persists the shell internal API key", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      const runtimeEnv = await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          randomBytes: ((size: number) => Buffer.alloc(size, 1)) as RuntimeEnvDependencies["randomBytes"],
        })
      );

      const state = await fs.readJson(
        path.join(repoRoot, ".chieflane", "local-state.json")
      ) as { shellInternalApiKey: string };

      assert.equal(runtimeEnv.sources.shellInternalApiKey, "generated");
      assert.equal(runtimeEnv.shellInternalApiKey, state.shellInternalApiKey);
      assert.ok(state.shellInternalApiKey.length > 0);
    } finally {
      await fs.remove(repoRoot);
    }
  }));

test("resolveRuntimeEnv does not persist transient SHELL_API_URL env overrides", async () =>
  withEnv(async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-runtime-"));

    try {
      process.env.SHELL_API_URL = "http://localhost:4310";
      process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789";
      process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";

      await resolveRuntimeEnv(
        {
          repoRoot,
          allowGenerateGatewayToken: false,
        },
        createDeps({
          randomBytes: ((size: number) => Buffer.alloc(size, 3)) as RuntimeEnvDependencies["randomBytes"],
        })
      );

      const state = await fs.readJson(
        path.join(repoRoot, ".chieflane", "local-state.json")
      ) as { shellApiUrl?: string; shellInternalApiKey?: string };

      assert.equal(state.shellApiUrl, undefined);
      assert.equal(typeof state.shellInternalApiKey, "string");
    } finally {
      await fs.remove(repoRoot);
    }
  }));
