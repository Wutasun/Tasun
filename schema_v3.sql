-- Tasun Security v3 schema (D1 / SQLite)
PRAGMA foreign_keys=ON;

-- Users (可改成只用固定內建帳號：但建表後可由 DB 管理)
CREATE TABLE IF NOT EXISTS tasun_users (
  username TEXT PRIMARY KEY,
  passhash TEXT NOT NULL,          -- SHA-256 hex (username + ":" + password + ":" + salt) in v3 sample
  salt     TEXT NOT NULL,
  role     TEXT NOT NULL,          -- admin|write|read
  enabled  INTEGER NOT NULL DEFAULT 1,
  updatedAt INTEGER NOT NULL
);

-- Store rows (row-per-uid, per resourceKey)
CREATE TABLE IF NOT EXISTS tasun_rows (
  resourceKey TEXT NOT NULL,
  uid         TEXT NOT NULL,
  data        TEXT NOT NULL,       -- JSON string of row
  updatedAt   INTEGER NOT NULL,
  rev         INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(resourceKey, uid)
);

-- Optional audit log
CREATE TABLE IF NOT EXISTS tasun_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  username TEXT,
  action TEXT NOT NULL,
  resourceKey TEXT,
  info TEXT
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_rows_resource_updated ON tasun_rows(resourceKey, updatedAt);
