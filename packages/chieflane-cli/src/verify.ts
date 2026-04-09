import fs from "node:fs";
import { findRepoRoot } from "./manifest";
import {
  getShellHealthUrl,
  isLocalShellUrl,
  withTemporaryShellIfNeeded,
} from "./local-shell";
import {
  getOpenClawContextKey,
  getOpenClawProfileLabel,
  getConfigValue,
  getWorkspacePath,
  type OpenClawInvocationContext,
  primeOpenClawInvocationContext,
  resolveWorkspacePath,
  runOpenClaw,
} from "./openclaw";
import { createInstallReport, type InstallReport } from "./report";
import {
  resolveRuntimeEnv,
  summarizeRuntimeEnv,
  type ResolvedRuntimeEnv,
} from "./runtime-env";
import { getWorkspaceSkillCandidates } from "./skills";
import { readLastBootstrapState } from "./state";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function getMissingWorkspaceSkills(workspace: string, slugs: string[]) {
  return slugs.filter(
    (slug) =>
      !getWorkspaceSkillCandidates(workspace, slug).some((filePath) =>
        fs.existsSync(filePath)
      )
  );
}

export function getMissingSkillsForVerification(args: {
  workspace: string;
  desired: string[];
  visibleSlugs?: Iterable<string> | null;
}) {
  const workspaceMissing = getMissingWorkspaceSkills(args.workspace, args.desired);
  const visibleSet =
    args.visibleSlugs == null ? null : new Set(Array.from(args.visibleSlugs));
  const visibleMissing =
    visibleSet == null
      ? []
      : args.desired.filter((slug) => !visibleSet.has(slug));

  return Array.from(new Set([...workspaceMissing, ...visibleMissing]));
}

async function invokeTool(
  gatewayUrl: string,
  gatewayToken: string,
  tool: string,
  args: Record<string, unknown>
) {
  const response = await fetch(`${gatewayUrl}/tools/invoke`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${gatewayToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tool,
      action: "json",
      args,
      sessionKey: "main",
      dryRun: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tool ${tool} failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { ok?: boolean; error?: unknown };
  if (body.ok === false) {
    throw new Error(`Tool ${tool} returned error: ${JSON.stringify(body.error)}`);
  }

  return body;
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function runCheck(
  report: InstallReport,
  kind: string,
  fn: () => Promise<Record<string, unknown> | void>
) {
  try {
    const details = (await fn()) ?? {};
    report.checks.push({
      kind,
      ok: true,
      ...details,
    });
    return true;
  } catch (error) {
    report.checks.push({
      kind,
      ok: false,
      error: errorMessage(error),
    });
    report.errors.push({
      kind,
      error: errorMessage(error),
    });
    return false;
  }
}

export async function resolveVerifyWorkspace(
  repoRoot: string,
  explicitWorkspace?: string,
  context?: OpenClawInvocationContext,
  getWorkspacePathFn: typeof getWorkspacePath = getWorkspacePath
) {
  if (explicitWorkspace && explicitWorkspace !== "auto") {
    return resolveWorkspacePath(explicitWorkspace);
  }

  const lastBootstrap = await readLastBootstrapState(repoRoot);
  const expectedProfile = getOpenClawProfileLabel(context);
  const expectedContextKey = getOpenClawContextKey(context);
  const cachedContextKey =
    lastBootstrap?.openclawContext != null
      ? getOpenClawContextKey(lastBootstrap.openclawContext)
      : lastBootstrap?.openclawProfile;
  if (
    lastBootstrap?.workspace &&
    typeof cachedContextKey === "string" &&
    cachedContextKey === expectedContextKey
  ) {
    return resolveWorkspacePath(lastBootstrap.workspace);
  }

  if (
    lastBootstrap?.workspace &&
    lastBootstrap.openclawProfile == null &&
    expectedProfile === "default"
  ) {
    return resolveWorkspacePath(lastBootstrap.workspace);
  }

  return getWorkspacePathFn();
}

export type VerifyOptions = {
  full?: boolean;
  workspace?: string;
  ensureShell?: "auto" | "never";
  profile?: string;
  dev?: boolean;
};

type VerifyDependencies = {
  findRepoRoot: typeof findRepoRoot;
  resolveVerifyWorkspace: typeof resolveVerifyWorkspace;
  createInstallReport: typeof createInstallReport;
  resolveRuntimeEnv: typeof resolveRuntimeEnv;
  withTemporaryShellIfNeeded: typeof withTemporaryShellIfNeeded;
  runVerifyInternal: typeof runVerifyInternal;
  primeOpenClawInvocationContext: typeof primeOpenClawInvocationContext;
};

const defaultDependencies: VerifyDependencies = {
  findRepoRoot,
  resolveVerifyWorkspace,
  createInstallReport,
  resolveRuntimeEnv,
  withTemporaryShellIfNeeded,
  runVerifyInternal,
  primeOpenClawInvocationContext,
};

export async function runVerify(
  options: VerifyOptions,
  deps: VerifyDependencies = defaultDependencies
) {
  const repoRoot = deps.findRepoRoot();
  const context = deps.primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });
  const workspace = await deps.resolveVerifyWorkspace(
    repoRoot,
    options.workspace,
    context
  );
  const report = deps.createInstallReport({
    workspace,
    mode: "live",
  });
  report.openclawProfile = getOpenClawProfileLabel(context);

  const runtimeEnv = await deps.resolveRuntimeEnv({
    repoRoot,
    allowGenerateGatewayToken: false,
    allowGenerateShellInternalApiKey: false,
    requireShellInternalApiKey: false,
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

  const runner = async () =>
    deps.runVerifyInternal({
      full: options.full === true,
      report,
      workspace,
      runtimeEnv,
    });

  if (options.ensureShell === "never") {
    await runner();
  } else if (!runtimeEnv.shellInternalApiKey) {
    await runner();
  } else if (!isLocalShellUrl(runtimeEnv.shellApiUrl)) {
    await runner();
  } else {
    await deps.withTemporaryShellIfNeeded({
      repoRoot,
      runtimeEnv,
      openclawProfile: getOpenClawContextKey(context),
      run: runner,
    });
  }

  return report;
}

export async function runVerifyInternal(args: {
  full: boolean;
  report: InstallReport;
  workspace: string;
  runtimeEnv: ResolvedRuntimeEnv;
}) {
  const shellApiUrl = args.runtimeEnv.shellApiUrl;
  const gatewayUrl = args.runtimeEnv.gatewayUrl;
  const gatewayToken = args.runtimeEnv.gatewayToken;

  let hasFailures = false;

  hasFailures =
    !(await runCheck(args.report, "env-resolution", async () => ({
      shellApiUrlSource: args.runtimeEnv.sources.shellApiUrl,
      shellInternalApiKeySource: args.runtimeEnv.sources.shellInternalApiKey,
      gatewayUrlSource: args.runtimeEnv.sources.gatewayUrl,
      gatewayTokenSource: args.runtimeEnv.sources.gatewayToken,
    }))) || hasFailures;

  hasFailures =
    !(await runCheck(args.report, "gateway-status", async () => {
      const result = await runOpenClaw(["gateway", "status"]);
      return { stdout: result.stdout.trim() };
    })) || hasFailures;

  hasFailures =
    !(await runCheck(args.report, "doctor", async () => {
      const result = await runOpenClaw(["doctor", "--json"], {
        reject: false,
      });
      if (result.exitCode !== 0) {
        const fallback = await runOpenClaw(["doctor"], { reject: false });
        if (fallback.exitCode !== 0) {
          throw new Error(fallback.stderr || fallback.stdout || "openclaw doctor failed");
        }
        return { stdout: fallback.stdout.trim() };
      }
      return { stdout: result.stdout.trim() };
    })) || hasFailures;

  hasFailures =
    !(await runCheck(args.report, "responses-enabled", async () => {
      const value = await getConfigValue("gateway.http.endpoints.responses.enabled");
      if (!value || value !== "true") {
        throw new Error(`Expected responses endpoint enabled, received: ${value ?? "unset"}`);
      }
      return { value };
    })) || hasFailures;

  hasFailures =
    !(await runCheck(args.report, "plugin-installed", async () => {
      const result = await runOpenClaw(["plugins", "inspect", "surface-lane", "--json"]);
      return { stdout: result.stdout.trim() };
    })) || hasFailures;

  hasFailures =
    !(await runCheck(args.report, "plugin-enabled", async () => {
      const result = await runOpenClaw(["plugins", "inspect", "surface-lane", "--json"]);
      const parsed = safeJsonParse<Record<string, unknown>>(result.stdout, {});
      const enabled =
        parsed.enabled ??
        parsed.isEnabled ??
        (typeof parsed.status === "string" ? parsed.status === "enabled" : undefined);
      if (enabled === false) {
        throw new Error("surface-lane plugin is installed but disabled");
      }
      return { enabled: enabled ?? "unknown" };
    })) || hasFailures;

  hasFailures =
    !(await runCheck(args.report, "skills-present", async () => {
      const desired = [
        "chief-shell",
        "morning-ops",
        "meeting-ops",
        "relationship-context",
      ];

      const listed = await runOpenClaw(["skills", "list", "--json"], {
        reject: false,
      });

      let visibleSlugs: Set<string> | null = null;
      if (listed.exitCode === 0 && listed.stdout.trim()) {
        const parsed = safeJsonParse<Array<Record<string, unknown>>>(listed.stdout, []);
        visibleSlugs = new Set(
          parsed
            .map((entry) => {
              const slug = entry.slug ?? entry.id ?? entry.name;
              return typeof slug === "string" ? slug : null;
            })
            .filter((value): value is string => Boolean(value))
        );
      }

      const missing = getMissingSkillsForVerification({
        workspace: args.workspace,
        desired,
        visibleSlugs,
      });

      if (missing.length > 0) {
        throw new Error(`Missing skills: ${missing.join(", ")}`);
      }

      return { slugs: desired };
    })) || hasFailures;

  hasFailures =
    !(await runCheck(args.report, "shell-health", async () => {
      const response = await fetch(getShellHealthUrl(shellApiUrl));
      if (!response.ok) {
        throw new Error(`Shell health failed (${response.status})`);
      }

      const body = (await response.json()) as Record<string, unknown>;
      if (body.ok !== true) {
        throw new Error(`Shell health returned not ok: ${JSON.stringify(body)}`);
      }

      return body;
    })) || hasFailures;

  if (args.full) {
    const surfaceKey = `verify:chieflane:${Date.now()}`;

    hasFailures =
      !(await runCheck(args.report, "tool-roundtrip", async () => {
        await invokeTool(gatewayUrl, gatewayToken, "surface_publish", {
          surfaceKey,
          lane: "ops",
          status: "ready",
          title: "Chieflane verify publish",
          summary: "Verification publish succeeded",
          payload: {
            surfaceType: "brief",
            data: {
              headline: "Verification surface",
              sections: [
                {
                  title: "Status",
                  body: "Published successfully",
                  tone: "good",
                },
              ],
              metrics: [],
            },
          },
          actions: [],
          fallbackText: "Verification publish succeeded",
          freshness: {
            generatedAt: new Date().toISOString(),
          },
        });

        await invokeTool(gatewayUrl, gatewayToken, "surface_patch", {
          surfaceKey,
          patch: {
            status: "done",
            summary: "Verification patch succeeded",
          },
        });

        await invokeTool(gatewayUrl, gatewayToken, "surface_close", {
          surfaceKey,
          finalStatus: "archived",
        });

        return {
          tool: "surface_publish/surface_patch/surface_close",
          surfaceKey,
        };
      })) || hasFailures;
  }

  if (hasFailures) {
    throw new Error("Verification failed. Review the recorded checks for details.");
  }
}
