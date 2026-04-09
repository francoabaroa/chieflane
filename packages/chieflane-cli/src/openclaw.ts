import path from "node:path";
import os from "node:os";
import { execa, type Options as ExecaOptions } from "execa";
import type { InstallReport } from "./report";
import { isSensitiveConfigPath, redactValue } from "./sensitive";

export type OpenClawRunOptions = ExecaOptions & {
  reject?: boolean;
};

export async function runOpenClaw(
  args: string[],
  options: OpenClawRunOptions = {}
) {
  return execa("openclaw", args, {
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
  const profile = process.env.OPENCLAW_PROFILE;
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
