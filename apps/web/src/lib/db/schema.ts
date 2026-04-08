export const schema = `
CREATE TABLE IF NOT EXISTS surfaces (
  id TEXT PRIMARY KEY,
  surface_key TEXT NOT NULL UNIQUE,
  lane TEXT NOT NULL,
  surface_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  priority INTEGER NOT NULL DEFAULT 50,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  actions_json TEXT NOT NULL DEFAULT '[]',
  blocks_json TEXT,
  fallback_text TEXT NOT NULL,
  entity_refs_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  meta_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  generated_at TEXT NOT NULL,
  expires_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_surfaces_lane ON surfaces(lane);
CREATE INDEX IF NOT EXISTS idx_surfaces_status ON surfaces(status);
CREATE INDEX IF NOT EXISTS idx_surfaces_surface_type ON surfaces(surface_type);
CREATE INDEX IF NOT EXISTS idx_surfaces_priority ON surfaces(priority DESC);

CREATE TABLE IF NOT EXISTS surface_events (
  id TEXT PRIMARY KEY,
  surface_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (surface_id) REFERENCES surfaces(id)
);

CREATE INDEX IF NOT EXISTS idx_surface_events_surface_id ON surface_events(surface_id);
CREATE INDEX IF NOT EXISTS idx_surface_events_created_at ON surface_events(created_at DESC);

CREATE TABLE IF NOT EXISTS action_runs (
  id TEXT PRIMARY KEY,
  surface_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_text TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  FOREIGN KEY (surface_id) REFERENCES surfaces(id)
);

CREATE INDEX IF NOT EXISTS idx_action_runs_surface_id ON action_runs(surface_id);
CREATE INDEX IF NOT EXISTS idx_action_runs_status ON action_runs(status);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  keys_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
