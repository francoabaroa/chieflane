import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildShellChildEnv,
  buildRuntimeFingerprint,
  getShellHealthUrl,
  isShellHealthy,
  isLocalShellUrl,
  shellStatePath,
  startPersistentLocalShell,
  stopPersistentLocalShell,
  withTemporaryShellIfNeeded,
  type LocalShellDependencies,
} from "./local-shell";
import type { ResolvedRuntimeEnv } from "./runtime-env";

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

function createChild(pid = 12345) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = Promise.resolve({
    exitCode: 0,
  }) as unknown as Awaited<ReturnType<LocalShellDependencies["execaImpl"]>>;
  Object.assign(child, {
    pid,
    stdout,
    stderr,
    unref() {
      return undefined;
    },
    kill() {
      return true;
    },
  });
  return child;
}

function createDeps(
  overrides: Partial<LocalShellDependencies> = {}
): LocalShellDependencies {
  return {
    execaImpl: (() => createChild()) as unknown as LocalShellDependencies["execaImpl"],
    ensureDir: fs.ensureDir.bind(fs),
    writeJson: fs.writeJson.bind(fs),
    readJson: fs.readJson.bind(fs),
    remove: fs.remove.bind(fs),
    pathExists: fs.pathExists.bind(fs),
    chmod: fs.chmod.bind(fs),
    openSync: fs.openSync.bind(fs),
    closeSync: fs.closeSync.bind(fs),
    isShellHealthy: async () => true,
    waitForShell: async () => undefined,
    wait: async () => undefined,
    killProcess: async () => undefined,
    isProcessAlive: async () => true,
    getProcessCommandLine: async () =>
      "pnpm --filter @chieflane/web exec next dev --port 3000",
    ...overrides,
  };
}

test("withTemporaryShellIfNeeded returns immediately when the shell is already healthy", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let started = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: 1111,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      startedAt: new Date().toISOString(),
      runtimeFingerprint: buildRuntimeFingerprint(runtimeEnv),
    });

    const result = await withTemporaryShellIfNeeded(
      {
        repoRoot,
        runtimeEnv,
        run: async () => "ok",
      },
      createDeps({
        execaImpl: (() => {
          started = true;
          return createChild();
        }) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async () => true,
      })
    );

    assert.equal(result, "ok");
    assert.equal(started, false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("isShellHealthy requires the Chieflane health payload", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({
        ok: true,
        service: "chieflane",
      }),
    }) as Response) as typeof fetch;

  try {
    assert.equal(await isShellHealthy("http://localhost:3000"), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("isShellHealthy rejects unrelated 200 health endpoints", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({
        ok: true,
        service: "other-app",
      }),
    }) as Response) as typeof fetch;

  try {
    assert.equal(await isShellHealthy("http://localhost:3000"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("withTemporaryShellIfNeeded restarts a managed healthy shell when the runtime env changes", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let started = false;
  let stoppedPid: number | null = null;
  let stopped = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: process.pid,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
      startedAt: new Date().toISOString(),
      runtimeFingerprint: {
        shellApiUrl: runtimeEnv.shellApiUrl,
        gatewayUrl: runtimeEnv.gatewayUrl,
        shellInternalApiKeyHash: buildRuntimeFingerprint(runtimeEnv).shellInternalApiKeyHash,
        gatewayTokenHash: "different-token",
      },
    });

    const result = await withTemporaryShellIfNeeded(
      {
        repoRoot,
        runtimeEnv,
        run: async () => "ok",
      },
      createDeps({
        execaImpl: (() => {
          started = true;
          return createChild();
        }) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async () => !stopped,
        waitForShell: async () => undefined,
        killProcess: async (pid) => {
          stoppedPid = pid;
          stopped = true;
        },
        isProcessAlive: async () => !stopped,
      })
    );

    assert.equal(result, "ok");
    assert.equal(started, true);
    assert.equal(stoppedPid, process.pid);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("withTemporaryShellIfNeeded starts a temporary shell for local URLs", async () => {
  let started = false;

  const result = await withTemporaryShellIfNeeded(
    {
      repoRoot: "/tmp/repo",
      runtimeEnv,
      run: async () => "ok",
    },
    createDeps({
      execaImpl: (() => {
        started = true;
        return createChild();
      }) as unknown as LocalShellDependencies["execaImpl"],
      isShellHealthy: async () => false,
      waitForShell: async () => undefined,
    })
  );

  assert.equal(result, "ok");
  assert.equal(started, true);
});

test("withTemporaryShellIfNeeded reuses a healthy unmanaged local shell", async () => {
  let verifyCalled = false;

  await withTemporaryShellIfNeeded(
    {
      repoRoot: "/tmp/repo",
      runtimeEnv,
      run: async () => {
        verifyCalled = true;
      },
    },
    createDeps({
      isShellHealthy: async () => true,
    })
  );

  assert.equal(verifyCalled, true);
});

test("withTemporaryShellIfNeeded bypasses restart logic for healthy remote shells", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let stopped = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: process.pid,
      managed: true,
      shellApiUrl: "http://localhost:3000",
      startedAt: new Date().toISOString(),
      runtimeFingerprint: buildRuntimeFingerprint(runtimeEnv),
    });

    const result = await withTemporaryShellIfNeeded(
      {
        repoRoot,
        runtimeEnv: {
          ...runtimeEnv,
          shellApiUrl: "https://shell.example.com",
        },
        run: async () => "ok",
      },
      createDeps({
        isShellHealthy: async () => true,
        killProcess: async () => {
          stopped = true;
        },
      })
    );

    assert.equal(result, "ok");
    assert.equal(stopped, false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("withTemporaryShellIfNeeded preserves another profile's managed shell when the runtime differs", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let started = false;
  let stoppedPid: number | null = null;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot, "work")));
    await fs.writeJson(shellStatePath(repoRoot, "work"), {
      pid: process.pid,
      managed: true,
      shellApiUrl: "http://localhost:3000",
      startedAt: new Date().toISOString(),
      runtimeFingerprint: {
        shellApiUrl: "http://localhost:3000",
        gatewayUrl: "http://127.0.0.1:19999",
        shellInternalApiKeyHash: "old-shell",
        gatewayTokenHash: "old-gateway",
      },
    });

    await assert.rejects(
      () =>
        withTemporaryShellIfNeeded(
          {
            repoRoot,
            runtimeEnv: {
              ...runtimeEnv,
              shellApiUrl: "http://127.0.0.1:3000",
            },
            openclawProfile: "play",
            run: async () => "ok",
          },
          createDeps({
            execaImpl: (() => {
              started = true;
              return createChild();
            }) as unknown as LocalShellDependencies["execaImpl"],
            isShellHealthy: async () => true,
            waitForShell: async () => undefined,
            killProcess: async (pid) => {
              stoppedPid = pid;
            },
            isProcessAlive: async () => true,
          })
        ),
      /managed shell for OpenClaw profile "work"/
    );

    assert.equal(started, false);
    assert.equal(stoppedPid, null);
    assert.equal(await fs.pathExists(shellStatePath(repoRoot, "work")), true);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("withTemporaryShellIfNeeded refuses to auto-start a remote shell URL", async () => {
  await assert.rejects(
    () =>
      withTemporaryShellIfNeeded(
        {
          repoRoot: "/tmp/repo",
          runtimeEnv: {
            ...runtimeEnv,
            shellApiUrl: "https://shell.example.com",
          },
          run: async () => undefined,
        },
        createDeps({
          isShellHealthy: async () => false,
        })
      ),
    /auto-start only works for local shell URLs/
  );
});

test("withTemporaryShellIfNeeded rejects local HTTPS shell URLs when auto-start is needed", async () => {
  await assert.rejects(
    () =>
      withTemporaryShellIfNeeded(
        {
          repoRoot: "/tmp/repo",
          runtimeEnv: {
            ...runtimeEnv,
            shellApiUrl: "https://localhost:3000",
          },
          run: async () => undefined,
        },
        createDeps({
          isShellHealthy: async () => false,
        })
      ),
    /Auto-start only supports local HTTP shell URLs/
  );
});

test("withTemporaryShellIfNeeded rejects local shell URLs with a base path when auto-start is needed", async () => {
  await assert.rejects(
    () =>
      withTemporaryShellIfNeeded(
        {
          repoRoot: "/tmp/repo",
          runtimeEnv: {
            ...runtimeEnv,
            shellApiUrl: "http://localhost:3000/chieflane",
          },
          run: async () => undefined,
        },
        createDeps({
          isShellHealthy: async () => false,
        })
      ),
    /Auto-start only supports local shell URLs rooted at \//
  );
});

test("isLocalShellUrl treats bracketed IPv6 loopback as local", () => {
  assert.equal(isLocalShellUrl("http://[::1]:3000"), true);
});

test("shellStatePath scopes non-default profiles to separate files", () => {
  assert.equal(shellStatePath("/tmp/repo"), "/tmp/repo/.chieflane/runtime/shell.json");
  assert.equal(
    shellStatePath("/tmp/repo", "work"),
    "/tmp/repo/.chieflane/runtime/shell.work.json"
  );
});

test("startPersistentLocalShell writes shell state and log metadata", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));

  try {
    const shell = await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv,
      },
      createDeps({
        execaImpl: (() => createChild(4242)) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async () => false,
        waitForShell: async () => undefined,
      })
    );

    const state = await fs.readJson(shellStatePath(repoRoot)) as {
      pid: number;
      logFile: string;
      shellApiUrl: string;
    };

    assert.equal(shell.started, true);
    assert.equal(state.pid, 4242);
    assert.equal(state.shellApiUrl, runtimeEnv.shellApiUrl);
    assert.equal(path.basename(state.logFile), "shell.log");
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell stores state separately for non-default profiles", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));

  try {
    await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv,
        openclawProfile: "work",
      },
      createDeps({
        execaImpl: (() => createChild(4343)) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async () => false,
        waitForShell: async () => undefined,
      })
    );

    assert.equal(await fs.pathExists(shellStatePath(repoRoot)), false);
    assert.equal(await fs.pathExists(shellStatePath(repoRoot, "work")), true);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell restarts a managed shell when the runtime env changes", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let started = false;
  let stoppedPid: number | null = null;
  let stopped = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: process.pid,
      shellApiUrl: runtimeEnv.shellApiUrl,
      logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
      startedAt: new Date().toISOString(),
      runtimeFingerprint: {
        shellApiUrl: runtimeEnv.shellApiUrl,
        gatewayUrl: "http://127.0.0.1:19999",
        shellInternalApiKeyHash: "old-shell",
        gatewayTokenHash: "old-gateway",
      },
    });

    const shell = await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv,
      },
      createDeps({
        execaImpl: (() => {
          started = true;
          return createChild(4242);
        }) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async () => !stopped,
        waitForShell: async () => undefined,
        killProcess: async (pid) => {
          stoppedPid = pid;
          stopped = true;
        },
        isProcessAlive: async () => !stopped,
      })
    );

    const state = await fs.readJson(shellStatePath(repoRoot)) as {
      pid: number;
      runtimeFingerprint: { gatewayUrl: string };
    };

    assert.equal(shell.started, true);
    assert.equal(started, true);
    assert.equal(stoppedPid, process.pid);
    assert.equal(state.pid, 4242);
    assert.equal(state.runtimeFingerprint.gatewayUrl, runtimeEnv.gatewayUrl);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell stops the previous managed shell when the shell URL changes", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let started = false;
  let stoppedPid: number | null = null;
  let oldShellStopped = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: process.pid,
      managed: true,
      shellApiUrl: "http://localhost:3000",
      logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
      startedAt: new Date().toISOString(),
      runtimeFingerprint: buildRuntimeFingerprint(runtimeEnv),
    });

    const shell = await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv: {
          ...runtimeEnv,
          shellApiUrl: "http://localhost:4310",
        },
      },
      createDeps({
        execaImpl: (() => {
          started = true;
          return createChild(4343);
        }) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async (shellApiUrl: string) => {
          if (shellApiUrl === "http://localhost:3000") {
            return !oldShellStopped;
          }
          return false;
        },
        waitForShell: async () => undefined,
        killProcess: async (pid) => {
          stoppedPid = pid;
          oldShellStopped = true;
        },
        isProcessAlive: async () => !oldShellStopped,
      })
    );

    const state = await fs.readJson(shellStatePath(repoRoot)) as {
      pid: number;
      shellApiUrl: string;
    };

    assert.equal(shell.started, true);
    assert.equal(started, true);
    assert.equal(stoppedPid, process.pid);
    assert.equal(state.pid, 4343);
    assert.equal(state.shellApiUrl, "http://localhost:4310");
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell reuses a healthy managed shell when the runtime env matches", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let started = false;

  try {
    const fingerprint = buildRuntimeFingerprint(runtimeEnv);
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: 1111,
      shellApiUrl: runtimeEnv.shellApiUrl,
      logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
      startedAt: new Date().toISOString(),
      runtimeFingerprint: fingerprint,
    });

    const shell = await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv,
      },
      createDeps({
        execaImpl: (() => {
          started = true;
          return createChild(4242);
        }) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async () => true,
      })
    );

    assert.equal(shell.reused, true);
    assert.equal(shell.started, false);
    assert.equal(started, false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell refuses to reuse a healthy unmanaged local shell", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));

  try {
    await assert.rejects(
      () =>
        startPersistentLocalShell(
          {
            repoRoot,
            runtimeEnv,
          },
          createDeps({
            isShellHealthy: async () => true,
          })
        ),
      /not managed by Chieflane/
    );
    assert.equal(await fs.pathExists(shellStatePath(repoRoot)), false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell reuses a managed shell across equivalent loopback aliases", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let started = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: 1111,
      shellApiUrl: "http://localhost:3000",
      logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.log"),
      startedAt: new Date().toISOString(),
      runtimeFingerprint: {
        ...buildRuntimeFingerprint(runtimeEnv),
        shellApiUrl: "http://localhost:3000",
      },
    });

    const shell = await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv: {
          ...runtimeEnv,
          shellApiUrl: "http://127.0.0.1:3000",
        },
      },
      createDeps({
        execaImpl: (() => {
          started = true;
          return createChild(4242);
        }) as unknown as LocalShellDependencies["execaImpl"],
        isShellHealthy: async () => true,
      })
    );

    assert.equal(shell.reused, true);
    assert.equal(shell.started, false);
    assert.equal(started, false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell reuses a healthy replacement shell after stale managed state is cleared", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let killed = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: 4242,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      startedAt: new Date().toISOString(),
      runtimeFingerprint: {
        ...buildRuntimeFingerprint(runtimeEnv),
        gatewayTokenHash: "old-gateway",
      },
    });

    const shell = await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv,
      },
      createDeps({
        isShellHealthy: async () => true,
        isProcessAlive: async () => false,
        killProcess: async () => {
          killed = true;
        },
      })
    );

    assert.equal(shell.reused, true);
    assert.equal(shell.started, false);
    assert.equal(shell.managed, false);
    assert.equal(killed, false);
    assert.equal(await fs.pathExists(shellStatePath(repoRoot)), false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("startPersistentLocalShell rejects local HTTPS shell URLs when auto-start is needed", async () => {
  await assert.rejects(
    () =>
      startPersistentLocalShell(
        {
          repoRoot: "/tmp/repo",
          runtimeEnv: {
            ...runtimeEnv,
            shellApiUrl: "https://localhost:3000",
          },
        },
        createDeps({
          isShellHealthy: async () => false,
        })
      ),
    /Auto-start only supports local HTTP shell URLs/
  );
});

test("startPersistentLocalShell records reused managed shells for the requesting profile", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));

  try {
    const fingerprint = buildRuntimeFingerprint(runtimeEnv);
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot, "work")));
    await fs.writeJson(shellStatePath(repoRoot, "work"), {
      pid: 1111,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      logFile: path.join(repoRoot, ".chieflane", "runtime", "shell.work.log"),
      startedAt: new Date().toISOString(),
      runtimeFingerprint: fingerprint,
    });

    const shell = await startPersistentLocalShell(
      {
        repoRoot,
        runtimeEnv,
        openclawProfile: "play",
      },
      createDeps({
        isShellHealthy: async () => true,
      })
    );

    const state = await fs.readJson(shellStatePath(repoRoot, "play")) as {
      pid: number;
      shellApiUrl: string;
    };

    assert.equal(shell.reused, true);
    assert.equal(shell.started, false);
    assert.equal(state.pid, 1111);
    assert.equal(state.shellApiUrl, runtimeEnv.shellApiUrl);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("buildShellChildEnv preserves a repo-configured DATABASE_PATH", () => {
  const previous = process.env.DATABASE_PATH;
  delete process.env.DATABASE_PATH;

  try {
    const env = buildShellChildEnv(runtimeEnv, {
      DATABASE_PATH: "./data/custom.db",
    });

    assert.equal(env.DATABASE_PATH, "./data/custom.db");
  } finally {
    if (previous == null) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = previous;
    }
  }
});

test("stopPersistentLocalShell does not signal a reused pid it cannot verify", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let killed = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: 4242,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      startedAt: new Date().toISOString(),
    });

    const result = await stopPersistentLocalShell(
      repoRoot,
      "default",
      createDeps({
        isProcessAlive: async () => true,
        isShellHealthy: async () => false,
        getProcessCommandLine: async () => "node /tmp/other-process.js",
        killProcess: async () => {
          killed = true;
        },
      })
    );

    assert.equal(result.stopped, false);
    assert.equal(result.reason, "ownership-mismatch");
    assert.equal(killed, false);
    assert.equal(await fs.pathExists(shellStatePath(repoRoot)), false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("stopPersistentLocalShell only targets the selected profile state file", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let killed = false;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot, "work")));
    await fs.writeJson(shellStatePath(repoRoot, "work"), {
      pid: 4242,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      startedAt: new Date().toISOString(),
    });

    const result = await stopPersistentLocalShell(
      repoRoot,
      "default",
      createDeps({
        killProcess: async () => {
          killed = true;
        },
      })
    );

    assert.equal(result.stopped, false);
    assert.equal(result.reason, "no-state");
    assert.equal(killed, false);
    assert.equal(await fs.pathExists(shellStatePath(repoRoot, "work")), true);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("stopPersistentLocalShell waits for the old shell to exit before succeeding", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));
  let killed = false;
  let pollCount = 0;

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: 4242,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      startedAt: new Date().toISOString(),
    });

    const result = await stopPersistentLocalShell(
      repoRoot,
      "default",
      createDeps({
        isProcessAlive: async () => {
          pollCount += 1;
          return pollCount < 2;
        },
        isShellHealthy: async () => pollCount < 2,
        getProcessCommandLine: async () =>
          "pnpm --filter @chieflane/web exec next dev --port 3000",
        killProcess: async () => {
          killed = true;
        },
      })
    );

    assert.equal(result.stopped, true);
    assert.equal(killed, true);
    assert.ok(pollCount >= 2);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("stopPersistentLocalShell clears stale managed state when the pid is dead but the shell stays healthy", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-shell-"));

  try {
    await fs.ensureDir(path.dirname(shellStatePath(repoRoot)));
    await fs.writeJson(shellStatePath(repoRoot), {
      pid: 4242,
      managed: true,
      shellApiUrl: runtimeEnv.shellApiUrl,
      startedAt: new Date().toISOString(),
    });

    const result = await stopPersistentLocalShell(
      repoRoot,
      "default",
      createDeps({
        isProcessAlive: async () => false,
        isShellHealthy: async () => true,
      })
    );

    assert.equal(result.stopped, true);
    assert.equal(result.reason, "external-process");
    assert.equal(await fs.pathExists(shellStatePath(repoRoot)), false);
  } finally {
    await fs.remove(repoRoot);
  }
});

test("getShellHealthUrl preserves an existing base path", () => {
  assert.equal(
    getShellHealthUrl("https://example.com/chieflane"),
    "https://example.com/chieflane/api/health"
  );
});
