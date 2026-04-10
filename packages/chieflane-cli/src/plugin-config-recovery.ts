import path from "node:path";
import fs from "fs-extra";
import JSON5 from "json5";
import type { InstallReport } from "./report";
import { resolveOpenClawPaths } from "./openclaw-paths";
import type { OpenClawInvocationContext } from "./openclaw";
import { runOpenClaw } from "./openclaw";
import { resolveSeedShellEnv, type ResolvedSeedShellEnv } from "./runtime-env";

type RecoveryResult = {
  touched: boolean;
  configPath: string;
  backupPath?: string;
  reason?: string;
};

function ensureObject<T extends Record<string, unknown>>(value: unknown): T {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : ({} as T);
}

export async function preseedSurfaceLaneConfigIfNeeded(args: {
  context: OpenClawInvocationContext;
  shellApiUrl: string;
  shellInternalApiKey: string;
  report?: Pick<InstallReport, "changed" | "warnings">;
}): Promise<RecoveryResult> {
  const { configPath, stateDir } = resolveOpenClawPaths({
    context: args.context,
  });
  const extensionDir = path.join(stateDir.value, "extensions", "surface-lane");
  const configExists = await fs.pathExists(configPath.value);
  const extensionExists = await fs.pathExists(extensionDir);

  if (!configExists && !extensionExists) {
    return {
      touched: false,
      configPath: configPath.value,
      reason: "no-config-no-extension",
    };
  }

  const raw = configExists ? await fs.readFile(configPath.value, "utf8") : "{}";
  const parsed = ensureObject<Record<string, unknown>>(JSON5.parse(raw || "{}"));
  const plugins = ensureObject<Record<string, unknown>>(parsed.plugins);
  const entries = ensureObject<Record<string, unknown>>(plugins.entries);
  const existingEntry = ensureObject<Record<string, unknown>>(entries["surface-lane"]);
  const existingConfig = ensureObject<Record<string, unknown>>(existingEntry.config);

  if (!extensionExists && Object.keys(existingEntry).length === 0) {
    return {
      touched: false,
      configPath: configPath.value,
      reason: "no-surface-lane-entry",
    };
  }

  const missingShellApiUrl =
    typeof existingConfig.shellApiUrl !== "string" || existingConfig.shellApiUrl.length === 0;
  const missingInternalKey =
    typeof existingConfig.shellInternalApiKey !== "string" ||
    existingConfig.shellInternalApiKey.length === 0;

  if (!missingShellApiUrl && !missingInternalKey) {
    return {
      touched: false,
      configPath: configPath.value,
      reason: "config-already-complete",
    };
  }

  const nextEntry: Record<string, unknown> = {
    ...existingEntry,
    enabled:
      typeof existingEntry.enabled === "boolean" ? existingEntry.enabled : true,
    config: {
      ...existingConfig,
      shellApiUrl: missingShellApiUrl
        ? args.shellApiUrl
        : existingConfig.shellApiUrl,
      shellInternalApiKey: missingInternalKey
        ? args.shellInternalApiKey
        : existingConfig.shellInternalApiKey,
    },
  };

  const next = {
    ...parsed,
    plugins: {
      ...plugins,
      entries: {
        ...entries,
        "surface-lane": nextEntry,
      },
    },
  };

  const backupPath = `${configPath.value}.chieflane-backup.${Date.now()}.json5`;
  if (configExists) {
    await fs.copy(configPath.value, backupPath, { overwrite: false });
  } else {
    await fs.ensureDir(path.dirname(configPath.value));
  }

  await fs.writeFile(
    configPath.value,
    `${JSON5.stringify(next, null, 2)}\n`,
    "utf8"
  );

  args.report?.changed.push({
    kind: "config-recovery",
    action: "preseed-surface-lane-config",
    configPath: configPath.value,
    backupPath,
  });

  return {
    touched: true,
    configPath: configPath.value,
    backupPath,
  };
}

export async function ensureRecoveredSurfaceLaneConfig(args: {
  repoRoot: string;
  context: OpenClawInvocationContext;
  report?: Pick<InstallReport, "changed" | "warnings">;
}): Promise<{
  seedShellEnv: ResolvedSeedShellEnv;
  recovery: RecoveryResult;
}> {
  const seedShellEnv = await resolveSeedShellEnv({
    repoRoot: args.repoRoot,
    profile: args.context.profile,
    dev: args.context.dev,
    persistGeneratedValues: true,
  });

  const recovery = await preseedSurfaceLaneConfigIfNeeded({
    context: args.context,
    shellApiUrl: seedShellEnv.shellApiUrl,
    shellInternalApiKey: seedShellEnv.shellInternalApiKey,
    report: args.report,
  });

  const validate = await runOpenClaw(["config", "validate", "--json"], {
    reject: false,
    profile: args.context.profile,
    dev: args.context.dev,
  });

  if (validate.exitCode !== 0) {
    const detail =
      validate.stderr.trim() || validate.stdout.trim() || "Unknown validation error";
    const backupHint = recovery.backupPath
      ? ` Backup: ${recovery.backupPath}.`
      : "";
    throw new Error(
      `OpenClaw config is invalid after Chieflane surface-lane recovery. Config: ${recovery.configPath}.${backupHint} ${detail}`
    );
  }

  return {
    seedShellEnv,
    recovery,
  };
}
