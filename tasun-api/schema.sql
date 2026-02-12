CREATE TABLE IF NOT EXISTS records (
  resource   TEXT NOT NULL,
  uid        TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 0,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (resource, uid)
);
CREATE INDEX IF NOT EXISTS idx_records_resource_updated ON records(resource, updated_at);
