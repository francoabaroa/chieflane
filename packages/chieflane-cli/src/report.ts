import fs from "fs-extra";
import path from "node:path";
import { isSensitiveConfigPath, redactValue } from "./sensitive";

export type ReportItem = Record<string, unknown>;

export type InstallReport = {
  workspace: string;
  mode: "live" | "demo";
  startedAt: string;
  finishedAt?: string;
  changed: ReportItem[];
  skipped: ReportItem[];
  checks: ReportItem[];
  warnings: ReportItem[];
  errors: ReportItem[];
};

export type DoctorReport = {
  workspace: string;
  startedAt: string;
  finishedAt?: string;
  checks: ReportItem[];
};

export function createInstallReport(args: {
  workspace: string;
  mode: "live" | "demo";
}): InstallReport {
  return {
    workspace: args.workspace,
    mode: args.mode,
    startedAt: new Date().toISOString(),
    changed: [],
    skipped: [],
    checks: [],
    warnings: [],
    errors: [],
  };
}

export function createDoctorReport(workspace: string): DoctorReport {
  return {
    workspace,
    startedAt: new Date().toISOString(),
    checks: [],
  };
}

export function chieflaneDir(workspace: string) {
  return path.join(workspace, ".chieflane");
}

export function backupDir(workspace: string) {
  return path.join(chieflaneDir(workspace), "backups");
}

function backupTimestamp(value: Date) {
  return value.toISOString().replaceAll(":", "-");
}

export async function createBackup(
  workspace: string,
  targetPath: string
): Promise<string> {
  const destination = path.join(
    backupDir(workspace),
    `${path.basename(targetPath)}.${backupTimestamp(new Date())}.bak`
  );

  await fs.ensureDir(path.dirname(destination));
  await fs.copy(targetPath, destination, { overwrite: true });
  return destination;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function sanitizeReportItem(item: ReportItem): ReportItem {
  if (
    item.kind === "config" &&
    typeof item.path === "string" &&
    isSensitiveConfigPath(item.path)
  ) {
    return {
      ...item,
      value: redactValue(item.value),
      sensitive: true,
    };
  }

  return item;
}

function formatItems(items: ReportItem[]) {
  if (items.length === 0) {
    return "- none";
  }

  return items
    .map((item) => {
      const pairs = Object.entries(item).map(([key, value]) => `${key}=${formatValue(value)}`);
      return `- ${pairs.join(", ")}`;
    })
    .join("\n");
}

function installReportMarkdown(report: InstallReport) {
  const changed = report.changed.map(sanitizeReportItem);
  const skipped = report.skipped.map(sanitizeReportItem);
  const checks = report.checks.map(sanitizeReportItem);
  const warnings = report.warnings.map(sanitizeReportItem);
  const errors = report.errors.map(sanitizeReportItem);

  return [
    "# Chieflane Install Report",
    "",
    `- workspace: ${report.workspace}`,
    `- mode: ${report.mode}`,
    `- startedAt: ${report.startedAt}`,
    `- finishedAt: ${report.finishedAt ?? ""}`,
    "",
    "## Changed",
    formatItems(changed),
    "",
    "## Skipped",
    formatItems(skipped),
    "",
    "## Checks",
    formatItems(checks),
    "",
    "## Warnings",
    formatItems(warnings),
    "",
    "## Errors",
    formatItems(errors),
    "",
  ].join("\n");
}

export async function writeInstallReport(
  workspace: string,
  report: InstallReport
) {
  report.finishedAt = new Date().toISOString();
  const sanitizedReport: InstallReport = {
    ...report,
    changed: report.changed.map(sanitizeReportItem),
    skipped: report.skipped.map(sanitizeReportItem),
    checks: report.checks.map(sanitizeReportItem),
    warnings: report.warnings.map(sanitizeReportItem),
    errors: report.errors.map(sanitizeReportItem),
  };

  const root = chieflaneDir(workspace);
  await fs.ensureDir(root);

  await fs.writeJson(path.join(root, "install-report.json"), sanitizedReport, {
    spaces: 2,
  });
  await fs.writeFile(
    path.join(root, "install-report.md"),
    installReportMarkdown(sanitizedReport),
    "utf8"
  );
}

export async function writeDoctorReport(
  workspace: string,
  report: DoctorReport
) {
  report.finishedAt = new Date().toISOString();
  const root = chieflaneDir(workspace);
  await fs.ensureDir(root);
  await fs.writeJson(path.join(root, "doctor-report.json"), report, {
    spaces: 2,
  });
}
