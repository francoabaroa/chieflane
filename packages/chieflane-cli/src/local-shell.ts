import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import fsExtra from "fs-extra";
import { execa } from "execa";
import { loadRepoEnv } from "./openclaw";
import type { ResolvedRuntimeEnv } from "./runtime-env";

type ShellChild = {
  pid?: number;
  stdout?: {
    on?: (event: string, listener: (chunk: string | Uint8Array) => void) => void;
  } | null;
  stderr?: {
    on?: (event: string, listener: (chunk: string | Uint8Array) => void) => void;
  } | null;
  unref: () => void;
  kill: (signal?: number | NodeJS.Signals) => boolean;
  catch: (onRejected: (error: unknown) => unknown) => Promise<unknown>;
};

type ShellSpawner = (
  command: string,
  args: string[],
  options: Record<string, unknown>
) => ShellChild;

export type ShellState = {
  pid?: number;
  shellApiUrl: string;
  logFile?: string;
  startedAt: string;
  managed?: boolean;
  runtimeFingerprint?: {
    shellApiUrl: string;
    gatewayUrl: string;
    shellInternalApiKeyHash: string;
    gatewayTokenHash: string;
  };
};

export type LocalShellDependencies = {
  execaImpl: ShellSpawner;
  ensureDir: typeof fsExtra.ensureDir;
  writeJson: typeof fsExtra.writeJson;
  readJson: typeof fsExtra.readJson;
  remove: typeof fsExtra.remove;
  pathExists: typeof fsExtra.pathExists;
  chmod: typeof fsExtra.chmod;
  openSync: typeof fs.openSync;
  closeSync: typeof fs.closeSync;
  isShellHealthy: typeof isShellHealthy;
  waitForShell: typeof waitForShell;
  wait: (ms: number) => Promise<void>;
  killProcess: (pid: number) => Promise<void>;
  isProcessAlive: (pid: number) => Promise<boolean>;
  getProcessCommandLine: (pid: number) => Promise<string | null>;
};

const defaultDependencies: LocalShellDependencies = {
  execaImpl: (command, args, options) =>
    execa(command, args, options) as unknown as ShellChild,
  ensureDir: fsExtra.ensureDir.bind(fsExtra),
  writeJson: fsExtra.writeJson.bind(fsExtra),
  readJson: fsExtra.readJson.bind(fsExtra),
  remove: fsExtra.remove.bind(fsExtra),
  pathExists: fsExtra.pathExists.bind(fsExtra),
  chmod: fsExtra.chmod.bind(fsExtra),
  openSync: fs.openSync.bind(fs),
  closeSync: fs.closeSync.bind(fs),
  isShellHealthy,
  waitForShell,
  wait: promisify(setTimeout),
  killProcess,
  isProcessAlive,
  getProcessCommandLine,
};

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeHost(host: string) {
  return host.replace(/^\[(.*)\]$/, "$1");
}

function normalizeShellUrlKey(shellApiUrl: string) {
  try {
    const parsed = new URL(shellApiUrl);
    const host = normalizeHost(parsed.hostname).toLowerCase();
    const normalizedHost =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
        ? "127.0.0.1"
        : host === "::1" || host === "::"
          ? "::1"
          : host;
    const port =
      parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${normalizedHost}:${port}${pathname}${parsed.search}`;
  } catch {
    return shellApiUrl;
  }
}

function profileStateKey(openclawProfile: string) {
  return encodeURIComponent(openclawProfile);
}

function getShellDevPort(shellApiUrl: string) {
  const parsed = new URL(shellApiUrl);
  return parsed.port ? Number(parsed.port) : 3000;
}

function shellDevArgs(shellApiUrl: string) {
  return [
    "--filter",
    "@chieflane/web",
    "exec",
    "next",
    "dev",
    "--port",
    String(getShellDevPort(shellApiUrl)),
  ];
}

export function getShellHealthUrl(shellApiUrl: string) {
  return new URL("api/health", ensureTrailingSlash(shellApiUrl)).toString();
}

export function isLocalShellUrl(shellApiUrl: string) {
  try {
    const host = normalizeHost(new URL(shellApiUrl).hostname);
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

function getAutoStartableLocalShellUrlError(shellApiUrl: string) {
  if (!isLocalShellUrl(shellApiUrl)) {
    return `Shell is not reachable at ${shellApiUrl} and auto-start only works for local shell URLs.`;
  }

  try {
    const parsed = new URL(shellApiUrl);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";

    if (parsed.protocol !== "http:") {
      return `Auto-start only supports local HTTP shell URLs. Received ${shellApiUrl}.`;
    }

    if (pathname !== "/" || parsed.search) {
      return `Auto-start only supports local shell URLs rooted at /. Received ${shellApiUrl}.`;
    }
  } catch {
    return `Shell is not reachable at ${shellApiUrl} and auto-start only works for local shell URLs.`;
  }

  return null;
}

export async function isShellHealthy(shellApiUrl: string) {
  try {
    const response = await fetch(getShellHealthUrl(shellApiUrl));
    if (!response.ok) {
      return false;
    }

    const body = (await response.json().catch(() => null)) as
      | { ok?: unknown; service?: unknown }
      | null;
    return body?.ok === true && body.service === "chieflane";
  } catch {
    return false;
  }
}

export async function waitForShell(
  shellApiUrl: string,
  timeoutMs = 60_000,
  deps: Pick<LocalShellDependencies, "isShellHealthy" | "wait"> = defaultDependencies
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await deps.isShellHealthy(shellApiUrl)) {
      return;
    }
    await deps.wait(750);
  }

  throw new Error(
    `Timed out waiting for shell health at ${getShellHealthUrl(shellApiUrl)}`
  );
}

export function buildShellChildEnv(
  runtimeEnv: ResolvedRuntimeEnv,
  repoEnv: Record<string, string> = {}
): NodeJS.ProcessEnv {
  if (!runtimeEnv.shellInternalApiKey) {
    throw new Error(
      "Cannot start the shell without SHELL_INTERNAL_API_KEY. Rerun pnpm setup-local or pnpm bootstrap, or set SHELL_INTERNAL_API_KEY explicitly."
    );
  }

  const databasePath = process.env.DATABASE_PATH ?? repoEnv.DATABASE_PATH;

  return {
    ...repoEnv,
    ...process.env,
    SHELL_API_URL: runtimeEnv.shellApiUrl,
    SHELL_INTERNAL_API_KEY: runtimeEnv.shellInternalApiKey,
    OPENCLAW_GATEWAY_URL: runtimeEnv.gatewayUrl,
    OPENCLAW_GATEWAY_TOKEN: runtimeEnv.gatewayToken,
    ...(databasePath ? { DATABASE_PATH: databasePath } : {}),
  };
}

export function shellRuntimeDir(repoRoot: string) {
  return path.join(repoRoot, ".chieflane", "runtime");
}

export function shellStatePath(repoRoot: string, openclawProfile = "default") {
  if (openclawProfile === "default") {
    return path.join(shellRuntimeDir(repoRoot), "shell.json");
  }

  return path.join(
    shellRuntimeDir(repoRoot),
    `shell.${profileStateKey(openclawProfile)}.json`
  );
}

export function shellLogPath(repoRoot: string, openclawProfile = "default") {
  if (openclawProfile === "default") {
    return path.join(shellRuntimeDir(repoRoot), "shell.log");
  }

  return path.join(
    shellRuntimeDir(repoRoot),
    `shell.${profileStateKey(openclawProfile)}.log`
  );
}

function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildRuntimeFingerprint(runtimeEnv: ResolvedRuntimeEnv) {
  return {
    shellApiUrl: normalizeShellUrlKey(runtimeEnv.shellApiUrl),
    gatewayUrl: runtimeEnv.gatewayUrl,
    shellInternalApiKeyHash: hashSecret(runtimeEnv.shellInternalApiKey),
    gatewayTokenHash: hashSecret(runtimeEnv.gatewayToken),
  };
}

function matchesRuntimeFingerprint(
  state: ShellState | null,
  runtimeEnv: ResolvedRuntimeEnv
) {
  if (!state?.runtimeFingerprint) {
    return false;
  }

  const expected = buildRuntimeFingerprint(runtimeEnv);
  return (
    normalizeShellUrlKey(state.runtimeFingerprint.shellApiUrl) ===
      expected.shellApiUrl &&
    state.runtimeFingerprint.gatewayUrl === expected.gatewayUrl &&
    state.runtimeFingerprint.shellInternalApiKeyHash ===
      expected.shellInternalApiKeyHash &&
    state.runtimeFingerprint.gatewayTokenHash === expected.gatewayTokenHash
  );
}

type ShellCompatibilityRuntime = Pick<
  ResolvedRuntimeEnv,
  "shellApiUrl" | "gatewayUrl" | "gatewayToken"
> & {
  shellInternalApiKey?: string | null;
};

export function matchesCompatibleRuntimeFingerprint(
  state: ShellState | null,
  runtimeEnv: ShellCompatibilityRuntime
) {
  if (!state?.runtimeFingerprint) {
    return false;
  }

  if (
    normalizeShellUrlKey(state.runtimeFingerprint.shellApiUrl) !==
      normalizeShellUrlKey(runtimeEnv.shellApiUrl) ||
    state.runtimeFingerprint.gatewayUrl !== runtimeEnv.gatewayUrl ||
    state.runtimeFingerprint.gatewayTokenHash !== hashSecret(runtimeEnv.gatewayToken)
  ) {
    return false;
  }

  if (!runtimeEnv.shellInternalApiKey) {
    return true;
  }

  return (
    state.runtimeFingerprint.shellInternalApiKeyHash ===
    hashSecret(runtimeEnv.shellInternalApiKey)
  );
}

async function safeWaitForShell(
  shellApiUrl: string,
  deps: LocalShellDependencies
) {
  return deps.waitForShell(shellApiUrl, 60_000);
}

async function writePersistentShellState(
  repoRoot: string,
  state: ShellState,
  openclawProfile: string,
  deps: Pick<LocalShellDependencies, "ensureDir" | "writeJson" | "chmod">
) {
  const stateFile = shellStatePath(repoRoot, openclawProfile);
  await deps.ensureDir(shellRuntimeDir(repoRoot));
  await deps.writeJson(stateFile, state, { spaces: 2 });
  if (process.platform !== "win32") {
    await deps.chmod(stateFile, 0o600).catch(() => undefined);
  }
}

type PersistentShellStateEntry = {
  openclawProfile: string;
  stateFile: string;
  state: ShellState;
};

function shellStateProfileFromName(fileName: string) {
  if (fileName === "shell.json") {
    return "default";
  }

  const match = /^shell\.(.+)\.json$/.exec(fileName);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function listPersistentShellStateEntries(
  repoRoot: string
): Promise<PersistentShellStateEntry[]> {
  try {
    const runtimeDir = shellRuntimeDir(repoRoot);
    const names = await fsExtra.readdir(runtimeDir);
    const entries = await Promise.all(
      names.map(async (fileName) => {
        const openclawProfile = shellStateProfileFromName(fileName);
        if (!openclawProfile) {
          return null;
        }

        const stateFile = path.join(runtimeDir, fileName);
        try {
          const state = (await fsExtra.readJson(stateFile)) as ShellState;
          return {
            openclawProfile,
            stateFile,
            state,
          };
        } catch {
          return null;
        }
      })
    );

    return entries.filter((entry): entry is PersistentShellStateEntry => entry != null);
  } catch {
    return [];
  }
}

async function findOtherPersistentShellStateByUrl(args: {
  repoRoot: string;
  shellApiUrl: string;
  openclawProfile: string;
}) {
  const entries = await listPersistentShellStateEntries(args.repoRoot);
  return (
    entries.find(
      (entry) =>
        entry.openclawProfile !== args.openclawProfile &&
        normalizeShellUrlKey(entry.state.shellApiUrl) ===
          normalizeShellUrlKey(args.shellApiUrl)
    ) ?? null
  );
}

function attachOutputBuffer(child: ShellChild) {
  let output = "";

  child.stdout?.on?.("data", (chunk: string | Uint8Array) => {
    output += chunk.toString();
  });
  child.stderr?.on?.("data", (chunk: string | Uint8Array) => {
    output += chunk.toString();
  });

  return () => output.trim();
}

function restartFailureMessage(shellApiUrl: string, reason: string | undefined) {
  if (reason === "timeout") {
    return `Timed out waiting for the previous local shell at ${shellApiUrl} to stop before restart.`;
  }

  return `A local shell is already running at ${shellApiUrl}, but it is not managed by Chieflane. Stop it manually before switching profiles or use a different SHELL_API_URL.`;
}

function managedShellConflictMessage(shellApiUrl: string, openclawProfile: string) {
  return `A Chieflane-managed shell for OpenClaw profile "${openclawProfile}" is already running at ${shellApiUrl}. Stop it manually or use a different SHELL_API_URL before switching profiles.`;
}

export async function withTemporaryShellIfNeeded<T>(
  args: {
    repoRoot: string;
    runtimeEnv: ResolvedRuntimeEnv;
    openclawProfile?: string;
    run: () => Promise<T>;
  },
  deps: LocalShellDependencies = defaultDependencies
) {
  const openclawProfile = args.openclawProfile ?? "default";
  const existingState = await readPersistentShellState(
    args.repoRoot,
    openclawProfile,
    deps
  );
  if (await deps.isShellHealthy(args.runtimeEnv.shellApiUrl)) {
    if (!isLocalShellUrl(args.runtimeEnv.shellApiUrl)) {
      return args.run();
    }

    if (existingState == null) {
      const conflictingState = await findOtherPersistentShellStateByUrl({
        repoRoot: args.repoRoot,
        shellApiUrl: args.runtimeEnv.shellApiUrl,
        openclawProfile,
      });
      if (!conflictingState) {
        return args.run();
      }

      if (matchesCompatibleRuntimeFingerprint(conflictingState.state, args.runtimeEnv)) {
        return args.run();
      }

      throw new Error(
        managedShellConflictMessage(
          args.runtimeEnv.shellApiUrl,
          conflictingState.openclawProfile
        )
      );
    } else if (matchesCompatibleRuntimeFingerprint(existingState, args.runtimeEnv)) {
      return args.run();
    } else {
      const stopResult = await stopPersistentLocalShell(
        args.repoRoot,
        openclawProfile,
        deps
      );
      if (!stopResult.stopped) {
        throw new Error(
          restartFailureMessage(args.runtimeEnv.shellApiUrl, stopResult.reason)
        );
      }

      if (await deps.isShellHealthy(args.runtimeEnv.shellApiUrl)) {
        return args.run();
      }
    }
  }

  const autoStartError = getAutoStartableLocalShellUrlError(
    args.runtimeEnv.shellApiUrl
  );
  if (autoStartError) {
    throw new Error(autoStartError);
  }

  const child = deps.execaImpl("pnpm", shellDevArgs(args.runtimeEnv.shellApiUrl), {
    cwd: args.repoRoot,
    env: buildShellChildEnv(args.runtimeEnv, loadRepoEnv(args.repoRoot)),
    stdout: "pipe",
    stderr: "pipe",
    reject: false,
  });
  const getOutput = attachOutputBuffer(child);

  try {
    await safeWaitForShell(args.runtimeEnv.shellApiUrl, deps);
    return await args.run();
  } catch (error) {
    const output = getOutput();
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      output ? `${message}\n\nTemporary shell output:\n${output}` : message
    );
  } finally {
    child.kill("SIGINT");
    await child.catch(() => undefined);
  }
}

export async function readPersistentShellState(
  repoRoot: string,
  openclawProfile = "default",
  deps: Pick<LocalShellDependencies, "readJson"> = defaultDependencies
): Promise<ShellState | null> {
  try {
    return (await deps.readJson(shellStatePath(repoRoot, openclawProfile))) as ShellState;
  } catch {
    return null;
  }
}

async function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function getProcessCommandLine(pid: number) {
  if (process.platform === "win32") {
    const result = await execa(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
      ],
      {
        reject: false,
        windowsHide: true,
      }
    );
    const commandLine = result.stdout.trim();
    return result.exitCode === 0 && commandLine ? commandLine : null;
  }

  const result = await execa("ps", ["-o", "command=", "-p", String(pid)], {
    reject: false,
  });
  const commandLine = result.stdout.trim();
  return result.exitCode === 0 && commandLine ? commandLine : null;
}

function isManagedShellCommandLine(commandLine: string | null) {
  if (!commandLine) {
    return false;
  }

  const normalized = commandLine.toLowerCase();
  return (
    normalized.includes("@chieflane/web") ||
    normalized.includes("next dev") ||
    (normalized.includes("next") && normalized.includes("chieflane"))
  );
}

async function waitForShellToStop(
  shellApiUrl: string,
  pid: number,
  deps: Pick<
    LocalShellDependencies,
    "isShellHealthy" | "isProcessAlive" | "wait"
  >,
  timeoutMs = 15_000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [healthy, alive] = await Promise.all([
      deps.isShellHealthy(shellApiUrl),
      deps.isProcessAlive(pid),
    ]);

    if (!healthy && !alive) {
      return true;
    }

    await deps.wait(250);
  }

  return false;
}

export async function killProcess(pid: number) {
  if (process.platform === "win32") {
    await execa("taskkill", ["/pid", String(pid), "/t", "/f"], {
      reject: false,
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-pid, "SIGINT");
  } catch {
    try {
      process.kill(pid, "SIGINT");
    } catch {
      return;
    }
  }
}

export async function startPersistentLocalShell(
  args: {
    repoRoot: string;
    runtimeEnv: ResolvedRuntimeEnv;
    openclawProfile?: string;
  },
  deps: LocalShellDependencies = defaultDependencies
) {
  const openclawProfile = args.openclawProfile ?? "default";

  let existingState = await readPersistentShellState(
    args.repoRoot,
    openclawProfile,
    deps
  );
  if (
    existingState?.managed !== false &&
    existingState?.shellApiUrl &&
    normalizeShellUrlKey(existingState.shellApiUrl) !==
      normalizeShellUrlKey(args.runtimeEnv.shellApiUrl)
  ) {
    const stopResult = await stopPersistentLocalShell(
      args.repoRoot,
      openclawProfile,
      deps
    );
    if (!stopResult.stopped && stopResult.reason !== "stale-state") {
      throw new Error(
        restartFailureMessage(existingState.shellApiUrl, stopResult.reason)
      );
    }
    existingState = await readPersistentShellState(args.repoRoot, openclawProfile, deps);
  }

  if (await deps.isShellHealthy(args.runtimeEnv.shellApiUrl)) {
    if (existingState == null) {
      const conflictingState = await findOtherPersistentShellStateByUrl({
        repoRoot: args.repoRoot,
        shellApiUrl: args.runtimeEnv.shellApiUrl,
        openclawProfile,
      });
      if (!conflictingState) {
        throw new Error(restartFailureMessage(args.runtimeEnv.shellApiUrl, undefined));
      }

      if (!matchesRuntimeFingerprint(conflictingState.state, args.runtimeEnv)) {
        const stopResult = await stopPersistentLocalShell(
          args.repoRoot,
          conflictingState.openclawProfile,
          deps
        );
        if (!stopResult.stopped) {
          throw new Error(
            restartFailureMessage(args.runtimeEnv.shellApiUrl, stopResult.reason)
          );
        }

        if (await deps.isShellHealthy(args.runtimeEnv.shellApiUrl)) {
          return { reused: true, started: false as const, managed: false as const };
        }
      } else {
        await writePersistentShellState(
          args.repoRoot,
          conflictingState.state,
          openclawProfile,
          deps
        );
        return {
          reused: true,
          started: false as const,
          managed: conflictingState.state.managed !== false,
        };
      }
    } else if (matchesRuntimeFingerprint(existingState, args.runtimeEnv)) {
      return {
        reused: true,
        started: false as const,
        managed: existingState.managed !== false,
      };
    } else {
      const stopResult = await stopPersistentLocalShell(
        args.repoRoot,
        openclawProfile,
        deps
      );
      if (!stopResult.stopped) {
        throw new Error(
          restartFailureMessage(args.runtimeEnv.shellApiUrl, stopResult.reason)
        );
      }

      if (await deps.isShellHealthy(args.runtimeEnv.shellApiUrl)) {
        return { reused: true, started: false as const, managed: false as const };
      }
    }
  }

  const autoStartError = getAutoStartableLocalShellUrlError(
    args.runtimeEnv.shellApiUrl
  );
  if (autoStartError) {
    throw new Error(autoStartError);
  }

  const runtimeDir = shellRuntimeDir(args.repoRoot);
  const logFile = shellLogPath(args.repoRoot, openclawProfile);
  await deps.ensureDir(runtimeDir);

  const out = deps.openSync(logFile, "a");
  const child = deps.execaImpl("pnpm", shellDevArgs(args.runtimeEnv.shellApiUrl), {
    cwd: args.repoRoot,
    env: buildShellChildEnv(args.runtimeEnv, loadRepoEnv(args.repoRoot)),
    detached: true,
    stdio: ["ignore", out, out],
    reject: false,
    windowsHide: true,
  });
  deps.closeSync(out);

  child.unref();

  try {
    await safeWaitForShell(args.runtimeEnv.shellApiUrl, deps);
  } catch (error) {
    if (typeof child.pid === "number") {
      await deps.killProcess(child.pid).catch(() => undefined);
    }
    throw error;
  }

  await writePersistentShellState(
    args.repoRoot,
    {
      pid: child.pid,
      managed: true,
      shellApiUrl: args.runtimeEnv.shellApiUrl,
      logFile,
      startedAt: new Date().toISOString(),
      runtimeFingerprint: buildRuntimeFingerprint(args.runtimeEnv),
    },
    openclawProfile,
    deps
  );

  return {
    reused: false as const,
    started: true as const,
    pid: child.pid,
    logFile,
  };
}

export async function getPersistentLocalShellStatus(
  repoRoot: string,
  openclawProfile = "default",
  deps: LocalShellDependencies = defaultDependencies
) {
  const state = await readPersistentShellState(repoRoot, openclawProfile, deps);
  const pidAlive =
    state?.pid != null ? await isProcessAlive(state.pid) : null;
  const healthy =
    state?.shellApiUrl != null
      ? await deps.isShellHealthy(state.shellApiUrl)
      : false;

  return {
    running: healthy && (state?.pid == null || pidAlive === true),
    healthy,
    pidAlive,
    state,
    stateFile: shellStatePath(repoRoot, openclawProfile),
  };
}

export async function stopPersistentLocalShell(
  repoRoot: string,
  openclawProfile = "default",
  deps: LocalShellDependencies = defaultDependencies
) {
  const state = await readPersistentShellState(repoRoot, openclawProfile, deps);
  if (!state) {
    return {
      stopped: false,
      reason: "no-state",
      stateFile: shellStatePath(repoRoot, openclawProfile),
    };
  }

  if (state.pid == null) {
    const healthy = await deps.isShellHealthy(state.shellApiUrl);
    if (!healthy) {
      await deps.remove(shellStatePath(repoRoot, openclawProfile)).catch(
        () => undefined
      );
    }

    return {
      stopped: false,
      reason: healthy ? "external-process" : "stale-state",
      shellApiUrl: state.shellApiUrl,
      logFile: state.logFile,
    };
  }

  const [pidAlive, healthy] = await Promise.all([
    deps.isProcessAlive(state.pid),
    deps.isShellHealthy(state.shellApiUrl),
  ]);

  if (!pidAlive) {
    await deps.remove(shellStatePath(repoRoot, openclawProfile)).catch(
      () => undefined
    );
    return {
      stopped: true,
      reason: healthy ? "external-process" : "stale-state",
      pid: state.pid,
      shellApiUrl: state.shellApiUrl,
      logFile: state.logFile,
    };
  }

  const commandLine = await deps.getProcessCommandLine(state.pid);
  if (!isManagedShellCommandLine(commandLine)) {
    await deps.remove(shellStatePath(repoRoot, openclawProfile)).catch(
      () => undefined
    );
    return {
      stopped: false,
      reason: "ownership-mismatch",
      pid: state.pid,
      shellApiUrl: state.shellApiUrl,
      logFile: state.logFile,
    };
  }

  await deps.killProcess(state.pid).catch(() => undefined);
  const stopped = await waitForShellToStop(state.shellApiUrl, state.pid, deps);
  if (!stopped) {
    return {
      stopped: false,
      reason: "timeout",
      pid: state.pid,
      shellApiUrl: state.shellApiUrl,
      logFile: state.logFile,
    };
  }

  await deps.remove(shellStatePath(repoRoot, openclawProfile)).catch(
    () => undefined
  );

  return {
    stopped: true,
    pid: state.pid,
    shellApiUrl: state.shellApiUrl,
    logFile: state.logFile,
  };
}
