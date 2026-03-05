-- Tasun Worker Stable v4 schema (Cloudflare D1 / SQLite)
-- Tables:
-- 1) tasun_users: login users
-- 2) tasun_auth: per-user permissions + home buttons
-- 3) tasun_rows: generic per-resource rows (sync/merge)

CREATE TABLE IF NOT EXISTS tasun_users (
  username TEXT PRIMARY KEY,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'read',
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasun_auth (
  username TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'read',
  btn1 INTEGER NOT NULL DEFAULT 1,
  btn2 INTEGER NOT NULL DEFAULT 1,
  btn3 INTEGER NOT NULL DEFAULT 1,
  btn4 INTEGER NOT NULL DEFAULT 1,
  btn5 INTEGER NOT NULL DEFAULT 1,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasun_rows (
  resourceKey TEXT NOT NULL,
  uid TEXT NOT NULL,
  data TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (resourceKey, uid)
);

CREATE INDEX IF NOT EXISTS idx_rows_resource_updated ON tasun_rows(resourceKey, updatedAt);
