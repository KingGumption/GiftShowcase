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
