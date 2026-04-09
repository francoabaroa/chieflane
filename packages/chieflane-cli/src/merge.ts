import fs from "fs-extra";
import path from "node:path";
import type { IntegrationManifest, ManifestSnippet } from "./manifest";
import { createBackup, type InstallReport } from "./report";

export type HeartbeatKind =
  | "missing"
  | "empty"
  | "managed"
  | "markdown-checklist"
  | "yaml-tasks"
  | "unknown";

export type MergeOptions = {
  manifest: IntegrationManifest;
  repoRoot: string;
  workspace: string;
  mergeStrategy: "safe" | "force";
  heartbeatMode: "skip" | "manage" | "force";
  dryRun: boolean;
  report: InstallReport;
};

const PROFILE_TEMPLATE = `# .chieflane/profile.example.md

## Optional Chieflane Preferences
- Preferred lanes:
- Default draft tone:
- Urgency thresholds:
- Auto-archive window:
- Morning brief preferred sections:
- Approval shortcuts:
`;

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function upsertManagedBlock(
  existing: string,
  blockId: string,
  body: string
) {
  const start = `<!-- chieflane:start:${blockId} -->`;
  const end = `<!-- chieflane:end:${blockId} -->`;
  const replacement = `${start}\n${body.trim()}\n${end}`;

  const matcher = new RegExp(
    `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
    "m"
  );

  if (matcher.test(existing)) {
    return existing.replace(matcher, replacement);
  }

  const trimmed = existing.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n\n${replacement}\n` : `${replacement}\n`;
}

export function classifyHeartbeat(text: string | null): HeartbeatKind {
  if (text == null) {
    return "missing";
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return "empty";
  }

  if (trimmed.includes("<!-- chieflane:start:heartbeat -->")) {
    return "managed";
  }

  if (/^\s*tasks\s*:/m.test(trimmed)) {
    return "yaml-tasks";
  }

  if (/^\s*[-*]\s+\[[ xX]\]/m.test(trimmed)) {
    return "markdown-checklist";
  }

  return "unknown";
}

async function readText(filePath: string) {
  return fs.readFile(filePath, "utf8");
}

async function readTemplate(repoRoot: string, relativePath: string) {
  return readText(path.resolve(repoRoot, relativePath));
}

async function writeWorkspaceFile(args: {
  workspace: string;
  targetPath: string;
  nextContent: string;
  dryRun: boolean;
  report: InstallReport;
  action: string;
}) {
  const exists = await fs.pathExists(args.targetPath);
  let previous = "";
  if (exists) {
    previous = await readText(args.targetPath);
    if (previous === args.nextContent) {
      args.report.skipped.push({
        kind: "workspace-file",
        target: path.basename(args.targetPath),
        reason: "already-current",
      });
      return;
    }
  }

  if (!args.dryRun) {
    if (exists) {
      const backupPath = await createBackup(args.workspace, args.targetPath);
      args.report.changed.push({
        kind: "backup",
        target: path.basename(args.targetPath),
        backupPath,
      });
    }

    await fs.ensureDir(path.dirname(args.targetPath));
    await fs.writeFile(args.targetPath, args.nextContent, "utf8");
  }

  args.report.changed.push({
    kind: "workspace-file",
    target: path.basename(args.targetPath),
    action: args.dryRun ? `would-${args.action}` : args.action,
  });
}

async function ensureGreenfieldTemplate(args: {
  repoRoot: string;
  workspace: string;
  targetName: string;
  sourcePath: string;
  dryRun: boolean;
  report: InstallReport;
}) {
  const targetPath = path.join(args.workspace, args.targetName);
  if (await fs.pathExists(targetPath)) {
    return false;
  }

  const nextContent = await readTemplate(args.repoRoot, args.sourcePath);
  await writeWorkspaceFile({
    workspace: args.workspace,
    targetPath,
    nextContent,
    dryRun: args.dryRun,
    report: args.report,
    action: "created-from-template",
  });

  return true;
}

async function upsertSnippet(args: {
  workspace: string;
  targetPath: string;
  snippet: ManifestSnippet;
  body: string;
  dryRun: boolean;
  report: InstallReport;
}) {
  const existing = (await fs.pathExists(args.targetPath))
    ? await readText(args.targetPath)
    : "";

  const nextContent = upsertManagedBlock(
    existing,
    args.snippet.blockId!,
    args.body
  );

  await writeWorkspaceFile({
    workspace: args.workspace,
    targetPath: args.targetPath,
    nextContent,
    dryRun: args.dryRun,
    report: args.report,
    action: "managed-block-upserted",
  });
}

async function ensureProfileExample(args: {
  workspace: string;
  dryRun: boolean;
  report: InstallReport;
}) {
  const targetPath = path.join(args.workspace, ".chieflane", "profile.example.md");
  if (await fs.pathExists(targetPath)) {
    return;
  }

  await writeWorkspaceFile({
    workspace: args.workspace,
    targetPath,
    nextContent: PROFILE_TEMPLATE,
    dryRun: args.dryRun,
    report: args.report,
    action: "created",
  });
}

async function mergeAgentsAndTools(opts: MergeOptions) {
  const templates = opts.manifest.openclaw.workspace.greenfieldTemplates;
  const snippets = new Map(
    opts.manifest.openclaw.workspace.snippets.map((entry) => [entry.target, entry])
  );

  for (const targetName of ["AGENTS.md", "TOOLS.md"] as const) {
    const created = await ensureGreenfieldTemplate({
      repoRoot: opts.repoRoot,
      workspace: opts.workspace,
      targetName,
      sourcePath: templates[targetName],
      dryRun: opts.dryRun,
      report: opts.report,
    });

    if (created) {
      continue;
    }

    const snippet = snippets.get(targetName);
    if (!snippet?.blockId) {
      continue;
    }

    const body = await readTemplate(opts.repoRoot, snippet.source);
    await upsertSnippet({
      workspace: opts.workspace,
      targetPath: path.join(opts.workspace, targetName),
      snippet,
      body,
      dryRun: opts.dryRun,
      report: opts.report,
    });
  }
}

async function mergeMemory(opts: MergeOptions) {
  const targetPath = path.join(opts.workspace, "MEMORY.md");
  const templatePath = opts.manifest.openclaw.workspace.greenfieldTemplates["MEMORY.md"];
  const exists = await fs.pathExists(targetPath);

  if (!exists) {
    const nextContent = await readTemplate(opts.repoRoot, templatePath);
    await writeWorkspaceFile({
      workspace: opts.workspace,
      targetPath,
      nextContent,
      dryRun: opts.dryRun,
      report: opts.report,
      action: "created-from-template",
    });
    return;
  }

  await ensureProfileExample({
    workspace: opts.workspace,
    dryRun: opts.dryRun,
    report: opts.report,
  });

  if (opts.mergeStrategy !== "force") {
    opts.report.skipped.push({
      kind: "workspace-file",
      target: "MEMORY.md",
      reason: "existing-memory-left-untouched",
    });
    return;
  }

  const nextContent = await readTemplate(opts.repoRoot, templatePath);
  await writeWorkspaceFile({
    workspace: opts.workspace,
    targetPath,
    nextContent,
    dryRun: opts.dryRun,
    report: opts.report,
    action: "replaced-from-template",
  });
}

async function mergeHeartbeat(opts: MergeOptions) {
  if (opts.heartbeatMode === "skip") {
    opts.report.skipped.push({
      kind: "workspace-file",
      target: "HEARTBEAT.md",
      reason: "heartbeat-mode-skip",
    });
    return;
  }

  const targetPath = path.join(opts.workspace, "HEARTBEAT.md");
  const templatePath = opts.manifest.openclaw.workspace.greenfieldTemplates["HEARTBEAT.md"];
  const snippet = opts.manifest.openclaw.workspace.snippets.find(
    (entry) => entry.target === "HEARTBEAT.md"
  );
  const existing = (await fs.pathExists(targetPath))
    ? await readText(targetPath)
    : null;
  const kind = classifyHeartbeat(existing);

  if (kind === "missing" || kind === "empty") {
    const nextContent =
      kind === "missing"
        ? await readTemplate(opts.repoRoot, templatePath)
        : upsertManagedBlock(existing ?? "", "heartbeat", await readTemplate(opts.repoRoot, snippet!.source));
    await writeWorkspaceFile({
      workspace: opts.workspace,
      targetPath,
      nextContent,
      dryRun: opts.dryRun,
      report: opts.report,
      action: kind === "missing" ? "created-from-template" : "managed-heartbeat-upserted",
    });
    return;
  }

  if (kind === "managed") {
    const nextContent = upsertManagedBlock(
      existing ?? "",
      "heartbeat",
      await readTemplate(opts.repoRoot, snippet!.source)
    );
    await writeWorkspaceFile({
      workspace: opts.workspace,
      targetPath,
      nextContent,
      dryRun: opts.dryRun,
      report: opts.report,
      action: "managed-heartbeat-updated",
    });
    return;
  }

  if (opts.heartbeatMode === "force") {
    const nextContent = await readTemplate(opts.repoRoot, templatePath);
    await writeWorkspaceFile({
      workspace: opts.workspace,
      targetPath,
      nextContent,
      dryRun: opts.dryRun,
      report: opts.report,
      action: "replaced-from-template",
    });
    return;
  }

  opts.report.skipped.push({
    kind: "workspace-file",
    target: "HEARTBEAT.md",
    reason: "appears-user-managed",
    heartbeatKind: kind,
  });
}

export async function mergeWorkspaceFiles(opts: MergeOptions) {
  if (!opts.dryRun) {
    await fs.ensureDir(opts.workspace);
  }
  await mergeAgentsAndTools(opts);
  await mergeMemory(opts);
  await mergeHeartbeat(opts);
}
