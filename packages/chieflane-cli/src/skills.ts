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

function inferSkillTargetKind(targetRoot: string) {
  const normalized = targetRoot.split(path.sep).join("/");
  if (normalized.endsWith("/.agents/skills")) {
    return "project-agent-skills" as const;
  }

  if (normalized.endsWith("/skills")) {
    return "workspace-skills" as const;
  }

  return "custom" as const;
}

export function getWorkspaceSkillCandidates(workspace: string, slug: string) {
  return [
    path.join(workspace, "skills", slug, "SKILL.md"),
    path.join(workspace, ".agents", "skills", slug, "SKILL.md"),
  ];
}

export function resolveSkillInstallRoot(workspace: string, slug?: string) {
  const workspaceSkills = path.join(workspace, "skills");
  const projectAgentSkills = path.join(workspace, ".agents", "skills");

  if (slug) {
    const legacySkill = path.join(projectAgentSkills, slug);
    if (fs.pathExistsSync(legacySkill)) {
      return {
        root: projectAgentSkills,
        kind: "project-agent-skills" as const,
      };
    }

    const workspaceSkill = path.join(workspaceSkills, slug);
    if (fs.pathExistsSync(workspaceSkill)) {
      return { root: workspaceSkills, kind: "workspace-skills" as const };
    }
  }

  if (fs.pathExistsSync(workspaceSkills)) {
    return { root: workspaceSkills, kind: "workspace-skills" as const };
  }

  if (fs.pathExistsSync(projectAgentSkills)) {
    return {
      root: projectAgentSkills,
      kind: "project-agent-skills" as const,
    };
  }

  return { root: workspaceSkills, kind: "workspace-skills" as const };
}

function resolveManifestSkillTarget(
  workspace: string,
  skill: IntegrationManifest["openclaw"]["skills"][number]
) {
  if (skill.targets && skill.strategy === "auto-precedence") {
    const installRoot = resolveSkillInstallRoot(workspace, skill.slug);
    const preferred = skill.targets.find((target) => {
      const root = path.dirname(target);
      return path.resolve(workspace, root) === installRoot.root;
    });

    const selected = preferred ?? skill.targets[0];
    return {
      target: path.resolve(workspace, selected),
      targetRoot: path.resolve(workspace, path.dirname(selected)),
      targetKind: installRoot.kind,
    };
  }

  const selected = skill.target ?? skill.targets?.[0];
  if (!selected) {
    throw new Error(`Skill ${skill.slug} is missing an install target`);
  }

  const targetRoot = path.resolve(workspace, path.dirname(selected));
  return {
    target: path.resolve(workspace, selected),
    targetRoot,
    targetKind: inferSkillTargetKind(targetRoot),
  };
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
    const { target, targetRoot, targetKind } = resolveManifestSkillTarget(
      opts.workspace,
      skill
    );
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
      targetRoot,
      targetKind,
      action:
        opts.dryRun
          ? "would-copy"
          : targetExists && opts.mergeStrategy === "force"
            ? "replaced"
            : "copied",
    });
  }
}
