import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../cloudflare/src/worker.mjs';

class D1StatementMock {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1StatementMock(this.database, this.sql, values);
  }

  first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: result.changes } };
  }
}

class D1Mock {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new D1StatementMock(this.database, sql);
  }

  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

const database = new DatabaseSync(':memory:');
database.exec(fs.readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8'));
const broadcasts = [];
const env = {
  DB: new D1Mock(database),
  ALLOWED_ORIGINS: '*',
  REGISTRATION_ENABLED: 'true',
  DOCK_HUBS: {
    idFromName: name => name,
    get: id => ({
      fetch: async (url, options) => {
        broadcasts.push({ id, url: String(url), body: options?.body || '' });
        return new Response(null, { status: 204 });
      }
    })
  }
};

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const request = new Request(`https://api.example.test${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const response = await worker.fetch(request, env);
  return { response, body: await response.json() };
}

const serviceConfig = await api('/v1/config');
assert.equal(serviceConfig.response.status, 200);
assert.equal(serviceConfig.body.registrationEnabled, true);

const cleanServiceConfig = await api('/api/v1/config');
assert.equal(cleanServiceConfig.response.status, 200);
assert.equal(cleanServiceConfig.body.registrationEnabled, true);

const registration = await api('/v1/auth/register', {
  method: 'POST',
  body: { email: 'streamer@example.com', password: 'correct-horse-battery-staple' }
});
assert.equal(registration.response.status, 201);
assert.ok(registration.body.session.token);
const authHeaders = { Authorization: `Bearer ${registration.body.session.token}` };

const duplicateRegistration = await api('/v1/auth/register', {
  method: 'POST',
  body: { email: 'streamer@example.com', password: 'correct-horse-battery-staple' }
});
assert.equal(duplicateRegistration.response.status, 202);
assert.equal(duplicateRegistration.body.created, false);
assert.equal(duplicateRegistration.body.session, undefined);

const starterOutputs = await api('/v1/docks', { headers: authHeaders });
assert.equal(starterOutputs.response.status, 200);
assert.equal(starterOutputs.body.docks.length, 2);
assert.deepEqual(starterOutputs.body.docks.map(dock => dock.starterKind).sort(), ['horizontal', 'vertical']);
const verticalOutput = starterOutputs.body.docks.find(dock => dock.starterKind === 'vertical');
assert.equal(verticalOutput.width, 1080);
assert.equal(verticalOutput.height, 1920);
assert.equal(verticalOutput.sampleActivity, false);

const createdVariant = await api('/v1/variants', {
  method: 'POST',
  headers: authHeaders,
  body: { name: 'Gameplay Carousel', overlayKind: 'carousel', config: { rewards: [{ title: 'Rose', giftIds: ['1'] }] } }
});
assert.equal(createdVariant.response.status, 201);
assert.equal(createdVariant.body.variant.revision, 1);
assert.equal(createdVariant.body.variant.overlayKind, 'carousel');

const createdDock = await api('/v1/docks', {
  method: 'POST',
  headers: authHeaders,
  body: {
    name: 'Gameplay Rewards',
    width: 1280,
    height: 720
  }
});
assert.equal(createdDock.response.status, 201);
assert.ok(createdDock.body.dock.publicToken);
assert.equal(createdDock.body.dock.width, 1280);
assert.equal(createdDock.body.dock.items.length, 0);
assert.equal(createdDock.body.dock.sampleActivity, false);

const sampleDock = await api(`/v1/docks/${createdDock.body.dock.id}`, {
  method: 'PUT',
  headers: authHeaders,
  body: { sampleActivity: true }
});
assert.equal(sampleDock.response.status, 200);
assert.equal(sampleDock.body.dock.sampleActivity, true);
assert.equal(sampleDock.body.dock.name, 'Gameplay Rewards');
assert.equal(sampleDock.body.dock.width, 1280);

const createdItem = await api(`/v1/docks/${createdDock.body.dock.id}/items`, {
  method: 'POST',
  headers: authHeaders,
  body: {
    variantId: createdVariant.body.variant.id,
    overlayKind: 'carousel',
    x: 980,
    y: 180,
    width: 112,
    height: 318
  }
});
assert.equal(createdItem.response.status, 201);
assert.equal(createdItem.body.item.x, 980);
assert.equal(createdItem.body.item.width, 112);

const mismatchedItem = await api(`/v1/docks/${createdDock.body.dock.id}/items`, {
  method: 'POST',
  headers: authHeaders,
  body: { variantId: createdVariant.body.variant.id, overlayKind: 'rows' }
});
assert.equal(mismatchedItem.response.status, 409);

const publicDock = await api(`/v1/public/docks/${createdDock.body.dock.publicToken}`);
assert.equal(publicDock.response.status, 200);
assert.equal(publicDock.body.items.length, 1);
assert.equal(publicDock.body.items[0].variant.name, 'Gameplay Carousel');
assert.equal(publicDock.body.items[0].overlayKind, 'carousel');
assert.equal(publicDock.body.dock.sampleActivity, true);

const movedItem = await api(`/v1/docks/${createdDock.body.dock.id}/items/${createdItem.body.item.id}`, {
  method: 'PUT',
  headers: authHeaders,
  body: { x: 900, y: 250, width: 150, height: 350 }
});
assert.equal(movedItem.body.item.x, 900);
assert.equal(movedItem.body.item.height, 350);

const croppedItem = await api(`/v1/docks/${createdDock.body.dock.id}/items/${createdItem.body.item.id}`, {
  method: 'PUT',
  headers: authHeaders,
  body: { x: -75, y: 600 }
});
assert.equal(croppedItem.response.status, 200);
assert.equal(croppedItem.body.item.x, -75, 'Layers should support negative coordinates for edge cropping');
assert.equal(croppedItem.body.item.y, 600, 'Layers should be allowed to extend beyond the bottom edge');

const updatedVariant = await api(`/v1/variants/${createdVariant.body.variant.id}`, {
  method: 'PUT',
  headers: authHeaders,
  body: { name: 'Gameplay Carousel', overlayKind: 'carousel', config: { rewards: [{ title: 'Gold Boxing Gloves', giftIds: ['817'] }] } }
});
assert.equal(updatedVariant.body.variant.revision, 2);
assert.equal(JSON.parse(broadcasts.at(-1).body).type, 'variant.updated');
assert.equal(broadcasts.at(-1).id, createdDock.body.dock.id);

const protectedRequest = await api('/v1/variants');
assert.equal(protectedRequest.response.status, 401);

const inactiveLiveStatus = await api('/v1/live-status');
assert.equal(inactiveLiveStatus.response.status, 200);
assert.equal(inactiveLiveStatus.body.isLive, false);



env.ASSETS = {
  fetch: async request => {
    const name = new URL(request.url).pathname.split('/').at(-1);
    return new Response(fs.readFileSync(new URL('../public/' + name, import.meta.url)), { headers: { 'Content-Type': 'text/html' } });
  }
};
const directLink = await api('/v1/variants/' + createdVariant.body.variant.id + '/direct-link', { method: 'POST', headers: authHeaders });
assert.equal(directLink.response.status, 200);
const repeatedLink = await api('/v1/variants/' + createdVariant.body.variant.id + '/direct-link', { method: 'POST', headers: authHeaders });
assert.equal(repeatedLink.body.publicToken, directLink.body.publicToken, 'Retries must retain the direct link');
const directPublic = await api('/v1/public/docks/' + directLink.body.publicToken);
assert.equal(directPublic.response.status, 200);
assert.equal(directPublic.body.items.length, 1);
assert.equal(directPublic.body.items[0].variant.id, createdVariant.body.variant.id);
assert.equal(directPublic.body.items[0].variant.revision, 2, 'Direct link must load saved revisions');
assert.equal(directPublic.body.dock.sampleActivity, false);
assert.equal((await api('/v1/variants/' + createdVariant.body.variant.id + '/direct-link', { method: 'POST' })).response.status, 401);
const secondUser = await api('/v1/auth/register', { method: 'POST', body: { email: 'other@example.com', password: 'long-other-password' } });
const otherAuth = { Authorization: 'Bearer ' + secondUser.body.session.token };
assert.equal((await api('/v1/variants/' + createdVariant.body.variant.id + '/direct-link', { method: 'POST', headers: otherAuth })).response.status, 404);
await api('/v1/account', { method: 'DELETE', headers: otherAuth, body: { password: 'long-other-password', confirmation: 'DELETE' } });
for (const kind of ['rows', 'side-gifts', 'goal', 'top-likers']) {
 const variant = await api('/v1/variants', { method: 'POST', headers: authHeaders, body: { name: 'Direct ' + kind, overlayKind: kind, config: {} } });
 const link = await api('/v1/variants/' + variant.body.variant.id + '/direct-link', { method: 'POST', headers: authHeaders });
 assert.equal(link.response.status, 200);
 const standalone = await worker.fetch(new Request('https://site.example/widget/' + link.body.publicToken), env);
 assert.equal(standalone.status, 200);
 const markup = await standalone.text();
 assert.ok(markup.includes('/widget/' + link.body.publicToken + '/config.js'));
 assert.ok(markup.includes('/Widget/public/direct-widget.js'));
 assert.equal(markup.includes('<iframe'), false, 'Standalone sources must use the widget renderer directly');
 const bootstrap = await worker.fetch(new Request('https://site.example/widget/' + link.body.publicToken + '/config.js'), env);
 assert.ok((await bootstrap.text()).includes('window.directWidgetConfig='));
 const legacyLink = await worker.fetch(new Request('https://site.example/output/' + link.body.publicToken), env);
 assert.equal(legacyLink.status, 308);

 assert.ok(link.body.width > 0 && link.body.height > 0);
 const output = await api('/v1/public/docks/' + link.body.publicToken);
 assert.equal(output.body.items[0].overlayKind, kind);
 await api('/v1/variants/' + variant.body.variant.id, { method: 'DELETE', headers: authHeaders });
 assert.equal((await api('/v1/public/docks/' + link.body.publicToken)).response.status, 404, 'Deleted designs must invalidate links');
}

const accountExport = await api('/v1/account/export', { headers: authHeaders });
assert.equal(accountExport.response.status, 200);
assert.equal(accountExport.body.account.email, 'streamer@example.com');
assert.equal(accountExport.body.overlayVariants.length, 1);
assert.equal(accountExport.body.outputs.length, 3);
assert.equal(accountExport.body.outputItems.length, 1);
assert.equal(Object.hasOwn(accountExport.body.account, 'password_hash'), false);

const correctedEmail = await api('/v1/account/email', {
  method: 'PUT',
  headers: authHeaders,
  body: { email: 'updated@example.com', password: 'correct-horse-battery-staple' }
});
assert.equal(correctedEmail.response.status, 503);
assert.equal((await api('/v1/account/export', { headers: authHeaders })).body.account.email, 'streamer@example.com');

const rejectedDeletion = await api('/v1/account', {
  method: 'DELETE',
  headers: authHeaders,
  body: { confirmation: 'DELETE', password: 'incorrect-password' }
});
assert.equal(rejectedDeletion.response.status, 401);

const deletedAccount = await api('/v1/account', {
  method: 'DELETE',
  headers: authHeaders,
  body: { confirmation: 'DELETE', password: 'correct-horse-battery-staple' }
});
assert.equal(deletedAccount.response.status, 200);
assert.equal(database.prepare('SELECT count(*) AS count FROM users').get().count, 0);
assert.equal((await api('/v1/public/docks/' + directLink.body.publicToken)).response.status, 404);
assert.equal(database.prepare('SELECT count(*) AS count FROM overlay_variants').get().count, 0);
assert.equal(database.prepare('SELECT count(*) AS count FROM output_docks').get().count, 0);

env.AUTH_RATE_LIMIT_MAX = '3';
for (let attempt = 0; attempt < 3; attempt += 1) {
  const failedLogin = await api('/v1/auth/login', {
    method: 'POST',
    body: { email: 'missing@example.com', password: 'another-long-password' }
  });
  assert.equal(failedLogin.response.status, 401);
}
const rateLimitedLogin = await api('/v1/auth/login', {
  method: 'POST',
  body: { email: 'missing@example.com', password: 'another-long-password' }
});
assert.equal(rateLimitedLogin.response.status, 429);
assert.ok(rateLimitedLogin.response.headers.get('Retry-After'));

env.REGISTRATION_ENABLED = 'false';
const closedRegistration = await api('/v1/auth/register', {
  method: 'POST',
  body: { email: 'new@example.com', password: 'another-long-password' }
});
assert.equal(closedRegistration.response.status, 403);

let cleanupPromise;
await worker.scheduled({}, env, { waitUntil(promise) { cleanupPromise = promise; } });
await cleanupPromise;

console.log('Cloud API account rights, auth, variant, dock, and broadcast checks passed.');
