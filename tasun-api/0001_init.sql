PRAGMA foreign_keys = ON;

-- 使用者（用 Cloudflare Access 的 email 對應角色）
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,   -- alex / tasun / wu
  role          TEXT NOT NULL,          -- admin / write / read
  access_email  TEXT UNIQUE,            -- Access JWT payload.email 對應
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO users (username, role, access_email) VALUES
  ('alex',  'admin', NULL),
  ('tasun', 'write', NULL),
  ('wu',    'read',  NULL);

-- 事項記錄資料
CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uid         TEXT NOT NULL UNIQUE,  -- 前端產生的唯一ID（uuid）
  content     TEXT NOT NULL,         -- 記事內容
  trade       TEXT,                  -- 工種
  system      TEXT,                  -- 系統
  attachment  TEXT,                  -- 附件（可放URL或JSON字串）
  remark      TEXT,                  -- 備註
  reg_date    TEXT,                  -- 登錄日期（字串，前端格式自行統一）
  deleted     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_deleted_id ON notes(deleted, id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
