CREATE TABLE IF NOT EXISTS site_live_status (
  platform TEXT PRIMARY KEY CHECK(platform IN ('tiktok', 'twitch', 'youtube')),
  is_live INTEGER NOT NULL DEFAULT 0 CHECK(is_live IN (0, 1)),
  updated_at TEXT NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
