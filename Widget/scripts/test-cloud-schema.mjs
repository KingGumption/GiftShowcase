import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const schema = fs.readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8');
const database = new DatabaseSync(':memory:');
database.exec(schema);

for (const table of ['users', 'sessions', 'auth_rate_limits', 'overlay_variants', 'overlay_revisions', 'docks', 'output_docks', 'dock_items', 'site_live_status','creator_upload_limits','creator_image_objects','creator_image_audit_state','account_action_tokens']) {
  const row = database.prepare(`SELECT count(*) AS count FROM ${table}`).get();
  assert.equal(row.count, 0, `${table} should be created and initially empty`);
}

database.prepare(`INSERT INTO users (id, email, password_salt, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('user-1', 'legacy@example.com', 'salt', 'hash', '2026-01-01', '2026-01-01');
database.prepare(`INSERT INTO overlay_variants (id, user_id, name, config_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run('variant-1', 'user-1', 'Legacy', '{}', 1, '2026-01-01', '2026-01-01');
database.prepare(`INSERT INTO docks (id, user_id, name, public_token, overlay_variant_id, overlay_kind, width, height, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run('legacy-dock', 'user-1', 'Legacy Dock', 'legacy-token', 'variant-1', 'carousel', 112, 318, '2026-01-01', '2026-01-01');

const migration = fs.readFileSync(new URL('../cloudflare/migrations/0002_composite_output_docks.sql', import.meta.url), 'utf8');
database.exec(migration);
database.exec(migration);
assert.equal(database.prepare('SELECT count(*) AS count FROM output_docks WHERE user_id = ?').get('user-1').count, 3, 'Migration should preserve the legacy output and add two starters exactly once');
assert.equal(database.prepare('SELECT count(*) AS count FROM dock_items WHERE dock_id = ?').get('legacy-dock').count, 1, 'Migration should preserve a legacy overlay as one layer without duplication');
const legacyCleanup = fs.readFileSync(new URL('../cloudflare/migrations/0004_remove_legacy_docks.sql', import.meta.url), 'utf8');
database.exec(legacyCleanup);
assert.equal(database.prepare('SELECT count(*) AS count FROM docks').get().count, 0, 'Obsolete single-overlay rows should be removed after composite migration');

const legacySchema = schema
  .replace(/\s+overlay_kind TEXT NOT NULL DEFAULT 'carousel' CHECK\(overlay_kind IN \([^\n]+\)\),\n/, '\n')
  .replace(/\s+sample_activity INTEGER NOT NULL DEFAULT 0,\n/, '\n')
  .replace(/CREATE INDEX IF NOT EXISTS overlay_variants_user_kind_idx[^;]+;\n/, '');
const legacyDatabase = new DatabaseSync(':memory:');
legacyDatabase.exec(legacySchema);
legacyDatabase.prepare(`INSERT INTO users (id, email, password_salt, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('user-typed', 'typed@example.com', 'salt', 'hash', '2026-01-01', '2026-01-01');
legacyDatabase.prepare(`INSERT INTO overlay_variants (id, user_id, name, config_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run('bundle-1', 'user-typed', 'Gameplay', '{"rowsOverlay":{"rows":3}}', 2, '2026-01-01', '2026-01-02');
legacyDatabase.prepare(`INSERT INTO overlay_revisions (id, overlay_variant_id, revision, config_json, created_at) VALUES (?, ?, ?, ?, ?)`)
  .run('revision-1', 'bundle-1', 1, '{"rowsOverlay":{"rows":2}}', '2026-01-01');
legacyDatabase.prepare(`INSERT INTO output_docks (id, user_id, name, public_token, width, height, starter_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run('typed-output', 'user-typed', 'Output', 'typed-token', 1920, 1080, null, '2026-01-01', '2026-01-01');
legacyDatabase.prepare(`INSERT INTO dock_items (id, dock_id, overlay_variant_id, overlay_kind, x, y, width, height, z_index, visible, locked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run('rows-item', 'typed-output', 'bundle-1', 'rows', 0, 0, 1080, 240, 0, 1, 0, '2026-01-01', '2026-01-01');

const typedMigration = fs.readFileSync(new URL('../cloudflare/migrations/0003_typed_overlay_variants.sql', import.meta.url), 'utf8');
legacyDatabase.exec(typedMigration);
const sampleActivityMigration = fs.readFileSync(new URL('../cloudflare/migrations/0005_output_sample_activity.sql', import.meta.url), 'utf8');
legacyDatabase.exec(sampleActivityMigration);
assert.equal(legacyDatabase.prepare(`SELECT sample_activity FROM output_docks WHERE id = ?`).get('typed-output').sample_activity, 0, 'Existing outputs should remain live after adding the sample activity switch');
const typedVariants = legacyDatabase.prepare(`SELECT id, overlay_kind, config_json FROM overlay_variants WHERE user_id = ? ORDER BY overlay_kind`).all('user-typed');
assert.deepEqual(typedVariants.map(variant => variant.overlay_kind).sort(), ['carousel', 'goal', 'rows', 'side-gifts', 'top-likers']);
assert.ok(typedVariants.every(variant => variant.config_json === '{"rowsOverlay":{"rows":3}}'), 'Every typed copy should preserve the bundled config');
const migratedRowsItem = legacyDatabase.prepare(`SELECT item.overlay_variant_id, variant.overlay_kind FROM dock_items item JOIN overlay_variants variant ON variant.id = item.overlay_variant_id WHERE item.id = ?`).get('rows-item');
assert.equal(migratedRowsItem.overlay_kind, 'rows', 'Existing output layers should point to the matching typed copy');
assert.notEqual(migratedRowsItem.overlay_variant_id, 'bundle-1', 'Non-carousel output layers should be rewired from the original bundle');
assert.equal(legacyDatabase.prepare(`SELECT count(*) AS count FROM overlay_revisions`).get().count, 5, 'Revision history should be copied to every typed variant');

const privacyMigrationDatabase = new DatabaseSync(':memory:');
privacyMigrationDatabase.exec(`CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);
const privacyMigration = fs.readFileSync(new URL('../cloudflare/migrations/0006_privacy_and_auth_hardening.sql', import.meta.url), 'utf8');
privacyMigrationDatabase.exec(privacyMigration);
const migratedUserColumns = privacyMigrationDatabase.prepare('PRAGMA table_info(users)').all().map(column => column.name);
assert.ok(migratedUserColumns.includes('password_iterations'), 'Existing accounts should gain a password work-factor column');
assert.equal(privacyMigrationDatabase.prepare('SELECT count(*) AS count FROM auth_rate_limits').get().count, 0, 'Authentication rate-limit storage should be created');

console.log('Cloud D1 schema checks passed.');

const directMigration = fs.readFileSync(new URL('../cloudflare/migrations/0008_variant_direct_links.sql', import.meta.url), 'utf8');
database.exec(directMigration);
database.exec(directMigration);
assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name = 'variant_links'").get().name, 'variant_links');
