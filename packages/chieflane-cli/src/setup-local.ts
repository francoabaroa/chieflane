import path from "node:path";
import fs from "fs-extra";
import { runBootstrap } from "./bootstrap";
import { isLocalShellUrl, startPersistentLocalShell } from "./local-shell";
import { findRepoRoot } from "./manifest";
import {
  getOpenClawContextKey,
  getOpenClawProfileLabel,
  isIsolatedOpenClawContext,
  primeOpenClawInvocationContext,
} from "./openclaw";
import { resolveRuntimeEnv } from "./runtime-env";

export type SetupLocalOptions = {
  mode?: "live" | "demo";
  workspace?: string;
  merge?: "safe" | "force";
  heartbeat?: "skip" | "manage" | "force";
  pluginSource?: "path" | "npm" | "clawhub" | "link";
  keepShell?: boolean;
  profile?: string;
  dev?: boolean;
};

type SetupLocalDependencies = {
  findRepoRoot: typeof findRepoRoot;
  primeOpenClawInvocationContext: typeof primeOpenClawInvocationContext;
  resolveRuntimeEnv: typeof resolveRuntimeEnv;
  runBootstrap: typeof runBootstrap;
  startPersistentLocalShell: typeof startPersistentLocalShell;
  writeFile: typeof fs.writeFile;
  readFile: typeof fs.readFile;
  chmod: typeof fs.chmod;
};

const defaultDependencies: SetupLocalDependencies = {
  findRepoRoot,
  primeOpenClawInvocationContext,
  resolveRuntimeEnv,
  runBootstrap,
  startPersistentLocalShell,
  writeFile: fs.writeFile.bind(fs),
  readFile: fs.readFile.bind(fs),
  chmod: fs.chmod.bind(fs),
};

export async function ensureEnvLocal(
  repoRoot: string,
  deps: Pick<SetupLocalDependencies, "readFile" | "writeFile" | "chmod"> = defaultDependencies
) {
  const filePath = path.join(repoRoot, ".env.local");
  const current = await deps.readFile(filePath, "utf8").catch(() => "");
  const removedKeys = new Set<string>();

  const nextLines = current
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^([A-Z0-9_]+)=/.exec(line);
      if (!match) {
        return line;
      }

      if (removedKeys.has(match[1])) {
        return null;
      }
      return line;
    })
    .filter((line): line is string => line != null);

  await deps.writeFile(filePath, `${nextLines.join("\n")}\n`, "utf8");
  if (process.platform !== "win32") {
    await deps.chmod(filePath, 0o600).catch(() => undefined);
  }
}

export async function runSetupLocal(
  options: SetupLocalOptions,
  deps: SetupLocalDependencies = defaultDependencies
) {
  const repoRoot = deps.findRepoRoot();
  const context = deps.primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });

  await ensureEnvLocal(repoRoot, deps);

  const runtimeEnv = await deps.resolveRuntimeEnv({
    repoRoot,
    allowGenerateGatewayToken: isIsolatedOpenClawContext(context),
    allowGenerateShellInternalApiKey: true,
    persistGeneratedValues: true,
    profile: context.profile,
    dev: context.dev,
  });

  const report = await deps.runBootstrap({
    mode: options.mode ?? "live",
    workspace: options.workspace ?? "auto",
    merge: options.merge ?? "safe",
    heartbeat: options.heartbeat ?? "skip",
    pluginSource: options.pluginSource ?? "path",
    dryRun: false,
    profile: context.profile,
    dev: context.dev,
  });

  let shell = null;
  const warnings = [...runtimeEnv.warnings];
  if (options.keepShell !== false) {
    if (isLocalShellUrl(runtimeEnv.shellApiUrl)) {
      shell = await deps.startPersistentLocalShell({
        repoRoot,
        runtimeEnv,
        openclawProfile: getOpenClawContextKey(context),
      });
    } else {
      warnings.push(
        `Skipping persistent shell start because SHELL_API_URL points to a remote shell: ${runtimeEnv.shellApiUrl}`
      );
    }
  }

  const finalSummary = {
    ok: report.errors.length === 0,
    shellApiUrl: runtimeEnv.shellApiUrl,
    shellHealthUrl: `${runtimeEnv.shellApiUrl.replace(/\/$/, "")}/api/health`,
    gatewayUrl: runtimeEnv.gatewayUrl,
    openclawProfile: getOpenClawProfileLabel(context),
    workspace: report.workspace,
    shell,
    warnings,
  };

  console.log(JSON.stringify(finalSummary, null, 2));
  return finalSummary;
}
