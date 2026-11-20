import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/dock-runtime.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 15));

assert.doesNotMatch(
  source,
  /Connecting to TikFinity|Waiting for TikFinity|TikFinity connection interrupted/,
  'TikFinity availability should not add a visible status badge to a static output'
);
assert.match(
  source,
  /if \(isSampleActivityEnabled\(\)\) search\.set\('test', '1'\)/,
  'The complete output test preview should pass test mode to every renderer'
);
assert.match(
  source,
  /return params\.get\('test'\) === '1' \|\| Boolean\(currentDock\?\.sampleActivity\)/,
  'Test previews should not open a live TikFinity connection'
);
assert.match(
  source,
  /height: getSideGiftsNaturalHeight\(config\.sideGifts, dimensions\.height\)/,
  'The final Browser Source should fit Side Gifts height to its occupied rows'
);
assert.match(
  source,
  /height: getRowsNaturalHeight\(config\.rowsOverlay\)/,
  'The final Browser Source should derive the Rows height from its configured rows, row height, and gap'
);

class ClassListMock {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  toggle(name, enabled) { enabled ? this.values.add(name) : this.values.delete(name); }
}

class FrameMock {
  constructor() {
    this.listeners = new Map();
    this.classList = new ClassListMock();
    this.contentWindow = { messages: [], postMessage: message => this.contentWindow.messages.push(message) };
    this.style = {};
  }
  set className(value) { value.split(/\s+/).filter(Boolean).forEach(name => this.classList.add(name)); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  setAttribute() {}
  remove() { this.removed = true; }
}

const stage = {
  frames: [],
  style: {},
  append(frame) {
    this.frames.push(frame);
    setTimeout(() => frame.listeners.get('load')?.(), 0);
  }
};
const status = { textContent: '', classList: new ClassListMock() };
let revision = 1;
let sampleActivity = false;
let liveCallbacks;
const payload = () => ({
  dock: { id: 'dock-1', name: 'Gameplay', width: 1920, height: 1080, sampleActivity, updatedAt: `update-${revision}-${sampleActivity}` },
  items: [
    { id: 'item-1', overlayKind: 'carousel', x: 1600, y: 300, width: 224, height: 700, zIndex: 1, visible: true, updatedAt: `item-${revision}`, variant: { id: 'variant-1', name: 'Rewards', revision, config: { rewards: [{ title: 'Rose' }] } } },
    { id: 'item-2', overlayKind: 'goal', x: 420, y: 20, width: 1080, height: 44, zIndex: 0, visible: true, updatedAt: 'goal-1', variant: { id: 'variant-2', name: 'Goal', revision: 1, config: { goal: { enabled: true } } } },
    { id: 'item-3', overlayKind: 'rows', x: 420, y: 700, width: 1080, height: 120, zIndex: 2, visible: true, updatedAt: 'rows-1', variant: { id: 'variant-3', name: 'Rows', revision: 1, config: { rowsOverlay: { rows: 2, rowHeight: 80, gap: 0 } } } }
  ]
});
const overlayCloud = {
  enabled: true,
  getPublicDock: async () => payload(),
  subscribeDock(token, callbacks) {
    assert.equal(token, 'public-token');
    liveCallbacks = callbacks;
    return () => {};
  }
};

class WebSocketMock {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = WebSocketMock.OPEN;
    this.listeners = new Map();
    WebSocketMock.instances.push(this);
    setTimeout(() => this.listeners.get('open')?.(), 0);
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  close() {
    this.readyState = 3;
    this.closed = true;
    this.listeners.get('close')?.();
  }
}

const window = {
  overlayCloud,
  location: {
    href: 'https://app.example.test/index-dock.html?dock=public-token',
    search: '?dock=public-token'
  },
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 1920,
  innerHeight: 1080,
  clearTimeout,
  setTimeout,
  localStorage: { setItem() {}, getItem() { return null; } }
};
const context = {
  window,
  document: {
    querySelector: selector => selector === '#dock-stage' ? stage : status,
    createElement: () => new FrameMock()
  },
  URL,
  URLSearchParams,
  TextEncoder,
  WebSocket: WebSocketMock,
  localStorage: window.localStorage,
  btoa,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(source, context);
await tick();

assert.equal(WebSocketMock.instances.length, 1, 'Dock should own one TikFinity connection');
assert.equal(stage.frames.length, 3);
assert.ok(stage.frames.some(frame => /index-rewards\.html/.test(frame.src)));
assert.ok(stage.frames.some(frame => /index-thin\.html/.test(frame.src)));
assert.ok(stage.frames.some(frame => /index-rewards-rows\.html/.test(frame.src)));
assert.ok(stage.frames.every(frame => /stateKey=public-token%3Aitem-/.test(frame.src)));
const carouselFrame = stage.frames.find(frame => /index-rewards\.html/.test(frame.src));
assert.equal(carouselFrame.style.width, '192px', 'Carousel frame should include horizontal glow overscan');
assert.equal(carouselFrame.style.height, '398px', 'Carousel frame should include vertical glow overscan');
assert.equal(carouselFrame.style.transform, 'scale(2) translate(-40px, -40px)', 'Output scale and glow overscan must preserve the carousel anchor');
const rowsFrame = stage.frames.find(frame => /index-rewards-rows\.html/.test(frame.src));
assert.equal(rowsFrame.style.height, '160px', 'Two 80px rows should use exactly 160px without transparent vertical overscan');
assert.equal(rowsFrame.style.transform, 'scale(1) translate(-0px, -0px)', 'A stale shorter layer height must not reduce the Rows width scale');

revision = 2;
liveCallbacks.onChange({ type: 'variant.updated', revision });
await tick();

assert.equal(WebSocketMock.instances.length, 1, 'Visual hot swap must not reconnect TikFinity');
assert.equal(stage.frames.length, 4);
assert.equal(stage.frames.filter(frame => frame.removed).length, 1, 'Only the changed layer should be replaced');
assert.equal(stage.frames.filter(frame => !frame.removed).length, 3);

WebSocketMock.instances[0].listeners.get('message')?.({ data: '{"event":"like","data":{"likeCount":1}}' });
assert.ok(stage.frames.filter(frame => !frame.removed).every(frame => frame.contentWindow.messages.length === 1), 'Every active layer should receive relayed TikFinity events');

sampleActivity = true;
liveCallbacks.onChange({ type: 'dock.updated', sampleActivity });
await tick();

assert.equal(WebSocketMock.instances[0].closed, true, 'Turning on sample activity should disconnect TikFinity');
assert.equal(WebSocketMock.instances.length, 1, 'Sample activity should not create another TikFinity connection');
assert.ok(stage.frames.filter(frame => !frame.removed).every(frame => new URL(frame.src).searchParams.get('test') === '1'), 'Every active renderer should switch to sample activity');
assert.ok(stage.frames.filter(frame => !frame.removed).every(frame => new URL(frame.src).searchParams.get('mute') === '1'), 'Saved sample activity should remain muted for positioning');

sampleActivity = false;
liveCallbacks.onChange({ type: 'dock.updated', sampleActivity });
await tick();

assert.equal(WebSocketMock.instances.length, 2, 'Turning sample activity off should reconnect the same output to TikFinity');
assert.ok(stage.frames.filter(frame => !frame.removed).every(frame => !new URL(frame.src).searchParams.has('test')), 'Every active renderer should return to live mode');

console.log('Dock runtime hot-swap and persistent TikFinity relay checks passed.');
