import fs from "fs-extra";
import path from "node:path";
import type { IntegrationManifest } from "./manifest";
import { createBackup, type InstallReport } from "./report";

async function filesMatch(source: string, target: string) {
  const sourcePath = path.join(source, "SKILL.md");
  const targetPath = path.join(target, "SKILL.md");

  if (!(await fs.pathExists(sourcePath)) || !(await fs.pathExists(targetPath))) {
    return false;
  }

  const [sourceBody, targetBody] = await Promise.all([
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(targetPath, "utf8"),
  ]);

  return sourceBody === targetBody;
}

export async function installSkillsIntoWorkspace(opts: {
  manifest: IntegrationManifest;
  repoRoot: string;
  workspace: string;
  mergeStrategy: "safe" | "force";
  dryRun: boolean;
  report: InstallReport;
}) {
  for (const skill of opts.manifest.openclaw.skills) {
    const source = path.resolve(opts.repoRoot, skill.source);
    const target = path.resolve(opts.workspace, skill.target);
    const targetExists = await fs.pathExists(target);

    if (targetExists && opts.mergeStrategy !== "force") {
      if (await filesMatch(source, target)) {
        opts.report.skipped.push({
          kind: "skill",
          slug: skill.slug,
          target,
          reason: "already-current",
        });
      } else {
        opts.report.skipped.push({
          kind: "skill",
          slug: skill.slug,
          target,
          reason: "existing-skill-left-untouched",
        });
      }
      continue;
    }

    if (!opts.dryRun) {
      if (targetExists) {
        const backupPath = await createBackup(opts.workspace, target);
        opts.report.changed.push({
          kind: "backup",
          target: path.relative(opts.workspace, target),
          backupPath,
        });
      }
      await fs.ensureDir(path.dirname(target));
      await fs.copy(source, target, {
        overwrite: true,
        errorOnExist: false,
      });
    }

    opts.report.changed.push({
      kind: "skill",
      slug: skill.slug,
      source,
      target,
      action:
        opts.dryRun
          ? "would-copy"
          : targetExists && opts.mergeStrategy === "force"
            ? "replaced"
            : "copied",
    });
  }
}
