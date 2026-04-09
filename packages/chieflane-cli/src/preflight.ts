import crypto from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "fs-extra";
import {
  findRepoRoot,
  loadManifest,
} from "./manifest";
import { getShellHealthUrl } from "./local-shell";
import {
  getConfigValue,
  getOpenClawContextKey,
  getOpenClawProfileLabel,
  isIsolatedOpenClawContext,
  primeOpenClawInvocationContext,
  resolveWorkspacePath,
  runOpenClaw,
  type OpenClawInvocationContext,
} from "./openclaw";
import { resolveOpenClawPaths } from "./openclaw-paths";
import {
  chooseGatewayPort,
  DEFAULT_GATEWAY_PORT,
  reserveRange,
} from "./ports";
import {
  deriveGatewayUrl,
  resolveShellApiUrl,
  type RuntimeEnvDependencies,
} from "./runtime-env";
import type { PreflightMutation, PreflightPlan } from "./preflight-types";

export type PreflightOptions = {
  repoRoot?: string;
  workspace?: string;
  resolvedWorkspace?: string;
  workspaceSourceHint?: PreflightPlan["openclaw"]["workspace"]["source"];
  profile?: string;
  dev?: boolean;
};

type OpenClawCommandResult = Awaited<ReturnType<typeof runOpenClaw>>;

type PreflightDependencies = {
  findRepoRoot: typeof findRepoRoot;
  loadManifest: typeof loadManifest;
  primeOpenClawInvocationContext: typeof primeOpenClawInvocationContext;
  getConfigValue: typeof getConfigValue;
  runOpenClaw: typeof runOpenClaw;
  resolveShellApiUrl: typeof resolveShellApiUrl;
  readJson: typeof fs.readJson;
  hasCommand: (command: string) => boolean;
  chooseGatewayPort: typeof chooseGatewayPort;
};

const noOpenClawRuntimeDeps: RuntimeEnvDependencies = {
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
    }) as OpenClawCommandResult,
  randomBytes: crypto.randomBytes.bind(crypto),
};

const defaultDependencies: PreflightDependencies = {
  findRepoRoot,
  loadManifest,
  primeOpenClawInvocationContext,
  getConfigValue,
  runOpenClaw,
  resolveShellApiUrl,
  readJson: fs.readJson.bind(fs),
  hasCommand: (command: string) => {
    const result = spawnSync(command, ["--version"], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    return (result.status ?? 1) === 0;
  },
  chooseGatewayPort,
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stripWrappingQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function parsePort(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = stripWrappingQuotes(value);
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function safeGetConfigValue(
  configPath: string,
  deps: Pick<PreflightDependencies, "getConfigValue">
) {
  try {
    return await deps.getConfigValue(configPath);
  } catch {
    return null;
  }
}

async function safeRunOpenClawJson(
  args: string[],
  deps: Pick<PreflightDependencies, "runOpenClaw">
) {
  try {
    const result = await deps.runOpenClaw(args, { reject: false });
    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return null;
    }
    return safeJsonParse<unknown>(result.stdout);
  } catch {
    return null;
  }
}

function parseUrlPort(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "https:"
        ? 443
        : 80;
  } catch {
    return null;
  }
}

function isLoopbackUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^\[(.*)\]$/, "$1");
    return (
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname === "::"
    );
  } catch {
    return false;
  }
}

function walkObjects(value: unknown, visit: (entry: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkObjects(item, visit);
    }
    return;
  }

  if (value == null || typeof value !== "object") {
    return;
  }

  const entry = value as Record<string, unknown>;
  visit(entry);

  for (const child of Object.values(entry)) {
    walkObjects(child, visit);
  }
}

function normalizeProbeTargets(probeJson: unknown) {
  const targets: Array<{ url: string; ok: boolean }> = [];

  walkObjects(probeJson, (entry) => {
    const candidateUrl = [
      entry.url,
      entry.targetUrl,
      entry.gatewayUrl,
      entry.healthUrl,
    ].find((value): value is string => typeof value === "string" && value.length > 0);

    if (!candidateUrl) {
      return;
    }

    const okValue = [
      entry.ok,
      entry.reachable,
      entry.healthy,
      entry.success,
      entry.available,
      entry.status === "ok",
    ].find((value) => typeof value === "boolean");

    targets.push({
      url: candidateUrl,
      ok: typeof okValue === "boolean" ? okValue : true,
    });
  });

  return Array.from(
    new Map(targets.map((target) => [target.url, target])).values()
  );
}

function hasMultipleGatewayWarning(probeJson: unknown) {
  let multiple = false;

  walkObjects(probeJson, (entry) => {
    for (const value of Object.values(entry)) {
      if (
        typeof value === "string" &&
        value.toLowerCase().includes("multiple") &&
        value.toLowerCase().includes("gateway")
      ) {
        multiple = true;
      }
    }
  });

  return multiple;
}

function buildWorkspacePlan(args: {
  workspaceOption?: string;
  resolvedWorkspace?: string;
  workspaceSourceHint?: PreflightPlan["openclaw"]["workspace"]["source"];
  configuredWorkspace: string | null;
  context: OpenClawInvocationContext;
}) {
  if (args.resolvedWorkspace) {
    return {
      value: resolveWorkspacePath(args.resolvedWorkspace),
      source: args.workspaceSourceHint ?? "default",
    };
  }

  if (args.workspaceOption && args.workspaceOption !== "auto") {
    return {
      value: resolveWorkspacePath(args.workspaceOption),
      source: "arg" as const,
    };
  }

  if (args.configuredWorkspace) {
    return {
      value: resolveWorkspacePath(stripWrappingQuotes(args.configuredWorkspace)),
      source: "config" as const,
    };
  }

  const inferred =
    args.context.dev === true
      ? "~/.openclaw/workspace-dev"
      : args.context.profile && args.context.profile !== "default"
        ? `~/.openclaw/workspace-${args.context.profile}`
        : "~/.openclaw/workspace";

  return {
    value: resolveWorkspacePath(inferred),
    source: "default" as const,
  };
}

function buildMutations(args: {
  manifest: Awaited<ReturnType<typeof loadManifest>>;
  preflight: Pick<PreflightPlan, "openclaw" | "shell">;
  workspaceOption?: string;
}) {
  const mutations: PreflightMutation[] = [];
  const configuredPort = args.preflight.openclaw.gateway.configuredPort;
  const plannedPort = args.preflight.openclaw.gateway.plannedPort;

  if (args.preflight.openclaw.isolated && configuredPort !== plannedPort) {
    mutations.push({
      scope: "gateway-profile",
      action: "set-config",
      target: "gateway.port",
      value: plannedPort,
    });
  }

  if (args.workspaceOption && args.workspaceOption !== "auto") {
    mutations.push({
      scope: "gateway-profile",
      action: "set-config",
      target: "agents.defaults.workspace",
      value: args.preflight.openclaw.workspace.value,
    });
  }

  for (const entry of args.manifest.openclaw.config) {
    if (entry.fromEnv === "SHELL_INTERNAL_API_KEY") {
      mutations.push({
        scope: "gateway-profile",
        action: "set-config",
        target: entry.path,
        sensitive: true,
      });
      continue;
    }

    const value =
      entry.fromEnv === "SHELL_API_URL"
        ? args.preflight.shell.apiUrl
        : entry.value;
    mutations.push({
      scope: "gateway-profile",
      action: "set-config",
      target: entry.path,
      ...(value != null ? { value } : {}),
    });
  }

  mutations.push(
    {
      scope: "gateway-profile",
      action: "install-plugin",
      target: args.manifest.openclaw.plugin.id,
    },
    {
      scope: "gateway-profile",
      action: "enable-plugin",
      target: args.manifest.openclaw.plugin.id,
    },
    {
      scope: "gateway-profile",
      action: "restart-gateway",
      target: "gateway",
    },
    {
      scope: "workspace",
      action: "sync-skills",
      target: args.preflight.openclaw.workspace.value,
    },
    {
      scope: "workspace",
      action: "merge-workspace-snippets",
      target: args.preflight.openclaw.workspace.value,
    },
    {
      scope: "workspace",
      action: "sync-cron-jobs",
      target: args.preflight.openclaw.workspace.value,
    }
  );

  return mutations;
}

function buildPackageManagerPlan(args: {
  packageManagerSpec: string;
  pnpmAvailable: boolean;
  corepackAvailable: boolean;
  npmAvailable: boolean;
}) {
  return {
    pnpmAvailable: args.pnpmAvailable,
    corepackAvailable: args.corepackAvailable,
    action: args.pnpmAvailable
      ? ("none" as const)
      : args.corepackAvailable
        ? ("enable-corepack" as const)
        : args.npmAvailable
          ? ("install-corepack" as const)
          : ("manual" as const),
    pinnedSpec: args.packageManagerSpec,
  };
}

function formatMutations(mutations: PreflightMutation[]) {
  if (mutations.length === 0) {
    return "- none";
  }

  return mutations
    .map((mutation) => {
      const details = [
        `scope=${mutation.scope}`,
        `action=${mutation.action}`,
        `target=${mutation.target}`,
        mutation.sensitive ? "value=[REDACTED]" : mutation.value != null ? `value=${mutation.value}` : null,
      ].filter((value): value is string => value != null);
      return `- ${details.join(", ")}`;
    })
    .join("\n");
}

export function formatPreflightText(plan: PreflightPlan) {
  const blockerText =
    plan.blockers.length === 0
      ? "- none"
      : plan.blockers.map((item) => `- ${item.kind}: ${item.message}`).join("\n");
  const warningText =
    plan.warnings.length === 0
      ? "- none"
      : plan.warnings.map((item) => `- ${item.kind}: ${item.message}`).join("\n");

  return [
    `ok: ${plan.ok}`,
    `repoRoot: ${plan.repoRoot}`,
    `openclaw.profile: ${plan.openclaw.profile}`,
    `openclaw.contextKey: ${plan.openclaw.contextKey}`,
    `openclaw.stateDir: ${plan.openclaw.stateDir.value} (${plan.openclaw.stateDir.source})`,
    `openclaw.configPath: ${plan.openclaw.configPath.value} (${plan.openclaw.configPath.source})`,
    `openclaw.workspace: ${plan.openclaw.workspace.value} (${plan.openclaw.workspace.source})`,
    `openclaw.gateway.configuredPort: ${plan.openclaw.gateway.configuredPort ?? "unset"}`,
    `openclaw.gateway.plannedPort: ${plan.openclaw.gateway.plannedPort}`,
    `openclaw.gateway.reservedRange: ${plan.openclaw.gateway.reservedRange.start}-${plan.openclaw.gateway.reservedRange.end}`,
    `openclaw.gateway.url: ${plan.openclaw.gateway.url}`,
    `shell.apiUrl: ${plan.shell.apiUrl}`,
    `shell.healthUrl: ${plan.shell.healthUrl}`,
    "",
    "blockers:",
    blockerText,
    "",
    "warnings:",
    warningText,
    "",
    "mutations:",
    formatMutations(plan.mutations),
  ].join("\n");
}

export async function runPreflight(
  options: PreflightOptions = {},
  deps: PreflightDependencies = defaultDependencies
): Promise<PreflightPlan> {
  const repoRoot = options.repoRoot ?? deps.findRepoRoot();
  const context = deps.primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });
  const manifest = await deps.loadManifest(repoRoot);
  const blockers: PreflightPlan["blockers"] = [];
  const warnings: PreflightPlan["warnings"] = [];
  const openclawAvailable = deps.hasCommand("openclaw");
  const packageJson = (await deps.readJson(path.join(repoRoot, "package.json"))) as {
    packageManager?: string;
  };
  const pnpmAvailable = deps.hasCommand("pnpm");
  const corepackAvailable = deps.hasCommand("corepack");
  const npmAvailable = deps.hasCommand("npm");
  const packageManager = buildPackageManagerPlan({
    packageManagerSpec: String(packageJson.packageManager ?? "pnpm@10").split("+")[0],
    pnpmAvailable,
    corepackAvailable,
    npmAvailable,
  });

  if (!openclawAvailable) {
    blockers.push({
      kind: "openclaw-cli-missing",
      message:
        "openclaw is not installed or not on PATH. Install it before running setup-local without --check.",
    });
  }

  if (packageManager.action === "manual") {
    blockers.push({
      kind: "package-manager",
      message:
        "pnpm is unavailable and Corepack cannot be bootstrapped automatically because both corepack and npm are missing.",
    });
  }

  const configuredWorkspace =
    openclawAvailable
      ? await safeGetConfigValue("agents.defaults.workspace", deps)
      : null;
  const workspacePlan = buildWorkspacePlan({
    workspaceOption: options.workspace,
    resolvedWorkspace: options.resolvedWorkspace,
    workspaceSourceHint: options.workspaceSourceHint,
    configuredWorkspace,
    context,
  });

  const gatewayStatusJson = openclawAvailable
    ? await safeRunOpenClawJson(["gateway", "status", "--json", "--deep"], deps)
    : null;
  const gatewayProbeJson = openclawAvailable
    ? await safeRunOpenClawJson(["gateway", "probe", "--json"], deps)
    : null;

  const configuredPort = openclawAvailable
    ? parsePort(await safeGetConfigValue("gateway.port", deps))
    : null;
  const bindValue = openclawAvailable
    ? await safeGetConfigValue("gateway.bind", deps)
    : null;
  const probeTargets = normalizeProbeTargets(gatewayProbeJson);
  const occupiedBasePorts = probeTargets
    .filter((target) => target.ok && isLoopbackUrl(target.url))
    .map((target) => parseUrlPort(target.url))
    .filter((value): value is number => value != null);

  const gatewayPlan = await deps
    .chooseGatewayPort({
      context,
      configuredPort,
      occupiedBasePorts,
    })
    .catch((error) => {
      blockers.push({
        kind: "gateway-port",
        message: errorMessage(error),
      });
      const port = configuredPort ?? DEFAULT_GATEWAY_PORT;
      return {
        port,
        reservedRange: reserveRange(port),
        shouldWrite: false,
      };
    });

  const derivedGateway = deriveGatewayUrl({
    bind: bindValue,
    port: gatewayPlan.port,
  });
  for (const warning of derivedGateway.warnings) {
    warnings.push({
      kind: "gateway-bind",
      message: warning,
    });
  }

  const probeMultipleGateways =
    probeTargets.filter((target) => target.ok).length > 1 ||
    hasMultipleGatewayWarning(gatewayProbeJson);
  if (probeMultipleGateways) {
    warnings.push({
      kind: "gateway-probe",
      message:
        "Multiple reachable gateways were detected. Chieflane will keep the default profile shared and auto-plan unique ports for isolated profiles.",
    });
  }

  const shellResolutionDeps = openclawAvailable
    ? undefined
    : noOpenClawRuntimeDeps;
  const shellResolution = await deps.resolveShellApiUrl(
    {
      repoRoot,
      profile: context.profile,
      dev: context.dev,
    },
    shellResolutionDeps
  );
  const shellPort = parseUrlPort(shellResolution.shellApiUrl) ?? 3000;

  const paths = resolveOpenClawPaths({
    context,
    workspace: workspacePlan.value,
    statusJson: gatewayStatusJson,
  });

  const preflight: PreflightPlan = {
    ok: blockers.length === 0,
    blockers,
    warnings,
    repoRoot,
    openclaw: {
      profile: getOpenClawProfileLabel(context),
      contextKey: getOpenClawContextKey(context),
      isolated: isIsolatedOpenClawContext(context),
      stateDir: paths.stateDir,
      configPath: paths.configPath,
      workspace: workspacePlan,
      gateway: {
        configuredPort,
        plannedPort: gatewayPlan.port,
        reservedRange: gatewayPlan.reservedRange,
        url: derivedGateway.value,
        probe: {
          ok: probeTargets.some((target) => target.ok),
          multipleGateways: probeMultipleGateways,
          targets: probeTargets,
        },
      },
    },
    shell: {
      plannedPort: shellPort,
      apiUrl: shellResolution.shellApiUrl,
      healthUrl: getShellHealthUrl(shellResolution.shellApiUrl),
    },
    packageManager,
    mutations: [],
  };

  preflight.mutations = buildMutations({
    manifest,
    preflight,
    workspaceOption: options.workspace,
  });

  return preflight;
}

export async function runPreflightCommand(
  options: PreflightOptions & { json?: boolean } = {}
) {
  const plan = await runPreflight(options);
  if (options.json === false) {
    console.log(formatPreflightText(plan));
  } else {
    console.log(JSON.stringify(plan, null, 2));
  }
  if (!plan.ok) {
    process.exitCode = 1;
  }
  return plan;
}
