ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 210000;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_updated_at_idx ON auth_rate_limits(updated_at);
