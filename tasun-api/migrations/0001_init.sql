-- 0001_init.sql
CREATE TABLE IF NOT EXISTS records (
  resource    TEXT NOT NULL,          -- 例：tasun-index-db（你固定用這個）
  id          TEXT NOT NULL,          -- pk: id
  data        TEXT NOT NULL,          -- JSON 字串（整筆列資料）
  updated_at  INTEGER NOT NULL,       -- ms epoch
  created_at  INTEGER NOT NULL,       -- ms epoch
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (resource, id)
);

CREATE INDEX IF NOT EXISTS idx_records_resource_updated
ON records(resource, updated_at);
