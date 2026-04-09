import type { ManifestCronJob } from "./manifest";
import { runOpenClaw } from "./openclaw";
import type { InstallReport } from "./report";

type ListedCronJob = {
  id?: string;
  name?: string;
};

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

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseListedCronJobs(value: string) {
  const parsed = safeJsonParse<unknown>(value, null);
  if (!Array.isArray(parsed)) {
    throw new Error("Unable to parse `openclaw cron list --json` output.");
  }

  return parsed as ListedCronJob[];
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

  for (const job of opts.cronJobs) {
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
  }
}
