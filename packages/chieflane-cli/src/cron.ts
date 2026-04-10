import type { ManifestCronJob } from "./manifest";
import { findRepoRoot, loadManifest } from "./manifest";
import {
  createInstallReport,
  type InstallReport,
} from "./report";
import {
  getOpenClawProfileLabel,
  primeOpenClawInvocationContext,
  runOpenClaw,
} from "./openclaw";
import { ensureRecoveredSurfaceLaneConfig } from "./plugin-config-recovery";

type ListedCronJob = {
  id?: string;
  name?: string;
};

const ANSI_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export function buildCronArgs(job: {
  name: string;
  cron: string;
  timezone: string;
  timeoutSeconds: number;
  message: string;
}) {
  return [
    "--session",
    "isolated",
    "--no-deliver",
    "--tz",
    job.timezone,
    "--timeout-seconds",
    String(job.timeoutSeconds),
    "--message",
    job.message,
  ];
}

function stripAnsi(value: string) {
  return value.replace(ANSI_RE, "");
}

function extractFirstJsonBlock(text: string) {
  const input = stripAnsi(text).trim();
  const starts = ["{", "["]
    .map((token) => input.indexOf(token))
    .filter((index) => index >= 0);

  if (starts.length === 0) {
    return null;
  }

  const start = Math.min(...starts);
  const opener = input[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const ch = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === opener) {
      depth += 1;
    } else if (ch === closer) {
      depth -= 1;
    }

    if (depth === 0) {
      return input.slice(start, index + 1);
    }
  }

  return null;
}

export function parseListedCronJobs(value: string) {
  const jsonBlock = extractFirstJsonBlock(value);
  if (!jsonBlock) {
    throw new Error("Unable to find JSON in `openclaw cron list --json` output.");
  }

  const parsed = JSON.parse(jsonBlock) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as ListedCronJob[];
  }

  if (
    parsed != null &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { jobs?: unknown }).jobs)
  ) {
    return (parsed as { jobs: ListedCronJob[] }).jobs;
  }

  throw new Error(
    "Expected `openclaw cron list --json` to return either an array or an object with a `jobs` array."
  );
}

export async function upsertCronJobs(opts: {
  cronJobs: ManifestCronJob[];
  dryRun: boolean;
  report: InstallReport;
}) {
  let listedJobs: ListedCronJob[] = [];
  if (!opts.dryRun) {
    const listed = await runOpenClaw(["cron", "list", "--json"], {
      reject: false,
    });
    if (listed.exitCode !== 0) {
      throw new Error(
        listed.stderr?.trim() ||
          listed.stdout?.trim() ||
          "`openclaw cron list --json` failed."
      );
    }
    listedJobs = parseListedCronJobs(listed.stdout.trim());
  }

  const existingByName = new Map(
    listedJobs
      .filter((job) => typeof job.name === "string" && typeof job.id === "string")
      .map((job) => [job.name as string, job.id as string])
  );
  const failures: Array<{ name: string; error: string }> = [];

  for (const job of opts.cronJobs) {
    try {
      const argsBase = buildCronArgs(job);
      const existingId = existingByName.get(job.name);

      if (existingId) {
        const args = ["cron", "edit", existingId, "--cron", job.cron, ...argsBase];
        if (!opts.dryRun) {
          await runOpenClaw(args);
        }
        opts.report.changed.push({
          kind: "cron",
          name: job.name,
          id: existingId,
          action: opts.dryRun ? "would-edit" : "edited",
        });
        continue;
      }

      const args = ["cron", "add", "--name", job.name, "--cron", job.cron, ...argsBase];
      if (!opts.dryRun) {
        await runOpenClaw(args);
      }
      opts.report.changed.push({
        kind: "cron",
        name: job.name,
        action: opts.dryRun ? "would-add" : "added",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ name: job.name, error: message });
      opts.report.errors.push({
        kind: "cron",
        error: `${job.name}: ${message}`,
      });
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Cron sync incomplete. Failed jobs: ${failures.map((failure) => failure.name).join(", ")}`
    );
  }
}

export async function runSyncCron(options: { profile?: string; dev?: boolean } = {}) {
  const repoRoot = findRepoRoot();
  const context = primeOpenClawInvocationContext({
    repoRoot,
    profile: options.profile,
    dev: options.dev === true,
  });
  await ensureRecoveredSurfaceLaneConfig({
    repoRoot,
    context,
  });

  const manifest = await loadManifest(repoRoot);
  const report = createInstallReport({
    workspace: "cron-sync",
    mode: "live",
  });
  report.openclawProfile = getOpenClawProfileLabel(context);

  await upsertCronJobs({
    cronJobs: manifest.openclaw.cron,
    dryRun: false,
    report,
  });

  console.log(
    `Cron sync complete for ${report.openclawProfile ?? "default"}: ${report.changed.length} jobs updated.`
  );
  return report;
}
