-- 0001_init.sql  (STANDARD v1: pk=uid)
CREATE TABLE IF NOT EXISTS records (
  resource    TEXT NOT NULL,          -- 例：tasun-index-db（共用大資料庫）或各頁 pageKey
  uid         TEXT NOT NULL,          -- pk: uid（uuid）
  data        TEXT NOT NULL,          -- JSON 字串（整筆列資料，含 uid/rev/updatedAt/deleted...）
  updated_at  INTEGER NOT NULL,       -- ms epoch（用於比對新舊）
  created_at  INTEGER NOT NULL,       -- ms epoch
  deleted     INTEGER NOT NULL DEFAULT 0,
  rev         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (resource, uid)
);

CREATE INDEX IF NOT EXISTS idx_records_resource_updated
ON records(resource, updated_at);

CREATE INDEX IF NOT EXISTS idx_records_resource_deleted
ON records(resource, deleted);
