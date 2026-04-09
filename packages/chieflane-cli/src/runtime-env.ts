import crypto from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";
import fs from "fs-extra";
import {
  getConfigValue,
  getOpenClawContextKey,
  getOpenClawProfileLabel,
  isIsolatedOpenClawContext,
  resolveOpenClawInvocationContext,
  runOpenClaw,
} from "./openclaw";

export type EnvSource =
  | "env"
  | "env.local"
  | "config"
  | "default"
  | "generated"
  | "state"
  | "unresolved";

export type ResolvedRuntimeEnv = {
  shellApiUrl: string;
  shellInternalApiKey: string;
  gatewayUrl: string;
  gatewayToken: string;
  sources: Record<
    "shellApiUrl" | "shellInternalApiKey" | "gatewayUrl" | "gatewayToken",
    EnvSource
  >;
  warnings: string[];
};

export type RuntimeEnvReport = {
  shellApiUrl: { source: EnvSource; value: string };
  shellInternalApiKey: { source: EnvSource; redacted: string };
  gatewayUrl: { source: EnvSource; value: string };
  gatewayToken: { source: EnvSource; redacted: string };
};

export type ResolveRuntimeEnvOptions = {
  repoRoot: string;
  allowGenerateGatewayToken: boolean;
  allowGenerateShellInternalApiKey?: boolean;
  requireShellInternalApiKey?: boolean;
  persistGeneratedValues?: boolean;
  profile?: string;
  dev?: boolean;
};

type RuntimeEnvState = Partial<
  Pick<ResolvedRuntimeEnv, "shellApiUrl" | "shellInternalApiKey">
>;

export type RuntimeEnvDependencies = {
  readJson: typeof fs.readJson;
  ensureDir: typeof fs.ensureDir;
  writeJson: typeof fs.writeJson;
  chmod: typeof fs.chmod;
  readFile: typeof fs.readFile;
  getConfigValue: typeof getConfigValue;
  runOpenClaw: typeof runOpenClaw;
  randomBytes: typeof crypto.randomBytes;
};

const DEFAULT_SHELL_API_URL = "http://localhost:3000";
const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18789";

const defaultDependencies: RuntimeEnvDependencies = {
  readJson: fs.readJson.bind(fs),
  ensureDir: fs.ensureDir.bind(fs),
  writeJson: fs.writeJson.bind(fs),
  chmod: fs.chmod.bind(fs),
  readFile: fs.readFile.bind(fs),
  getConfigValue,
  runOpenClaw,
  randomBytes: crypto.randomBytes.bind(crypto),
};

function profileStateKey(openclawProfile: string) {
  return encodeURIComponent(openclawProfile);
}

function runtimeStatePath(repoRoot: string, openclawProfile = "default") {
  if (openclawProfile === "default") {
    return path.join(repoRoot, ".chieflane", "local-state.json");
  }

  return path.join(
    repoRoot,
    ".chieflane",
    `local-state.${profileStateKey(openclawProfile)}.json`
  );
}

function runtimeStateProfileKey(
  options: Pick<ResolveRuntimeEnvOptions, "profile" | "dev"> = {},
  repoEnv: Record<string, string> = {}
) {
  const hasExplicitContext = options.dev === true || options.profile != null;
  const context = hasExplicitContext
    ? resolveOpenClawInvocationContext({
        profile: options.profile,
        dev: options.dev,
      }, repoEnv)
    : resolveOpenClawInvocationContext({}, repoEnv);
  return getOpenClawContextKey(context);
}

function normalizeValue(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stripWrappingQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function formatUrlHost(host: string) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

export function deriveGatewayUrl(args: {
  bind?: string | null;
  port: number;
}): { value: string; warnings: string[] } {
  const warnings: string[] = [];
  const bind = stripWrappingQuotes(normalizeValue(args.bind) ?? "loopback");

  if (
    bind === "loopback" ||
    bind === "127.0.0.1" ||
    bind === "localhost" ||
    bind === "0.0.0.0"
  ) {
    return {
      value: `http://127.0.0.1:${args.port}`,
      warnings,
    };
  }

  if (bind === "::1" || bind === "::") {
    return {
      value: `http://[::1]:${args.port}`,
      warnings,
    };
  }

  warnings.push(
    `Gateway bind is ${bind}; using that host for OPENCLAW_GATEWAY_URL. Override manually if this repo is not running on the gateway host.`
  );

  return {
    value: `http://${formatUrlHost(bind)}:${args.port}`,
    warnings,
  };
}

async function parseEnvFile(
  filePath: string,
  deps: RuntimeEnvDependencies
): Promise<Record<string, string>> {
  try {
    const body = await deps.readFile(filePath, "utf8");
    return dotenv.parse(body);
  } catch {
    return {};
  }
}

async function loadRepoEnvFiles(
  repoRoot: string,
  deps: RuntimeEnvDependencies
): Promise<{
  currentEnv: NodeJS.ProcessEnv;
  envFile: Record<string, string>;
  envLocalFile: Record<string, string>;
}> {
  const currentEnv = { ...process.env };
  const [envFile, envLocalFile] = await Promise.all([
    parseEnvFile(path.join(repoRoot, ".env"), deps),
    parseEnvFile(path.join(repoRoot, ".env.local"), deps),
  ]);

  return { currentEnv, envFile, envLocalFile };
}

async function readRuntimeState(
  repoRoot: string,
  options: Pick<ResolveRuntimeEnvOptions, "profile" | "dev">,
  repoEnv: Record<string, string>,
  deps: RuntimeEnvDependencies
): Promise<RuntimeEnvState> {
  try {
    return (await deps.readJson(
      runtimeStatePath(repoRoot, runtimeStateProfileKey(options, repoEnv))
    )) as RuntimeEnvState;
  } catch {
    return {};
  }
}

async function writeRuntimeState(
  repoRoot: string,
  options: Pick<ResolveRuntimeEnvOptions, "profile" | "dev">,
  repoEnv: Record<string, string>,
  partial: RuntimeEnvState,
  deps: RuntimeEnvDependencies
) {
  const target = runtimeStatePath(
    repoRoot,
    runtimeStateProfileKey(options, repoEnv)
  );
  await deps.ensureDir(path.dirname(target));
  await deps.writeJson(target, partial, { spaces: 2 });
  if (process.platform !== "win32") {
    await deps.chmod(target, 0o600).catch(() => undefined);
  }
}

function generateSecret(deps: RuntimeEnvDependencies) {
  return deps.randomBytes(32).toString("base64url");
}

async function getPlainConfigString(
  configPath: string,
  deps: RuntimeEnvDependencies
): Promise<string | null> {
  const machineReadable = await deps.runOpenClaw(
    ["config", "get", configPath, "--json"],
    { reject: false }
  );

  if (machineReadable.exitCode === 0) {
    const raw = machineReadable.stdout.trim();
    if (!raw) {
      return null;
    }

    if (raw.startsWith("env:") || raw.startsWith("secret:")) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return raw;
    }
  }

  const fallback = await deps.runOpenClaw(["config", "get", configPath], {
    reject: false,
  });
  if (fallback.exitCode !== 0) {
    return null;
  }

  const raw = fallback.stdout.trim();
  if (!raw) {
    return null;
  }

  if (
    raw.startsWith("{") ||
    raw.startsWith("[") ||
    raw.startsWith("env:") ||
    raw.startsWith("secret:")
  ) {
    return null;
  }

  return stripWrappingQuotes(raw);
}

async function discoverGatewayUrl(
  deps: RuntimeEnvDependencies
): Promise<{ value: string; source: EnvSource; warnings: string[] }> {
  const portRaw = normalizeValue(await deps.getConfigValue("gateway.port"));
  const bindRaw = normalizeValue(await deps.getConfigValue("gateway.bind"));
  const port = portRaw && /^\d+$/.test(portRaw) ? Number(portRaw) : 18789;
  const derived = deriveGatewayUrl({
    bind: bindRaw,
    port,
  });
  return {
    value: derived.value,
    source: portRaw || bindRaw ? "config" : "default",
    warnings: derived.warnings,
  };
}

async function discoverGatewayToken(
  options: {
    allowGenerateGatewayToken: boolean;
    isolatedContext: boolean;
  },
  deps: RuntimeEnvDependencies
): Promise<{ value: string; source: EnvSource; warnings: string[] }> {
  const warnings: string[] = [];
  const mode =
    stripWrappingQuotes(
      normalizeValue(await deps.getConfigValue("gateway.auth.mode")) ?? "token"
    ) || "token";
  const existing = await getPlainConfigString("gateway.auth.token", deps);

  if (existing) {
    return { value: existing, source: "config", warnings };
  }

  if (mode !== "token") {
    throw new Error(
      `Gateway auth mode is ${mode}. Automatic token discovery currently supports token auth only. Set OPENCLAW_GATEWAY_TOKEN manually or use an isolated OpenClaw profile.`
    );
  }

  if (!options.allowGenerateGatewayToken) {
    throw new Error(
      "No plaintext gateway token was discoverable. Set OPENCLAW_GATEWAY_TOKEN manually or rerun setup in an isolated profile."
    );
  }

  if (!options.isolatedContext) {
    throw new Error(
      "Refusing to generate or rotate a gateway token on the active shared profile. Use --profile <name> or --dev, or set OPENCLAW_GATEWAY_TOKEN explicitly."
    );
  }

  await deps.runOpenClaw(["doctor", "--generate-gateway-token"], {
    reject: false,
  });

  const generated = await getPlainConfigString("gateway.auth.token", deps);
  if (!generated) {
    throw new Error(
      "Tried to generate a gateway token, but could not read back gateway.auth.token."
    );
  }

  warnings.push(
    "Generated a new gateway token for the isolated OpenClaw profile."
  );
  return { value: generated, source: "generated", warnings };
}

async function discoverShellInternalApiKey(
  deps: RuntimeEnvDependencies
): Promise<string | null> {
  return getPlainConfigString(
    "plugins.entries.surface-lane.config.shellInternalApiKey",
    deps
  );
}

async function discoverShellApiUrl(
  deps: RuntimeEnvDependencies
): Promise<string | null> {
  return getPlainConfigString(
    "plugins.entries.surface-lane.config.shellApiUrl",
    deps
  );
}

export async function resolveShellApiUrl(
  options: Pick<ResolveRuntimeEnvOptions, "repoRoot" | "profile" | "dev">,
  deps: RuntimeEnvDependencies = defaultDependencies
): Promise<{ shellApiUrl: string; source: EnvSource }> {
  const { currentEnv, envFile, envLocalFile } = await loadRepoEnvFiles(
    options.repoRoot,
    deps
  );
  const repoEnv = { ...envFile, ...envLocalFile };
  const state = await readRuntimeState(options.repoRoot, options, repoEnv, deps);

  const envShellApiUrl = normalizeValue(currentEnv.SHELL_API_URL);
  const envLocalShellApiUrl = normalizeValue(envLocalFile.SHELL_API_URL);
  const envFileShellApiUrl = normalizeValue(envFile.SHELL_API_URL);
  const configShellApiUrl = await discoverShellApiUrl(deps);
  const stateShellApiUrl =
    typeof state.shellApiUrl === "string" ? normalizeValue(state.shellApiUrl) : null;

  return {
    shellApiUrl:
      envShellApiUrl ??
      envLocalShellApiUrl ??
      envFileShellApiUrl ??
      configShellApiUrl ??
      stateShellApiUrl ??
      DEFAULT_SHELL_API_URL,
    source: envShellApiUrl
      ? "env"
      : envLocalShellApiUrl
        ? "env.local"
        : envFileShellApiUrl
          ? "env"
          : configShellApiUrl
            ? "config"
          : stateShellApiUrl
            ? "state"
            : "default",
  };
}

export function summarizeRuntimeEnv(env: ResolvedRuntimeEnv): RuntimeEnvReport {
  return {
    shellApiUrl: {
      source: env.sources.shellApiUrl,
      value: env.shellApiUrl,
    },
    shellInternalApiKey: {
      source: env.sources.shellInternalApiKey,
      redacted: "[REDACTED]",
    },
    gatewayUrl: {
      source: env.sources.gatewayUrl,
      value: env.gatewayUrl,
    },
    gatewayToken: {
      source: env.sources.gatewayToken,
      redacted: "[REDACTED]",
    },
  };
}

export async function resolveRuntimeEnv(
  options: ResolveRuntimeEnvOptions,
  deps: RuntimeEnvDependencies = defaultDependencies
): Promise<ResolvedRuntimeEnv> {
  const { currentEnv, envFile, envLocalFile } = await loadRepoEnvFiles(
    options.repoRoot,
    deps
  );
  const repoEnv = { ...envFile, ...envLocalFile };
  const state = await readRuntimeState(options.repoRoot, options, repoEnv, deps);
  const warnings: string[] = [];
  const effectiveContext = resolveOpenClawInvocationContext({
    profile: options.profile,
    dev: options.dev,
  }, repoEnv);
  const isIsolatedContext = isIsolatedOpenClawContext(effectiveContext);
  const envGatewayUrl = normalizeValue(currentEnv.OPENCLAW_GATEWAY_URL);
  const envGatewayToken = normalizeValue(currentEnv.OPENCLAW_GATEWAY_TOKEN);
  const envLocalGatewayUrl = normalizeValue(envLocalFile.OPENCLAW_GATEWAY_URL);
  const envLocalGatewayToken = normalizeValue(envLocalFile.OPENCLAW_GATEWAY_TOKEN);
  const envFileGatewayUrl = normalizeValue(envFile.OPENCLAW_GATEWAY_URL);
  const envFileGatewayToken = normalizeValue(envFile.OPENCLAW_GATEWAY_TOKEN);

  const sources: ResolvedRuntimeEnv["sources"] = {
    shellApiUrl: "default",
    shellInternalApiKey: "generated",
    gatewayUrl: "default",
    gatewayToken: "config",
  };

  const { shellApiUrl, source: shellApiUrlSource } = await resolveShellApiUrl(
    {
      repoRoot: options.repoRoot,
      profile: options.profile,
      dev: options.dev,
    },
    deps
  );
  sources.shellApiUrl = shellApiUrlSource;

  const envShellInternalApiKey = normalizeValue(currentEnv.SHELL_INTERNAL_API_KEY);
  const envLocalShellInternalApiKey = normalizeValue(
    envLocalFile.SHELL_INTERNAL_API_KEY
  );
  const envFileShellInternalApiKey = normalizeValue(
    envFile.SHELL_INTERNAL_API_KEY
  );
  const configShellInternalApiKey = await discoverShellInternalApiKey(deps);
  const stateShellInternalApiKey =
    typeof state.shellInternalApiKey === "string"
      ? normalizeValue(state.shellInternalApiKey)
      : null;
  let shellInternalApiKey =
    envShellInternalApiKey ??
    envLocalShellInternalApiKey ??
    envFileShellInternalApiKey ??
    configShellInternalApiKey ??
    stateShellInternalApiKey;
  if (!shellInternalApiKey) {
    if (options.allowGenerateShellInternalApiKey === false) {
      if (options.requireShellInternalApiKey === false) {
        shellInternalApiKey = "";
      } else {
        throw new Error(
          "Could not resolve SHELL_INTERNAL_API_KEY. Rerun pnpm setup-local or pnpm bootstrap, or set SHELL_INTERNAL_API_KEY explicitly."
        );
      }
    } else {
      shellInternalApiKey = generateSecret(deps);
    }
  }
  sources.shellInternalApiKey = envShellInternalApiKey
    ? "env"
    : envLocalShellInternalApiKey
      ? "env.local"
      : envFileShellInternalApiKey
        ? "env"
        : configShellInternalApiKey
          ? "config"
          : stateShellInternalApiKey
            ? "state"
            : shellInternalApiKey
              ? "generated"
              : "unresolved";

  let gatewayUrl = envGatewayUrl;
  if (!gatewayUrl) {
    const discovered = await discoverGatewayUrl(deps);
    gatewayUrl = discovered.value;
    sources.gatewayUrl = discovered.source;
    warnings.push(...discovered.warnings);
  } else {
    sources.gatewayUrl = "env";
  }

  let gatewayToken = envGatewayToken;
  if (!gatewayToken) {
    try {
      const discovered = await discoverGatewayToken(
        {
          allowGenerateGatewayToken: options.allowGenerateGatewayToken,
          isolatedContext: isIsolatedContext,
        },
        deps
      );
      gatewayToken = discovered.value;
      sources.gatewayToken = discovered.source;
      warnings.push(...discovered.warnings);
    } catch (error) {
      if (!isIsolatedContext && (envLocalGatewayToken || envFileGatewayToken)) {
        gatewayToken = envLocalGatewayToken ?? envFileGatewayToken;
        sources.gatewayToken = envLocalGatewayToken ? "env.local" : "env";
        warnings.push(
          "Using repo OPENCLAW_GATEWAY_TOKEN because the shared OpenClaw profile does not expose a plaintext gateway token."
        );
      } else {
        throw error;
      }
    }
  } else {
    sources.gatewayToken = "env";
  }

  if (isIsolatedContext) {
    const ignoredGatewaySources = [
      envLocalGatewayUrl ? ".env.local OPENCLAW_GATEWAY_URL" : null,
      envLocalGatewayToken ? ".env.local OPENCLAW_GATEWAY_TOKEN" : null,
      envFileGatewayUrl ? ".env OPENCLAW_GATEWAY_URL" : null,
      envFileGatewayToken ? ".env OPENCLAW_GATEWAY_TOKEN" : null,
    ].filter((value): value is string => value != null);
    if (ignoredGatewaySources.length > 0) {
      warnings.push(
        `Ignoring gateway env overrides for isolated OpenClaw context (${getOpenClawProfileLabel(effectiveContext)}): ${ignoredGatewaySources.join(", ")}.`
      );
    }
  }

  if (options.persistGeneratedValues !== false) {
    await writeRuntimeState(
      options.repoRoot,
      options,
      repoEnv,
      {
        ...(sources.shellApiUrl !== "env" ? { shellApiUrl } : {}),
        ...(shellInternalApiKey ? { shellInternalApiKey } : {}),
      },
      deps
    );
  }

  return {
    shellApiUrl,
    shellInternalApiKey,
    gatewayUrl: gatewayUrl ?? DEFAULT_GATEWAY_URL,
    gatewayToken: gatewayToken!,
    sources,
    warnings,
  };
}
