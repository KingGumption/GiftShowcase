CREATE TABLE IF NOT EXISTS variant_links (
 overlay_variant_id TEXT PRIMARY KEY REFERENCES overlay_variants(id) ON DELETE CASCADE,
 public_token TEXT NOT NULL UNIQUE
);
