import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { execa, type Options as ExecaOptions } from "execa";
import type { InstallReport } from "./report";
import { isSensitiveConfigPath, redactValue } from "./sensitive";

export type OpenClawRunOptions = ExecaOptions & {
  reject?: boolean;
};

export type OpenClawInvocationContext = {
  profile?: string;
  dev?: boolean;
};

let currentContext: OpenClawInvocationContext = {};

function normalizeProfile(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseEnvFile(filePath: string) {
  try {
    return dotenv.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {} as Record<string, string>;
  }
}

function readLastBootstrapProfile(repoRoot: string): OpenClawInvocationContext {
  try {
    const raw = fs.readFileSync(
      path.join(repoRoot, ".chieflane", "last-bootstrap.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw) as {
      openclawProfile?: string;
      openclawContext?: OpenClawInvocationContext;
    };
    if (parsed.openclawContext?.dev === true) {
      return { dev: true };
    }
    if (normalizeProfile(parsed.openclawContext?.profile)) {
      return { profile: normalizeProfile(parsed.openclawContext?.profile) };
    }
    if (normalizeProfile(parsed.openclawProfile) && parsed.openclawProfile !== "default") {
      return { profile: normalizeProfile(parsed.openclawProfile) };
    }
  } catch {
    return {};
  }

  return {};
}

export function loadRepoEnv(repoRoot: string) {
  const envFile = parseEnvFile(path.join(repoRoot, ".env"));
  const envLocalFile = parseEnvFile(path.join(repoRoot, ".env.local"));
  return {
    ...envFile,
    ...envLocalFile,
  };
}

export function resolveOpenClawInvocationContext(
  context: OpenClawInvocationContext = currentContext,
  repoEnv: Record<string, string> = {},
  fallbackContext: OpenClawInvocationContext = {}
): OpenClawInvocationContext {
  if (context.dev) {
    return { dev: true };
  }

  if (normalizeProfile(context.profile)) {
    return { profile: normalizeProfile(context.profile) };
  }

  if (normalizeProfile(process.env.OPENCLAW_PROFILE)) {
    return { profile: normalizeProfile(process.env.OPENCLAW_PROFILE) };
  }

  if (normalizeProfile(repoEnv.OPENCLAW_PROFILE)) {
    return { profile: normalizeProfile(repoEnv.OPENCLAW_PROFILE) };
  }

  if (fallbackContext.dev) {
    return { dev: true };
  }

  if (normalizeProfile(fallbackContext.profile)) {
    return { profile: normalizeProfile(fallbackContext.profile) };
  }

  return {};
}

export function isIsolatedOpenClawContext(
  context: OpenClawInvocationContext = currentContext
) {
  const resolved = resolveOpenClawInvocationContext(context);
  return (
    resolved.dev === true ||
    (resolved.profile != null && resolved.profile !== "default")
  );
}

export function getOpenClawProfileLabel(
  context: OpenClawInvocationContext = currentContext
) {
  const resolved = resolveOpenClawInvocationContext(context);
  if (resolved.dev) {
    return "dev";
  }

  return resolved.profile ?? "default";
}

export function getOpenClawContextKey(
  context: OpenClawInvocationContext = currentContext
) {
  const resolved = resolveOpenClawInvocationContext(context);
  if (resolved.dev) {
    return "dev-mode";
  }

  return resolved.profile ?? "default";
}

export function primeOpenClawInvocationContext(args: {
  repoRoot: string;
  profile?: string;
  dev?: boolean;
}) {
  if (args.dev && args.profile) {
    throw new Error("Use either --dev or --profile, not both.");
  }

  const repoEnv = loadRepoEnv(args.repoRoot);
  const persistedContext = readLastBootstrapProfile(args.repoRoot);
  const context = resolveOpenClawInvocationContext({
    profile: args.profile,
    dev: args.dev,
  }, repoEnv, persistedContext);
  setOpenClawInvocationContext(context);
  return context;
}

export function setOpenClawInvocationContext(context: OpenClawInvocationContext) {
  if (context.dev && context.profile) {
    throw new Error("Use either --dev or --profile, not both.");
  }

  currentContext = {
    profile: normalizeProfile(context.profile),
    dev: context.dev === true,
  };
}

export function getOpenClawInvocationContext(): OpenClawInvocationContext {
  return { ...currentContext };
}

export function buildOpenClawArgs(
  args: string[],
  context: OpenClawInvocationContext = currentContext
) {
  const prefix: string[] = [];

  if (context.dev) {
    prefix.push("--dev");
  }

  if (context.profile) {
    prefix.push("--profile", context.profile);
  }

  return [...prefix, ...args];
}

export async function runOpenClaw(
  args: string[],
  options: OpenClawRunOptions & OpenClawInvocationContext = {}
) {
  return execa("openclaw", buildOpenClawArgs(args, {
    ...currentContext,
    ...resolveOpenClawInvocationContext({
      profile: options.profile ?? currentContext.profile,
      dev: options.dev ?? currentContext.dev,
    }),
  }), {
    cwd: options.cwd ?? process.cwd(),
    env: options.env,
    reject: options.reject ?? true,
  });
}

export function expandHome(value: string) {
  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

export function defaultWorkspacePath() {
  const resolved = resolveOpenClawInvocationContext();
  const profile = resolved.dev === true ? "dev" : resolved.profile;
  const base =
    profile && profile !== "default"
      ? `~/.openclaw/workspace-${profile}`
      : "~/.openclaw/workspace";
  return path.resolve(expandHome(base));
}

export function resolveWorkspacePath(value: string) {
  return path.resolve(expandHome(value));
}

export async function getWorkspacePath() {
  const result = await runOpenClaw(
    ["config", "get", "agents.defaults.workspace"],
    { reject: false }
  );

  const configured = result.stdout.trim();
  if (result.exitCode === 0 && configured) {
    return resolveWorkspacePath(configured);
  }

  return defaultWorkspacePath();
}

export async function getConfigValue(configPath: string) {
  const result = await runOpenClaw(["config", "get", configPath], {
    reject: false,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  return result.stdout.trim();
}

export async function setConfig(
  configPath: string,
  value: string | boolean | number,
  report: InstallReport
) {
  await runOpenClaw(["config", "set", configPath, String(value)]);
  const sensitive = isSensitiveConfigPath(configPath);
  report.changed.push({
    kind: "config",
    path: configPath,
    action: "set",
    value: sensitive ? redactValue(value) : value,
    sensitive: sensitive || undefined,
  });
}

export async function installPlugin(
  args: string[],
  report: InstallReport
) {
  await runOpenClaw(args);
  report.changed.push({
    kind: "plugin",
    action: "installed",
    args: args.join(" "),
  });
}

export async function enablePlugin(id: string, report: InstallReport) {
  await runOpenClaw(["plugins", "enable", id]);
  report.changed.push({
    kind: "plugin",
    id,
    action: "enabled",
  });
}

export async function restartGateway(report: InstallReport) {
  await runOpenClaw(["gateway", "restart"]);
  report.changed.push({
    kind: "gateway",
    action: "restarted",
  });
}
