CREATE TABLE IF NOT EXISTS gift_catalogue_state (
  region TEXT PRIMARY KEY,
  payload_json TEXT,
  revision TEXT,
  source_updated_at TEXT,
  last_success_at INTEGER,
  last_attempt_at INTEGER NOT NULL DEFAULT 0,
  next_refresh_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  warm_cursor INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gift_catalogue_items (
  region TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  cached_key TEXT,
  failed_source TEXT,
  failed_at INTEGER,
  PRIMARY KEY (region, gift_id)
);
