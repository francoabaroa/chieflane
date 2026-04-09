import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { findRepoRoot, loadManifest } from "./manifest";
import { createInstallReport } from "./report";
import { installSkillsIntoWorkspace } from "./skills";

const repoRoot = findRepoRoot();

test("installSkillsIntoWorkspace dry-run does not create workspace artifacts", async () => {
  const manifest = await loadManifest(repoRoot);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-skills-"));

  try {
    const report = createInstallReport({ workspace, mode: "live" });
    await installSkillsIntoWorkspace({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      dryRun: true,
      report,
    });

    assert.equal(
      await fs.pathExists(path.join(workspace, ".agents", "skills")),
      false
    );
    assert.ok(
      report.changed.some(
        (item) => item.kind === "skill" && item.action === "would-copy"
      )
    );
  } finally {
    await fs.remove(workspace);
  }
});

test("installSkillsIntoWorkspace preserves existing customized skills in safe mode", async () => {
  const manifest = await loadManifest(repoRoot);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-skills-"));
  const skillDir = path.join(workspace, ".agents", "skills", "chief-shell");

  try {
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# custom\n", "utf8");

    const report = createInstallReport({ workspace, mode: "live" });
    await installSkillsIntoWorkspace({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "safe",
      dryRun: false,
      report,
    });

    const body = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8");
    assert.equal(body, "# custom\n");
    assert.ok(
      report.skipped.some(
        (item) =>
          item.kind === "skill" &&
          item.slug === "chief-shell" &&
          item.reason === "existing-skill-left-untouched"
      )
    );
  } finally {
    await fs.remove(workspace);
  }
});

test("installSkillsIntoWorkspace force mode backs up and replaces existing skills", async () => {
  const manifest = await loadManifest(repoRoot);
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-skills-"));
  const skillDir = path.join(workspace, ".agents", "skills", "chief-shell");

  try {
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# custom\n", "utf8");

    const report = createInstallReport({ workspace, mode: "live" });
    await installSkillsIntoWorkspace({
      manifest,
      repoRoot,
      workspace,
      mergeStrategy: "force",
      dryRun: false,
      report,
    });

    const body = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8");
    assert.notEqual(body, "# custom\n");
    assert.ok(
      report.changed.some(
        (item) =>
          item.kind === "backup" &&
          typeof item.target === "string" &&
          item.target.includes(".agents/skills/chief-shell")
      )
    );
    assert.ok(
      report.changed.some(
        (item) =>
          item.kind === "skill" &&
          item.slug === "chief-shell" &&
          item.action === "replaced"
      )
    );
  } finally {
    await fs.remove(workspace);
  }
});
