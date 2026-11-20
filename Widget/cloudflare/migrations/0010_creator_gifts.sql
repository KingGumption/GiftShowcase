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
