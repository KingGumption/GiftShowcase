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
