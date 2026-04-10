import fs from "fs-extra";
import path from "node:path";
import { chieflaneDir } from "./report";

export type BootstrapCheckpoint = {
  startedAt: string;
  finishedAt?: string;
  steps: Record<
    string,
    {
      ok: boolean;
      startedAt: string;
      finishedAt?: string;
      fatal: boolean;
      error?: string;
    }
  >;
};

export function createBootstrapCheckpoint(): BootstrapCheckpoint {
  return {
    startedAt: new Date().toISOString(),
    steps: {},
  };
}

export function bootstrapCheckpointPath(workspace: string) {
  return path.join(chieflaneDir(workspace), "bootstrap-checkpoint.json");
}

export async function readBootstrapCheckpoint(workspace: string) {
  const filePath = bootstrapCheckpointPath(workspace);
  if (!(await fs.pathExists(filePath))) {
    return null;
  }

  return (await fs.readJson(filePath)) as BootstrapCheckpoint;
}

export async function writeBootstrapCheckpoint(
  workspace: string,
  checkpoint: BootstrapCheckpoint
) {
  const filePath = bootstrapCheckpointPath(workspace);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, checkpoint, { spaces: 2 });
  return filePath;
}
