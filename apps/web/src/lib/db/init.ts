import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./index";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnvPath = path.resolve(moduleDir, "../../../../../.env");

export function getDbEnvPaths() {
  return Array.from(
    new Set([repoRootEnvPath, path.resolve(process.cwd(), ".env")])
  );
}

export function loadDbEnv() {
  for (const envPath of getDbEnvPaths()) {
    dotenv.config({ path: envPath });
  }
}

export function initDb() {
  loadDbEnv();
  const db = getDb();
  db.prepare("select 1 as ok").get();
  return db;
}

const isMainModule =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  initDb();
  console.log("Database initialized.");
}
