import path from "node:path";
import { browserCheck, openBrowser } from "./browser";
import { runBootstrap } from "./bootstrap";
import {
  getShellHealthUrl,
  isLocalShellUrl,
  isShellHealthy,
  startPersistentLocalShell,
  withTemporaryShellIfNeeded,
} from "./local-shell";
import { findRepoRoot } from "./manifest";
import { runPreflight } from "./preflight";
import type { PreflightPlan } from "./preflight-types";
import {
  getOpenClawContextKey,
  getOpenClawProfileLabel,
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
  check?: boolean;
  open?: boolean;
  browserCheck?: boolean;
};

type SetupLocalDependencies = {
  findRepoRoot: typeof findRepoRoot;
  primeOpenClawInvocationContext: typeof primeOpenClawInvocationContext;
  runPreflight: typeof runPreflight;
  resolveRuntimeEnv: typeof resolveRuntimeEnv;
  runBootstrap: typeof runBootstrap;
  withTemporaryShellIfNeeded: typeof withTemporaryShellIfNeeded;
  isShellHealthy: typeof isShellHealthy;
  startPersistentLocalShell: typeof startPersistentLocalShell;
  browserCheck: typeof browserCheck;
  openBrowser: typeof openBrowser;
};

const defaultDependencies: SetupLocalDependencies = {
  findRepoRoot,
  primeOpenClawInvocationContext,
  runPreflight,
  resolveRuntimeEnv,
  runBootstrap,
  withTemporaryShellIfNeeded,
  isShellHealthy,
  startPersistentLocalShell,
  browserCheck,
  openBrowser,
};

function resolvedShellPort(shellApiUrl: string) {
  const parsed = new URL(shellApiUrl);
  return parsed.port || (parsed.protocol === "https:" ? "443" : "80");
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

  const preflight = await deps.runPreflight({
    repoRoot,
    workspace: options.workspace ?? "auto",
    profile: context.profile,
    dev: context.dev,
  });

  if (options.check === true) {
    console.log(JSON.stringify(preflight, null, 2));
    if (!preflight.ok) {
      process.exitCode = 1;
    }
    return preflight;
  }

  const report = await deps.runBootstrap({
    mode: options.mode ?? "live",
    workspace: options.workspace ?? "auto",
    merge: options.merge ?? "safe",
    heartbeat: options.heartbeat ?? "skip",
    pluginSource: options.pluginSource ?? "path",
    dryRun: false,
    profile: context.profile,
    dev: context.dev,
    preflightPlan: preflight,
  });

  const runtimeEnv = await deps.resolveRuntimeEnv({
    repoRoot,
    allowGenerateGatewayToken: preflight.openclaw.isolated,
    allowGenerateShellInternalApiKey: true,
    persistGeneratedValues: true,
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

  const finalPreflight: PreflightPlan = {
    ...preflight,
    openclaw: {
      ...preflight.openclaw,
      workspace: {
        ...preflight.openclaw.workspace,
        value: report.workspace,
      },
    },
  };

  const finalSummary = {
    ok: report.errors.length === 0,
    openclaw: {
      profile: getOpenClawProfileLabel(context),
      contextKey: getOpenClawContextKey(context),
      stateDir: finalPreflight.openclaw.stateDir.value,
      configPath: finalPreflight.openclaw.configPath.value,
      workspace: report.workspace,
      gatewayPort: finalPreflight.openclaw.gateway.plannedPort,
      gatewayUrl: runtimeEnv.gatewayUrl,
    },
    shell: {
      apiUrl: runtimeEnv.shellApiUrl,
      healthUrl: getShellHealthUrl(runtimeEnv.shellApiUrl),
      port: resolvedShellPort(runtimeEnv.shellApiUrl),
      process: shell,
    },
    reports: {
      installJson: path.join(report.workspace, ".chieflane", "install-report.json"),
      installMd: path.join(report.workspace, ".chieflane", "install-report.md"),
    },
    warnings,
  };

  const runBrowserActions = async () => {
    if (options.browserCheck === true) {
      const browser = await deps.browserCheck(runtimeEnv.shellApiUrl);
      if (!browser.rootOk || !browser.healthOk) {
        throw new Error(
          `Browser check failed for ${runtimeEnv.shellApiUrl} (rootOk=${browser.rootOk}, healthOk=${browser.healthOk}, healthStatus=${browser.healthStatus})`
        );
      }
      Object.assign(finalSummary, {
        browser,
      });
    }

    if (options.open === true) {
      const opened = await deps.openBrowser(runtimeEnv.shellApiUrl);
      if (!opened) {
        throw new Error(`Failed to open a browser for ${runtimeEnv.shellApiUrl}.`);
      }
      Object.assign(finalSummary, {
        browserOpened: true,
      });
    }
  };

  if (options.browserCheck === true || options.open === true) {
    const needsLocalShell = isLocalShellUrl(runtimeEnv.shellApiUrl);
    if (options.keepShell === false && needsLocalShell) {
      const shellAlreadyHealthy = await deps.isShellHealthy(runtimeEnv.shellApiUrl);
      if (options.open === true && !shellAlreadyHealthy) {
        throw new Error(
          `Cannot use --open with --keep-shell=false unless the local shell is already running at ${runtimeEnv.shellApiUrl}.`
        );
      }

      if (!shellAlreadyHealthy) {
        await deps.withTemporaryShellIfNeeded({
          repoRoot,
          runtimeEnv,
          openclawProfile: getOpenClawContextKey(context),
          run: runBrowserActions,
        });
      } else {
        await runBrowserActions();
      }
    } else {
      await runBrowserActions();
    }
  }

  console.log(JSON.stringify(finalSummary, null, 2));
  return finalSummary;
}
