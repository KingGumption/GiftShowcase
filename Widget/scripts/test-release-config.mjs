import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('release configuration preserves Cloudflare-managed settings', () => {
  const config = JSON.parse(readFileSync(new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.keep_vars, true);
  for (const name of ['RESEND_API_KEY', 'EULER_API_KEY', 'ACCOUNT_EMAIL_FROM', 'INVITE_NOTIFY_EMAIL', 'EULER_ACCOUNT_ID']) {
    assert.equal(Object.hasOwn(config.vars, name), false, name + ' belongs in Cloudflare');
  }
  const database = config.d1_databases.find(binding => binding.binding === 'DB');
  assert.ok(database?.database_name);
  assert.equal(Object.hasOwn(database, 'database_id'), false);
});
