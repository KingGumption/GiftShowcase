PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_updated_at_idx ON auth_rate_limits(updated_at);

CREATE TABLE IF NOT EXISTS overlay_variants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  overlay_kind TEXT NOT NULL DEFAULT 'carousel' CHECK(overlay_kind IN ('carousel', 'rows', 'side-gifts', 'goal', 'top-likers')),
  config_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS overlay_variants_user_id_idx ON overlay_variants(user_id);
CREATE INDEX IF NOT EXISTS overlay_variants_user_kind_idx ON overlay_variants(user_id, overlay_kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS overlay_revisions (
  id TEXT PRIMARY KEY,
  overlay_variant_id TEXT NOT NULL REFERENCES overlay_variants(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(overlay_variant_id, revision)
);

CREATE INDEX IF NOT EXISTS overlay_revisions_variant_idx
  ON overlay_revisions(overlay_variant_id, revision DESC);

CREATE TABLE IF NOT EXISTS docks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  overlay_variant_id TEXT NOT NULL REFERENCES overlay_variants(id) ON DELETE RESTRICT,
  overlay_kind TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS docks_user_id_idx ON docks(user_id);
CREATE INDEX IF NOT EXISTS docks_variant_id_idx ON docks(overlay_variant_id);
CREATE INDEX IF NOT EXISTS docks_public_token_idx ON docks(public_token);

-- Composite OBS Browser Sources. The original `docks` table remains temporarily so
-- an existing single-overlay installation can be migrated without losing URLs.
CREATE TABLE IF NOT EXISTS output_docks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sample_activity INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS site_live_status (
  platform TEXT PRIMARY KEY CHECK(platform IN ('tiktok', 'twitch', 'youtube')),
  is_live INTEGER NOT NULL DEFAULT 0 CHECK(is_live IN (0, 1)),
  updated_at TEXT NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS variant_links (
 overlay_variant_id TEXT PRIMARY KEY REFERENCES overlay_variants(id) ON DELETE CASCADE,
 public_token TEXT NOT NULL UNIQUE
);

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

CREATE TABLE IF NOT EXISTS creator_gifts (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 gift_id TEXT NOT NULL,
 image_token TEXT NOT NULL UNIQUE,
 metadata_json TEXT NOT NULL,
 source TEXT NOT NULL,
 cached_key TEXT,
 failed_source TEXT,
 failed_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY (user_id, gift_id)
);
CREATE TABLE IF NOT EXISTS creator_gift_state (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 discovery_after INTEGER NOT NULL DEFAULT 0
);

-- Additive only: no existing designs, links or images are rewritten.
CREATE TABLE IF NOT EXISTS creator_upload_limits (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lock_token TEXT,
  lock_until INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL DEFAULT 0,
  writes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS creator_image_objects (
  object_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  delete_after INTEGER
);
CREATE INDEX IF NOT EXISTS creator_image_objects_owner ON creator_image_objects(user_id);
CREATE INDEX IF NOT EXISTS creator_image_objects_retention ON creator_image_objects(delete_after);
CREATE TABLE IF NOT EXISTS creator_image_audit_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  cursor TEXT
);

CREATE TABLE IF NOT EXISTS account_action_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('reset','email')),
  email_before TEXT NOT NULL,
  email_after TEXT,
  credential_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  claim TEXT
);
CREATE INDEX IF NOT EXISTS account_action_expiry ON account_action_tokens(expires_at);

-- Additive library and capped hosted-sound metadata; existing design JSON is untouched.
CREATE TABLE IF NOT EXISTS design_preferences (
  variant_id TEXT PRIMARY KEY REFERENCES overlay_variants(id) ON DELETE CASCADE,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS user_sounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS user_sounds_owner ON user_sounds(user_id);

-- Additive: retain existing accounts, designs, media and source capabilities.
CREATE TABLE IF NOT EXISTS user_access (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invite_requests (
 id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,
 channel TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL,reviewed_at TEXT,reviewed_by TEXT,note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS invitations (
 token_hash TEXT PRIMARY KEY,request_id TEXT REFERENCES invite_requests(id) ON DELETE CASCADE,
 email TEXT NOT NULL COLLATE NOCASE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,
 used_at TEXT,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,claim TEXT
);
CREATE INDEX IF NOT EXISTS invitation_email ON invitations(email,expires_at);
CREATE TABLE IF NOT EXISTS admin_audit (
 id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT,
 reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mail_log (
 id TEXT PRIMARY KEY,template TEXT NOT NULL,recipient TEXT NOT NULL,status TEXT NOT NULL,
 provider_id TEXT,error TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mail_log_created ON mail_log(created_at);
