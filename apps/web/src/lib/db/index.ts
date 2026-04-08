import Database from "better-sqlite3";
import fs from "fs";
import { schema } from "./schema";
import path from "path";

let _db: Database.Database | null = null;

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string
) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath =
      process.env.DATABASE_PATH ||
      path.join(process.cwd(), "data", "chieflane.db");
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    _db.exec(schema);
    ensureColumn(_db, "surfaces", "blocks_json", "TEXT");
  }
  return _db;
}

export function resetDb() {
  _db?.close();
  _db = null;
}
