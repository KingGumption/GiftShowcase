PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS output_docks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  starter_kind TEXT CHECK(starter_kind IN ('vertical', 'horizontal') OR starter_kind IS NULL),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, starter_kind)
);

CREATE INDEX IF NOT EXISTS output_docks_user_id_idx ON output_docks(user_id);
CREATE INDEX IF NOT EXISTS output_docks_public_token_idx ON output_docks(public_token);

CREATE TABLE IF NOT EXISTS dock_items (
  id TEXT PRIMARY KEY,
  dock_id TEXT NOT NULL REFERENCES output_docks(id) ON DELETE CASCADE,
  overlay_variant_id TEXT NOT NULL REFERENCES overlay_variants(id) ON DELETE RESTRICT,
  overlay_kind TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  z_index INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS dock_items_dock_id_idx ON dock_items(dock_id, z_index);
CREATE INDEX IF NOT EXISTS dock_items_variant_id_idx ON dock_items(overlay_variant_id);

-- Preserve any single-overlay output URLs already created during development.
INSERT OR IGNORE INTO output_docks
  (id, user_id, name, public_token, width, height, starter_kind, created_at, updated_at)
SELECT id, user_id, name, public_token, width, height, NULL, created_at, updated_at FROM docks;

INSERT OR IGNORE INTO dock_items
  (id, dock_id, overlay_variant_id, overlay_kind, x, y, width, height, z_index, visible, locked, created_at, updated_at)
SELECT lower(hex(randomblob(16))), legacy.id, legacy.overlay_variant_id, legacy.overlay_kind, 0, 0, legacy.width, legacy.height, 0, 1, 0, legacy.created_at, legacy.updated_at
FROM docks legacy
WHERE NOT EXISTS (SELECT 1 FROM dock_items item WHERE item.dock_id = legacy.id);

-- Existing accounts receive the same two starter outputs as newly registered users.
INSERT OR IGNORE INTO output_docks
  (id, user_id, name, public_token, width, height, starter_kind, created_at, updated_at)
SELECT lower(hex(randomblob(16))), id, 'Vertical Output', lower(hex(randomblob(24))), 1080, 1920, 'vertical', datetime('now'), datetime('now')
FROM users;

INSERT OR IGNORE INTO output_docks
  (id, user_id, name, public_token, width, height, starter_kind, created_at, updated_at)
SELECT lower(hex(randomblob(16))), id, 'Horizontal Output', lower(hex(randomblob(24))), 1920, 1080, 'horizontal', datetime('now'), datetime('now')
FROM users;
