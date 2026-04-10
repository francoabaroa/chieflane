import fs from "fs-extra";
import path from "node:path";
import type { PreflightPlan } from "./preflight-types";
import type { RuntimeEnvReport } from "./runtime-env";
import { isSensitiveConfigPath, redactValue } from "./sensitive";

export type ReportItem = Record<string, unknown>;

export type InstallReport = {
  workspace: string;
  mode: "live" | "demo";
  openclawProfile?: string;
  preflight?: PreflightPlan;
  gatewayScopedChanges: Array<{
    kind: "config" | "plugin" | "gateway-restart";
    label: string;
  }>;
  runtimeEnv?: RuntimeEnvReport;
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
  openclawProfile?: string;
  preflight?: PreflightPlan;
  startedAt: string;
  finishedAt?: string;
  checks: ReportItem[];
};

export type VerifyReport = {
  workspace: string;
  openclawProfile?: string;
  preflight?: PreflightPlan;
  runtimeEnv?: RuntimeEnvReport;
  startedAt: string;
  finishedAt?: string;
  changed: ReportItem[];
  checks: ReportItem[];
  warnings: ReportItem[];
  errors: ReportItem[];
  summary?: {
    ok: boolean;
    firstFailedKind?: string;
    failedKinds: string[];
  };
};

export function createInstallReport(args: {
  workspace: string;
  mode: "live" | "demo";
}): InstallReport {
  return {
    workspace: args.workspace,
    mode: args.mode,
    gatewayScopedChanges: [],
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

export function createVerifyReport(args: { workspace: string }): VerifyReport {
  return {
    workspace: args.workspace,
    startedAt: new Date().toISOString(),
    changed: [],
    checks: [],
    warnings: [],
    errors: [],
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
  const gatewayScopedChanges = report.gatewayScopedChanges.map((item) => ({
    kind: item.kind,
    label: item.label,
  }));
  const runtimeEnv = report.runtimeEnv == null
    ? []
    : [
        {
          key: "shellApiUrl",
          source: report.runtimeEnv.shellApiUrl.source,
          value: report.runtimeEnv.shellApiUrl.value,
        },
        {
          key: "shellInternalApiKey",
          source: report.runtimeEnv.shellInternalApiKey.source,
          redacted: report.runtimeEnv.shellInternalApiKey.redacted,
        },
        {
          key: "gatewayUrl",
          source: report.runtimeEnv.gatewayUrl.source,
          value: report.runtimeEnv.gatewayUrl.value,
        },
        {
          key: "gatewayToken",
          source: report.runtimeEnv.gatewayToken.source,
          redacted: report.runtimeEnv.gatewayToken.redacted,
        },
      ];
  const preflightContext =
    report.preflight == null
      ? []
      : [
          {
            key: "profile",
            value: report.preflight.openclaw.profile,
          },
          {
            key: "contextKey",
            value: report.preflight.openclaw.contextKey,
          },
          {
            key: "stateDir",
            source: report.preflight.openclaw.stateDir.source,
            value: report.preflight.openclaw.stateDir.value,
          },
          {
            key: "configPath",
            source: report.preflight.openclaw.configPath.source,
            value: report.preflight.openclaw.configPath.value,
          },
          {
            key: "workspace",
            source: report.preflight.openclaw.workspace.source,
            value: report.preflight.openclaw.workspace.value,
          },
          {
            key: "gatewayPort",
            value: report.preflight.openclaw.gateway.plannedPort,
          },
          {
            key: "gatewayUrl",
            value: report.preflight.openclaw.gateway.url,
          },
          {
            key: "shellPort",
            value: report.preflight.shell.plannedPort,
          },
          {
            key: "shellApiUrl",
            value: report.preflight.shell.apiUrl,
          },
          {
            key: "shellHealthUrl",
            value: report.preflight.shell.healthUrl,
          },
        ];
  const preflightMutations = report.preflight?.mutations ?? [];

  return [
    "# Chieflane Install Report",
    "",
    `- workspace: ${report.workspace}`,
    `- mode: ${report.mode}`,
    `- openclawProfile: ${report.openclawProfile ?? "default"}`,
    `- startedAt: ${report.startedAt}`,
    `- finishedAt: ${report.finishedAt ?? ""}`,
    "",
    "## Gateway Scope",
    formatItems(gatewayScopedChanges),
    "",
    "## OpenClaw Context",
    formatItems(preflightContext),
    "",
    "## Runtime Env",
    formatItems(runtimeEnv),
    "",
    "## Planned Mutations",
    formatItems(preflightMutations),
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

function verifyReportMarkdown(report: VerifyReport) {
  const changed = report.changed.map(sanitizeReportItem);
  const checks = report.checks.map(sanitizeReportItem);
  const warnings = report.warnings.map(sanitizeReportItem);
  const errors = report.errors.map(sanitizeReportItem);
  const runtimeEnv = report.runtimeEnv == null
    ? []
    : [
        {
          key: "shellApiUrl",
          source: report.runtimeEnv.shellApiUrl.source,
          value: report.runtimeEnv.shellApiUrl.value,
        },
        {
          key: "shellInternalApiKey",
          source: report.runtimeEnv.shellInternalApiKey.source,
          redacted: report.runtimeEnv.shellInternalApiKey.redacted,
        },
        {
          key: "gatewayUrl",
          source: report.runtimeEnv.gatewayUrl.source,
          value: report.runtimeEnv.gatewayUrl.value,
        },
        {
          key: "gatewayToken",
          source: report.runtimeEnv.gatewayToken.source,
          redacted: report.runtimeEnv.gatewayToken.redacted,
        },
      ];

  return [
    "# Chieflane Verify Report",
    "",
    `- workspace: ${report.workspace}`,
    `- openclawProfile: ${report.openclawProfile ?? "default"}`,
    `- startedAt: ${report.startedAt}`,
    `- finishedAt: ${report.finishedAt ?? ""}`,
    `- ok: ${report.summary?.ok ?? (report.errors.length === 0)}`,
    `- firstFailedKind: ${report.summary?.firstFailedKind ?? ""}`,
    `- failedKinds: ${(report.summary?.failedKinds ?? []).join(", ")}`,
    "",
    "## Runtime Env",
    formatItems(runtimeEnv),
    "",
    "## Changed",
    formatItems(changed),
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

export async function writeVerifyReport(
  workspace: string,
  report: VerifyReport
) {
  report.finishedAt = new Date().toISOString();
  report.summary = {
    ok: report.errors.length === 0,
    firstFailedKind:
      report.checks.find((check) => check.ok === false)?.kind as string | undefined,
    failedKinds: report.checks
      .filter((check) => check.ok === false)
      .map((check) => String(check.kind)),
  };

  const sanitizedReport: VerifyReport = {
    ...report,
    changed: report.changed.map(sanitizeReportItem),
    checks: report.checks.map(sanitizeReportItem),
    warnings: report.warnings.map(sanitizeReportItem),
    errors: report.errors.map(sanitizeReportItem),
  };

  const root = chieflaneDir(workspace);
  await fs.ensureDir(root);

  const jsonPath = path.join(root, "verify-report.json");
  const mdPath = path.join(root, "verify-report.md");
  await fs.writeJson(jsonPath, sanitizedReport, { spaces: 2 });
  await fs.writeFile(mdPath, verifyReportMarkdown(sanitizedReport), "utf8");

  return { jsonPath, mdPath };
}

async function mergeJsonFile(
  filePath: string,
  patch: Record<string, unknown>
) {
  const current = await fs.readJson(filePath).catch(() => ({}));
  const next = {
    ...(current as Record<string, unknown>),
    ...patch,
  };
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, next, { spaces: 2 });
  return filePath;
}

export async function writeCurrentStatus(args: {
  workspace: string;
  repoRoot?: string;
  patch: Record<string, unknown>;
}) {
  const workspacePath = await mergeJsonFile(
    path.join(chieflaneDir(args.workspace), "current-status.json"),
    args.patch
  );
  const repoRootPath =
    args.repoRoot == null
      ? undefined
      : await mergeJsonFile(
          path.join(args.repoRoot, ".chieflane", "current-status.json"),
          args.patch
        );

  return {
    workspacePath,
    repoRootPath,
  };
}
