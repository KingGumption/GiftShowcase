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
