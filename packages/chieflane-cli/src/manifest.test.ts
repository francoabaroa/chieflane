import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "node:path";
import test from "node:test";
import { findRepoRoot, loadManifest } from "./manifest";

test("loadManifest validates the integration manifest", async () => {
  const repoRoot = findRepoRoot();
  const manifest = await loadManifest(repoRoot);
  const jobs = await fs.readJson(
    path.join(repoRoot, "openclaw/pack/cron/jobs.json")
  ) as { jobs: Array<{ name: string }> };

  assert.equal(manifest.id, "chieflane");
  assert.equal(manifest.version, "0.2.0");
  assert.deepEqual(
    manifest.openclaw.skills.map((entry) => entry.slug),
    ["chief-shell", "morning-ops", "meeting-ops", "relationship-context"]
  );
  assert.deepEqual(
    manifest.openclaw.cron.map((entry) => entry.name),
    jobs.jobs.map((entry) => entry.name)
  );
});
