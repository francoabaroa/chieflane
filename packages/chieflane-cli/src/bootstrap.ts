import path from "node:path";
import dotenv from "dotenv";
import { execa } from "execa";
import { upsertCronJobs } from "./cron";
import { loadManifest, findRepoRoot } from "./manifest";
import {
  defaultWorkspacePath,
  enablePlugin,
  getWorkspacePath,
  installPlugin,
  restartGateway,
  resolveWorkspacePath,
  runOpenClaw,
  setConfig,
} from "./openclaw";
import { mergeWorkspaceFiles } from "./merge";
import {
  createInstallReport,
  type InstallReport,
  writeInstallReport,
} from "./report";
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

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

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

async function runWebScript(script: string, repoRoot: string) {
  await execa("pnpm", ["--filter", "@chieflane/web", script], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

async function runPluginBuild(repoRoot: string) {
  await execa("pnpm", ["--filter", "@chieflane/openclaw-plugin-surface-lane", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

export function getShellHealthUrl(shellApiUrl: string) {
  return new URL("api/health", ensureTrailingSlash(shellApiUrl)).toString();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isLocalShellUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

async function isShellHealthy(shellApiUrl: string) {
  try {
    const response = await fetch(getShellHealthUrl(shellApiUrl));
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForShell(shellApiUrl: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isShellHealthy(shellApiUrl)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for shell health at ${getShellHealthUrl(shellApiUrl)}`);
}

function getShellDevPort(shellApiUrl: string) {
  const parsed = new URL(shellApiUrl);
  if (parsed.port) {
    return Number(parsed.port);
  }
  return 3000;
}

async function withTemporaryShell<T>(args: {
  repoRoot: string;
  shellApiUrl: string;
  run: () => Promise<T>;
}) {
  if (await isShellHealthy(args.shellApiUrl)) {
    return args.run();
  }

  if (!isLocalShellUrl(args.shellApiUrl)) {
    throw new Error(
      `Shell is not reachable at ${args.shellApiUrl} and bootstrap cannot auto-start a non-local shell server.`
    );
  }

  let output = "";
  const child = execa(
    "pnpm",
    ["--filter", "@chieflane/web", "exec", "next", "dev", "--port", String(getShellDevPort(args.shellApiUrl))],
    {
      cwd: args.repoRoot,
      stdout: "pipe",
      stderr: "pipe",
      reject: false,
    }
  );

  child.stdout?.on("data", (chunk: string | Uint8Array) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk: string | Uint8Array) => {
    output += chunk.toString();
  });

  try {
    await waitForShell(args.shellApiUrl, 60_000);
    return await args.run();
  } catch (error) {
    const details = output.trim();
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(details ? `${message}\n\nTemporary shell output:\n${details}` : message);
  } finally {
    child.kill("SIGINT");
    await child.catch(() => undefined);
  }
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

export async function runBootstrap(rawOptions: Partial<BootstrapOptions>) {
  const options: BootstrapOptions = {
    mode: rawOptions.mode ?? "live",
    workspace: rawOptions.workspace ?? "auto",
    merge: rawOptions.merge ?? "safe",
    heartbeat: rawOptions.heartbeat ?? "skip",
    pluginSource: rawOptions.pluginSource ?? "path",
    dryRun: rawOptions.dryRun === true,
  };
  validateBootstrapOptions(options);

  const repoRoot = findRepoRoot();
  dotenv.config({ path: path.join(repoRoot, ".env") });

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
  let shellApiUrl: string | null = null;

  try {
    if (!options.dryRun) {
      shellApiUrl = requireEnv("SHELL_API_URL");
      requireEnv("SHELL_INTERNAL_API_KEY");
      requireEnv("OPENCLAW_GATEWAY_URL");
      requireEnv("OPENCLAW_GATEWAY_TOKEN");

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
            ? requireEnv(configEntry.fromEnv)
            : configEntry.value!;
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
            ? requireEnv(configEntry.fromEnv)
            : configEntry.value!;
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
      await runWebScript("db:init", repoRoot);
      if (manifest.modes[options.mode].seedDemoData) {
        await runWebScript("seed", repoRoot);
      }
      await writeLastBootstrapState(repoRoot, {
        workspace,
        mode: options.mode,
        updatedAt: new Date().toISOString(),
      });
      if (!shellApiUrl) {
        throw new Error("Missing SHELL_API_URL");
      }
      await withTemporaryShell({
        repoRoot,
        shellApiUrl,
        run: async () => {
          await runVerifyInternal({
            full: true,
            report,
            workspace,
          });
        },
      });
      await writeInstallReport(workspace, report);
    }

    return report;
  } catch (error) {
    report.errors.push({
      kind: "bootstrap",
      error: error instanceof Error ? error.message : String(error),
    });
    if (!options.dryRun) {
      await writeInstallReport(workspace, report);
    }
    throw error;
  }
}
