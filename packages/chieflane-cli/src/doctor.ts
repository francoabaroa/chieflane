import { findRepoRoot, getRequiredEnvNames, loadManifest } from "./manifest";
import {
  defaultWorkspacePath,
  getOpenClawProfileLabel,
  getWorkspacePath,
  primeOpenClawInvocationContext,
  runOpenClaw,
} from "./openclaw";
import {
  createDoctorReport,
  type DoctorReport,
  writeDoctorReport,
} from "./report";
import { resolveShellApiUrl } from "./runtime-env";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function recordCheck(
  report: DoctorReport,
  kind: string,
  fn: () => Promise<Record<string, unknown>>
) {
  try {
    const details = await fn();
    report.checks.push({
      kind,
      ok: true,
      ...details,
    });
  } catch (error) {
    report.checks.push({
      kind,
      ok: false,
      error: errorMessage(error),
    });
  }
}

export async function runDoctor(options: { profile?: string; dev?: boolean } = {}) {
  const repoRoot = findRepoRoot();
  const context = primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });

  const manifest = await loadManifest(repoRoot);
  const report = createDoctorReport(defaultWorkspacePath());

  try {
    await recordCheck(report, "workspace-resolution", async () => {
      const workspace = await getWorkspacePath();
      report.workspace = workspace;
      return { workspace };
    });

    await recordCheck(report, "env", async () => {
      const missing = getRequiredEnvNames(manifest).filter((name) => !process.env[name]);
      if (missing.length > 0) {
        throw new Error(`Missing required env vars: ${missing.join(", ")}`);
      }
      return { missing };
    });

    await recordCheck(report, "openclaw-status", async () => {
      const result = await runOpenClaw(["status"], { reject: false });
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || "openclaw status failed");
      }
      return { stdout: result.stdout.trim() };
    });

    await recordCheck(report, "gateway-status", async () => {
      const result = await runOpenClaw(["gateway", "status"], { reject: false });
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || "openclaw gateway status failed");
      }
      return { stdout: result.stdout.trim() };
    });

    await recordCheck(report, "doctor-json", async () => {
      const result = await runOpenClaw(["doctor", "--json"], { reject: false });
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || "openclaw doctor --json failed");
      }
      return { stdout: result.stdout.trim() };
    });

    await recordCheck(report, "plugins-doctor", async () => {
      const result = await runOpenClaw(["plugins", "doctor"], { reject: false });
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || "openclaw plugins doctor failed");
      }
      return { stdout: result.stdout.trim() };
    });

    await recordCheck(report, "plugin-inspect", async () => {
      const result = await runOpenClaw(["plugins", "inspect", "surface-lane", "--json"], {
        reject: false,
      });
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || "surface-lane inspect failed");
      }
      return { stdout: result.stdout.trim() };
    });

    await recordCheck(report, "skills-check", async () => {
      const result = await runOpenClaw(["skills", "check", "--json"], {
        reject: false,
      });
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || "openclaw skills check failed");
      }
      return { stdout: result.stdout.trim() };
    });

    await recordCheck(report, "shell-health", async () => {
      const { shellApiUrl, source } = await resolveShellApiUrl({
        repoRoot,
        profile: context.profile,
        dev: context.dev,
      });
      const response = await fetch(`${shellApiUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Shell health failed (${response.status})`);
      }
      const body = (await response.json()) as Record<string, unknown>;
      return {
        ...body,
        shellApiUrl,
        shellApiUrlSource: source,
        openclawProfile: getOpenClawProfileLabel(context),
      };
    });

    return report;
  } finally {
    await writeDoctorReport(report.workspace, report);
  }
}
