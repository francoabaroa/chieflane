import fs from "fs-extra";
import path from "node:path";

export type LastBootstrapState = {
  workspace: string;
  mode: "live" | "demo";
  openclawProfile?: string;
  openclawContext?: {
    profile?: string;
    dev?: boolean;
  };
  updatedAt: string;
};

function statePath(repoRoot: string) {
  return path.join(repoRoot, ".chieflane", "last-bootstrap.json");
}

export async function writeLastBootstrapState(
  repoRoot: string,
  state: LastBootstrapState
) {
  const targetPath = statePath(repoRoot);
  await fs.ensureDir(path.dirname(targetPath));
  await fs.writeJson(targetPath, state, { spaces: 2 });
}

export async function readLastBootstrapState(repoRoot: string) {
  const targetPath = statePath(repoRoot);
  if (!(await fs.pathExists(targetPath))) {
    return null;
  }

  return (await fs.readJson(targetPath)) as LastBootstrapState;
}
