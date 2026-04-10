import fs from "node:fs";
import path from "node:path";

const ROOT_MARKERS = ["pnpm-workspace.yaml", ".git"];

export function findRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    if (
      ROOT_MARKERS.some((marker) => fs.existsSync(path.join(current, marker)))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}
