import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getMissingSkillsForVerification,
  getMissingVerifyEnvNames,
  getWorkspaceSkillPath,
} from "./verify";

test("getMissingVerifyEnvNames does not require SHELL_INTERNAL_API_KEY", () => {
  const missing = getMissingVerifyEnvNames({
    SHELL_API_URL: "http://localhost:3000",
    OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789",
    OPENCLAW_GATEWAY_TOKEN: "gateway-token",
  });

  assert.deepEqual(missing, []);
});

test("getWorkspaceSkillPath uses the .agents skills directory", () => {
  assert.equal(
    getWorkspaceSkillPath("/tmp/workspace", "chief-shell"),
    "/tmp/workspace/.agents/skills/chief-shell/SKILL.md"
  );
});

test("getMissingSkillsForVerification checks the requested workspace even when skills are visible", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-verify-"));

  try {
    await fs.ensureDir(path.join(workspace, ".agents", "skills", "chief-shell"));
    await fs.writeFile(
      path.join(workspace, ".agents", "skills", "chief-shell", "SKILL.md"),
      "# chief-shell\n",
      "utf8"
    );

    const missing = getMissingSkillsForVerification({
      workspace,
      desired: ["chief-shell", "morning-ops"],
      visibleSlugs: ["chief-shell", "morning-ops"],
    });

    assert.deepEqual(missing, ["morning-ops"]);
  } finally {
    await fs.remove(workspace);
  }
});
