import path from "node:path";
import { execa } from "execa";
import { upsertCronJobs } from "./cron";
import {
  buildShellChildEnv,
  withTemporaryShellIfNeeded,
} from "./local-shell";
import { loadManifest, findRepoRoot } from "./manifest";
import {
  defaultWorkspacePath,
  getOpenClawContextKey,
  getOpenClawProfileLabel,
  enablePlugin,
  getWorkspacePath,
  isIsolatedOpenClawContext,
  loadRepoEnv,
  primeOpenClawInvocationContext,
  resolveWorkspacePath,
  runOpenClaw,
  setConfig,
  installPlugin,
  restartGateway,
} from "./openclaw";
import { mergeWorkspaceFiles } from "./merge";
import {
  createInstallReport,
  type InstallReport,
  writeInstallReport,
} from "./report";
import {
  resolveRuntimeEnv,
  summarizeRuntimeEnv,
  type ResolvedRuntimeEnv,
} from "./runtime-env";
import { installSkillsIntoWorkspace } from "./skills";
import { writeLastBootstrapState } from "./state";
import { runVerifyInternal } from "./verify";

export type BootstrapOptions = {
  mode: "live" | "demo";
  workspace: string;
  merge: "safe" | "force";
  heartbeat: "skip" | "manage" | "force";
  pluginSource: "path" | "npm" | "clawhub" | "link";
  dryRun?: boolean;
  profile?: string;
  dev?: boolean;
};

const VALID_MODES = new Set<BootstrapOptions["mode"]>(["live", "demo"]);
const VALID_MERGES = new Set<BootstrapOptions["merge"]>(["safe", "force"]);
const VALID_HEARTBEAT = new Set<BootstrapOptions["heartbeat"]>([
  "skip",
  "manage",
  "force",
]);
const VALID_PLUGIN_SOURCES = new Set<BootstrapOptions["pluginSource"]>([
  "path",
  "npm",
  "clawhub",
  "link",
]);

function assertValidChoice(
  field: string,
  value: string,
  allowed: ReadonlySet<string>
) {
  if (!allowed.has(value)) {
    throw new Error(
      `Invalid ${field}: ${value}. Expected one of: ${Array.from(allowed).join(", ")}`
    );
  }
}

export function validateBootstrapOptions(options: BootstrapOptions) {
  assertValidChoice("mode", options.mode, VALID_MODES);
  assertValidChoice("merge", options.merge, VALID_MERGES);
  assertValidChoice("heartbeat", options.heartbeat, VALID_HEARTBEAT);
  assertValidChoice("pluginSource", options.pluginSource, VALID_PLUGIN_SOURCES);
  if (options.dev && options.profile) {
    throw new Error("Use either --dev or --profile, not both.");
  }
}

export async function syncActiveWorkspace(args: {
  workspaceOption: string;
  workspace: string;
  report: InstallReport;
  setConfigFn?: typeof setConfig;
}) {
  if (args.workspaceOption === "auto") {
    return;
  }

  await (args.setConfigFn ?? setConfig)(
    "agents.defaults.workspace",
    args.workspace,
    args.report
  );
}

async function runWebScript(
  script: string,
  repoRoot: string,
  env?: NodeJS.ProcessEnv
) {
  await execa("pnpm", ["--filter", "@chieflane/web", script], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
}

async function runPluginBuild(repoRoot: string) {
  await execa(
    "pnpm",
    ["--filter", "@chieflane/openclaw-plugin-surface-lane", "build"],
    {
      cwd: repoRoot,
      stdio: "inherit",
    }
  );
}

function pluginInstallArgs(
  pluginSource: BootstrapOptions["pluginSource"],
  repoRoot: string
) {
  const localPath = path.join(repoRoot, "packages/openclaw-plugin-surface-lane");
  switch (pluginSource) {
    case "link":
      return ["plugins", "install", "-l", localPath];
    case "npm":
      return ["plugins", "install", "@chieflane/openclaw-plugin-surface-lane"];
    case "clawhub":
      return ["plugins", "install", "clawhub:@chieflane/openclaw-plugin-surface-lane"];
    case "path":
    default:
      return ["plugins", "install", localPath];
  }
}

function printScopeSummary(report: InstallReport) {
  console.log(`
Chieflane will make gateway-profile changes in OpenClaw profile "${report.openclawProfile ?? "default"}":
- enable /v1/responses
- install + enable surface-lane
- write plugin config
- restart the gateway

Workspace changes will target:
- ${report.workspace}
`.trim());
}

function addGatewayScopedChanges(report: InstallReport) {
  report.gatewayScopedChanges.push(
    {
      kind: "config",
      label: "Set gateway.http.endpoints.responses.enabled=true",
    },
    {
      kind: "plugin",
      label: "Install and enable surface-lane",
    },
    {
      kind: "gateway-restart",
      label: "Restart gateway to activate plugin/config changes",
    }
  );
}

export async function runBootstrap(rawOptions: Partial<BootstrapOptions>) {
  const options: BootstrapOptions = {
    mode: rawOptions.mode ?? "live",
    workspace: rawOptions.workspace ?? "auto",
    merge: rawOptions.merge ?? "safe",
    heartbeat: rawOptions.heartbeat ?? "skip",
    pluginSource: rawOptions.pluginSource ?? "path",
    dryRun: rawOptions.dryRun === true,
    profile: rawOptions.profile,
    dev: rawOptions.dev === true,
  };
  validateBootstrapOptions(options);

  const repoRoot = findRepoRoot();
  const context = primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });
  const manifest = await loadManifest(repoRoot);
  const workspace = await (async () => {
    if (options.workspace !== "auto") {
      return resolveWorkspacePath(options.workspace);
    }

    try {
      return await getWorkspacePath();
    } catch (error) {
      if (options.dryRun) {
        return defaultWorkspacePath();
      }
      throw error;
    }
  })();
  const report = createInstallReport({
    workspace,
    mode: options.mode,
  });
  report.openclawProfile = getOpenClawProfileLabel(context);
  addGatewayScopedChanges(report);
  printScopeSummary(report);

  let runtimeEnv: ResolvedRuntimeEnv | null = null;

  try {
    if (!options.dryRun) {
      runtimeEnv = await resolveRuntimeEnv({
        repoRoot,
        allowGenerateGatewayToken: isIsolatedOpenClawContext(context),
        allowGenerateShellInternalApiKey: true,
        persistGeneratedValues: true,
        profile: context.profile,
        dev: context.dev,
      });
      report.runtimeEnv = summarizeRuntimeEnv(runtimeEnv);
      for (const warning of runtimeEnv.warnings) {
        report.warnings.push({
          kind: "runtime-env",
          message: warning,
        });
      }

      await runOpenClaw(["status"]);
      await runOpenClaw(["gateway", "status"]);
      await runOpenClaw(["doctor", "--fix", "--non-interactive"], {
        reject: false,
      });
      await syncActiveWorkspace({
        workspaceOption: options.workspace,
        workspace,
        report,
      });

      for (const configEntry of manifest.openclaw.config.filter(
        (entry) => !entry.path.startsWith("plugins.entries.surface-lane.")
      )) {
        const value =
          configEntry.fromEnv != null
            ? buildShellChildEnv(runtimeEnv)[configEntry.fromEnv]
            : configEntry.value;
        if (value == null) {
          throw new Error(`Missing config value for ${configEntry.path}`);
        }
        await setConfig(configEntry.path, value, report);
      }

      if (options.pluginSource === "path" || options.pluginSource === "link") {
        await runPluginBuild(repoRoot);
      }

      await installPlugin(pluginInstallArgs(options.pluginSource, repoRoot), report);
      await enablePlugin(manifest.openclaw.plugin.id, report);

      for (const configEntry of manifest.openclaw.config.filter((entry) =>
        entry.path.startsWith("plugins.entries.surface-lane.")
      )) {
        const value =
          configEntry.fromEnv != null
            ? buildShellChildEnv(runtimeEnv)[configEntry.fromEnv]
            : configEntry.value;
        if (value == null) {
          throw new Error(`Missing config value for ${configEntry.path}`);
        }
        await setConfig(configEntry.path, value, report);
      }

      await restartGateway(report);
      await runOpenClaw(["plugins", "inspect", manifest.openclaw.plugin.id]);
    } else {
      report.changed.push({
        kind: "bootstrap",
        action: "dry-run",
      });
    }

    await installSkillsIntoWorkspace({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: options.merge,
      dryRun: options.dryRun ?? false,
      report,
    });

    await mergeWorkspaceFiles({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: options.merge,
      heartbeatMode: options.heartbeat,
      dryRun: options.dryRun ?? false,
      report,
    });

    await upsertCronJobs({
      cronJobs: manifest.openclaw.cron,
      dryRun: options.dryRun ?? false,
      report,
    });

    if (!options.dryRun) {
      if (!runtimeEnv) {
        throw new Error("Runtime environment was not resolved");
      }

      const resolvedRuntimeEnv = runtimeEnv;
      const shellEnv = buildShellChildEnv(
        resolvedRuntimeEnv,
        loadRepoEnv(repoRoot)
      );
      await runWebScript("db:init", repoRoot, shellEnv);
      if (manifest.modes[options.mode].seedDemoData) {
        await runWebScript("seed", repoRoot, shellEnv);
      }
      await writeLastBootstrapState(repoRoot, {
        workspace,
        mode: options.mode,
        openclawProfile: report.openclawProfile,
        openclawContext: {
          profile: context.profile,
          dev: context.dev === true,
        },
        updatedAt: new Date().toISOString(),
      });
      await withTemporaryShellIfNeeded({
        repoRoot,
        runtimeEnv: resolvedRuntimeEnv,
        openclawProfile: getOpenClawContextKey(context),
        run: async () => {
          await runVerifyInternal({
            full: true,
            report,
            workspace,
            runtimeEnv: resolvedRuntimeEnv,
          });
        },
      });
      await writeInstallReport(workspace, report);
    }

    return report;
  } catch (error) {
    report.errors.push({
      kind: runtimeEnv == null ? "runtime-env" : "bootstrap",
      error: error instanceof Error ? error.message : String(error),
    });
    if (!options.dryRun) {
      await writeInstallReport(workspace, report);
    }
    throw error;
  }
}
