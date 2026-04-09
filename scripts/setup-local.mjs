import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const hasInstall = fs.existsSync(
  path.join(repoRoot, "node_modules", ".modules.yaml")
);

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!hasInstall) {
  run("pnpm", ["install"]);
}

run("pnpm", [
  "--filter",
  "@chieflane/cli",
  "exec",
  "tsx",
  "src/index.ts",
  "setup-local",
  ...process.argv.slice(2),
]);
