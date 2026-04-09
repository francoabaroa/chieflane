import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createInstallReport, writeInstallReport } from "./report";

test("writeInstallReport redacts sensitive config values", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chieflane-report-"));

  try {
    const report = createInstallReport({
      workspace,
      mode: "live",
    });
    report.openclawProfile = "chieflane";
    report.gatewayScopedChanges.push({
      kind: "plugin",
      label: "Install and enable surface-lane",
    });
    report.runtimeEnv = {
      shellApiUrl: {
        source: "default",
        value: "http://localhost:3000",
      },
      shellInternalApiKey: {
        source: "generated",
        redacted: "[REDACTED]",
      },
      gatewayUrl: {
        source: "config",
        value: "http://127.0.0.1:18789",
      },
      gatewayToken: {
        source: "config",
        redacted: "[REDACTED]",
      },
    };
    report.changed.push({
      kind: "config",
      path: "plugins.entries.surface-lane.config.shellInternalApiKey",
      action: "set",
      value: "super-secret",
    });

    await writeInstallReport(workspace, report);

    const jsonPath = path.join(
      workspace,
      ".chieflane",
      "install-report.json"
    );
    const mdPath = path.join(workspace, ".chieflane", "install-report.md");
    const json = await fs.readJson(jsonPath) as { changed: Array<{ value: string }> };
    const markdown = await fs.readFile(mdPath, "utf8");

    assert.equal(json.changed[0]?.value, "[REDACTED]");
    assert.ok(!markdown.includes("super-secret"));
    assert.ok(markdown.includes("openclawProfile: chieflane"));
    assert.ok(markdown.includes("gatewayToken"));
  } finally {
    await fs.remove(workspace);
  }
});
