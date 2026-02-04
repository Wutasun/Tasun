-- 0001_init.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS resources (
  resource_key TEXT PRIMARY KEY,
  rev INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  resource_key TEXT NOT NULL,
  id TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (resource_key, id),
  FOREIGN KEY (resource_key) REFERENCES resources(resource_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_resource_updated
ON items(resource_key, updated_at);
