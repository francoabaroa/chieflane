#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const userArgs = process.argv.slice(2);
const isPlanOnlyCheck = userArgs.includes("--check");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function has(cmd) {
  const result = spawnSync(cmd, ["--version"], {
    cwd: repoRoot,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return (result.status ?? 1) === 0;
}

function readPinnedPackageManager() {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const spec = String(pkg.packageManager ?? "pnpm@10");
  return spec.split("+")[0];
}

function ensurePnpm() {
  if (has("pnpm")) {
    return;
  }

  const pinned = readPinnedPackageManager();

  if (!has("corepack")) {
    if (has("npm")) {
      run("npm", ["install", "--global", "corepack@latest"]);
    }
  }

  if (!has("corepack")) {
    console.error(
      "pnpm is missing and Corepack is unavailable. Install Node/npm or pnpm, then retry."
    );
    process.exit(1);
  }

  run("corepack", ["enable", "pnpm"]);
  run("corepack", ["prepare", pinned, "--activate"]);

  if (!has("pnpm")) {
    console.error("Tried to bootstrap pnpm via Corepack, but pnpm is still unavailable.");
    process.exit(1);
  }
}

function hasInstall() {
  return fs.existsSync(path.join(repoRoot, "node_modules", ".modules.yaml"));
}

if (isPlanOnlyCheck) {
  if (!has("pnpm")) {
    console.error(
      "setup-local --check is a no-write preview. It will not bootstrap pnpm or Corepack. Install pnpm and repo dependencies first, then retry."
    );
    process.exit(1);
  }

  if (!hasInstall()) {
    console.error(
      "setup-local --check is a no-write preview. It will not run pnpm install. Run `pnpm install` first, then retry."
    );
    process.exit(1);
  }
} else {
  ensurePnpm();

  if (!hasInstall()) {
    run("pnpm", ["install"]);
  }
}

run("pnpm", [
  "--filter",
  "@chieflane/cli",
  "exec",
  "tsx",
  "src/index.ts",
  "setup-local",
  ...userArgs,
]);
