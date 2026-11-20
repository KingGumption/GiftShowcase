import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/overlay-cloud.js', import.meta.url), 'utf8');
const stored = new Map();
const sessionStored = new Map();
const requests = [];
const storage = map => ({
  get length() { return map.size; },
  getItem: key => map.get(key) ?? null,
  setItem: (key, value) => map.set(key, value),
  removeItem: key => map.delete(key),
  key: index => [...map.keys()][index] ?? null
});
const window = {
  overlayCloudConfig: {
    apiBaseUrl: 'https://api.example.test',
    appBaseUrl: 'https://app.example.test/overlays'
  },
  location: { href: 'https://app.example.test/overlays/index-obs-dock.html' },
  localStorage: storage(stored),
  sessionStorage: storage(sessionStored),
  dispatchEvent() {},
  setTimeout,
  clearTimeout
};

const context = {
  window,
  localStorage: window.localStorage,
  CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  Headers,
  URL,
  FormData,
  WebSocket: class {},
  fetch: async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/v1/auth/login')) {
      return new Response(JSON.stringify({
        session: { token: 'session-token', expiresAt: '2099-01-01', user: { id: 'user-1', email: 'test@example.com' } }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ variants: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

vm.runInNewContext(source, context);
const cloud = window.overlayCloud;

assert.equal(cloud.enabled, true);
await cloud.login('test@example.com', 'long-enough-password');
assert.equal(cloud.signedIn, true);
assert.equal(JSON.parse(sessionStored.get('reward-overlay-cloud-session:v1')).token, 'session-token');
assert.equal(stored.has('reward-overlay-cloud-session:v1'), false);

await cloud.listVariants();
assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer session-token');
assert.equal(cloud.getDockUrl('read-only-token'), 'https://app.example.test/overlays/index-dock.html?dock=read-only-token');

await cloud.createDockItem('dock-1', { variantId: 'variant-1', overlayKind: 'goal' });
assert.equal(requests[2].url, 'https://api.example.test/v1/docks/dock-1/items');
assert.equal(requests[2].options.method, 'POST');

stored.set('reward-overlay-config:v1', '{}');
stored.set('tiktok-top-likers:3', '[]');
stored.set('unrelated-key', 'keep');
assert.equal(cloud.clearLocalOverlayData().length, 2);
assert.equal(stored.get('unrelated-key'), 'keep');

console.log('Overlay cloud client contract checks passed.');
