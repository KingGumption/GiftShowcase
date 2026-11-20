-- Variants used to contain the settings for every overlay type. Add a type and
-- preserve those bundles by creating one typed copy for every renderer.
ALTER TABLE overlay_variants ADD COLUMN overlay_kind TEXT NOT NULL DEFAULT 'carousel'
  CHECK(overlay_kind IN ('carousel', 'rows', 'side-gifts', 'goal', 'top-likers'));

CREATE TABLE variant_kind_migration_0003 (
  source_id TEXT NOT NULL,
  overlay_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (source_id, overlay_kind)
);

INSERT INTO variant_kind_migration_0003 (source_id, overlay_kind, target_id)
SELECT id, 'carousel', id FROM overlay_variants;

INSERT INTO variant_kind_migration_0003 (source_id, overlay_kind, target_id)
SELECT variant.id, kind.overlay_kind, lower(hex(randomblob(16)))
FROM overlay_variants variant
CROSS JOIN (
  SELECT 'rows' AS overlay_kind
  UNION ALL SELECT 'side-gifts'
  UNION ALL SELECT 'goal'
  UNION ALL SELECT 'top-likers'
) kind;

INSERT INTO overlay_variants
  (id, user_id, name, overlay_kind, config_json, revision, created_at, updated_at)
SELECT migration.target_id, variant.user_id, variant.name, migration.overlay_kind,
  variant.config_json, variant.revision, variant.created_at, variant.updated_at
FROM variant_kind_migration_0003 migration
JOIN overlay_variants variant ON variant.id = migration.source_id
WHERE migration.overlay_kind <> 'carousel';

INSERT INTO overlay_revisions
  (id, overlay_variant_id, revision, config_json, created_at)
SELECT lower(hex(randomblob(16))), migration.target_id, revision.revision,
  revision.config_json, revision.created_at
FROM variant_kind_migration_0003 migration
JOIN overlay_revisions revision ON revision.overlay_variant_id = migration.source_id
WHERE migration.overlay_kind <> 'carousel';

UPDATE dock_items
SET overlay_variant_id = (
  SELECT migration.target_id
  FROM variant_kind_migration_0003 migration
  WHERE migration.source_id = dock_items.overlay_variant_id
    AND migration.overlay_kind = dock_items.overlay_kind
)
WHERE EXISTS (
  SELECT 1 FROM variant_kind_migration_0003 migration
  WHERE migration.source_id = dock_items.overlay_variant_id
    AND migration.overlay_kind = dock_items.overlay_kind
);

UPDATE docks
SET overlay_variant_id = (
  SELECT migration.target_id
  FROM variant_kind_migration_0003 migration
  WHERE migration.source_id = docks.overlay_variant_id
    AND migration.overlay_kind = docks.overlay_kind
)
WHERE EXISTS (
  SELECT 1 FROM variant_kind_migration_0003 migration
  WHERE migration.source_id = docks.overlay_variant_id
    AND migration.overlay_kind = docks.overlay_kind
);

CREATE INDEX IF NOT EXISTS overlay_variants_user_kind_idx
  ON overlay_variants(user_id, overlay_kind, updated_at DESC);

DROP TABLE variant_kind_migration_0003;
