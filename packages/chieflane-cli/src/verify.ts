import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { findRepoRoot } from "./manifest";
import {
  getConfigValue,
  getWorkspacePath,
  resolveWorkspacePath,
  runOpenClaw,
} from "./openclaw";
import { createInstallReport, type InstallReport } from "./report";
import { readLastBootstrapState } from "./state";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireEnv(name: string, env: NodeJS.ProcessEnv) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const VERIFY_REQUIRED_ENV_NAMES = [
  "SHELL_API_URL",
  "OPENCLAW_GATEWAY_URL",
  "OPENCLAW_GATEWAY_TOKEN",
] as const;

export function getMissingVerifyEnvNames(env: NodeJS.ProcessEnv) {
  return VERIFY_REQUIRED_ENV_NAMES.filter((name) => !env[name]);
}

export function getWorkspaceSkillPath(workspace: string, slug: string) {
  return path.join(workspace, ".agents", "skills", slug, "SKILL.md");
}

export function getMissingWorkspaceSkills(workspace: string, slugs: string[]) {
  return slugs.filter((slug) => !fs.existsSync(getWorkspaceSkillPath(workspace, slug)));
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

function getShellHealthUrl(shellApiUrl: string) {
  return new URL("/api/health", shellApiUrl.endsWith("/") ? shellApiUrl : `${shellApiUrl}/`).toString();
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
  explicitWorkspace?: string
) {
  if (explicitWorkspace && explicitWorkspace !== "auto") {
    return resolveWorkspacePath(explicitWorkspace);
  }

  const lastBootstrap = await readLastBootstrapState(repoRoot);
  if (lastBootstrap?.workspace) {
    return resolveWorkspacePath(lastBootstrap.workspace);
  }

  return getWorkspacePath();
}

export async function runVerify(options: { full?: boolean; workspace?: string }) {
  const repoRoot = findRepoRoot();
  dotenv.config({ path: path.join(repoRoot, ".env") });

  const workspace = await resolveVerifyWorkspace(repoRoot, options.workspace);
  const report = createInstallReport({
    workspace,
    mode: "live",
  });
  const missing = getMissingVerifyEnvNames(process.env);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  await runVerifyInternal({
    full: options.full === true,
    report,
    workspace,
  });

  return report;
}

export async function runVerifyInternal(args: {
  full: boolean;
  report: InstallReport;
  workspace: string;
}) {
  const shellApiUrl = requireEnv("SHELL_API_URL", process.env);
  const gatewayUrl = requireEnv("OPENCLAW_GATEWAY_URL", process.env);
  const gatewayToken = requireEnv("OPENCLAW_GATEWAY_TOKEN", process.env);

  let hasFailures = false;

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
