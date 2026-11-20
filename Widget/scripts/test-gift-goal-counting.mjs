import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const scriptSource = readFileSync(new URL('../public/script.js', import.meta.url), 'utf8');

function createClassList(classes = []) {
  const values = new Set(classes);
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item),
    toggle: (item, force) => {
      const shouldAdd = force ?? !values.has(item);
      if (shouldAdd) {
        values.add(item);
      } else {
        values.delete(item);
      }
      return shouldAdd;
    }
  };
}

function createElement(classes = []) {
  return {
    ariaValueNow: '',
    classList: createClassList(classes),
    clientWidth: 200,
    innerHTML: '',
    scrollWidth: 0,
    style: {
      removeProperty() {},
      setProperty() {}
    },
    textContent: '',
    append() {},
    offsetWidth: 0,
    querySelector() {
      return createElement();
    },
    setAttribute(name, value) {
      this[name] = value;
    }
  };
}

function createHarness(options = {}) {
  const elements = new Map();
  const timers = [];
  const storage = new Map();
  const listeners = new Map();
  const sockets = [];
  const parent = { postMessage() {} };
  if (options.saved) storage.set('tiktok-goal-widget:dock:test:likes', JSON.stringify(options.saved));

  [
    '#like-count',
    '#like-goal',
    '#like-percent',
    '#like-progress',
    '.bar',
    '.counter',
    '#supporter',
    '#gift-detail',
    '#support-avatar',
    '#gift-icon',
    '.support-widget',
    '#status',
    '.thin-source .heading span',
    '.thin-source .heading-icon'
  ].forEach(selector => elements.set(selector, createElement(selector === '.counter' ? ['counter'] : [])));

  elements.get('#like-count').scrollWidth = 20;
  elements.get('.counter').clientWidth = 120;

  class FakeWebSocket {
    constructor() {
      this.listeners = new Map();
      sockets.push(this);
    }

    addEventListener(event, handler) {
      this.listeners.set(event, handler);
    }
  }

  const context = {
    Date,
    Error,
    Intl,
    Math,
    Number,
    String,
    URLSearchParams,
    WebSocket: FakeWebSocket,
    console: {
      groupCollapsed() {},
      groupEnd() {},
      info() {},
      log() {},
      table() {},
      warn() {}
    },
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    escape,
    document: {
      body: {
        classList: createClassList(['thin-source']),
        style: {
          setProperty() {}
        }
      },
      documentElement: {
        style: {
          setProperty() {}
        }
      },
      contains: () => true,
      querySelector: selector => elements.get(selector) || null
    },
    getComputedStyle: () => ({ fontSize: '15px' }),
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    requestAnimationFrame: handler => {
      handler();
      return 0;
    },
    setInterval: () => 0,
    setTimeout: handler => {
      timers.push(handler);
      return handler;
    },
    clearTimeout: handler => {
      const index = timers.indexOf(handler);
      if (index >= 0) {
        timers.splice(index, 1);
      }
    },
    window: {
      parent,
      addEventListener: (name, handler) => listeners.set(name, handler),
      location: {
        hash: options.hash ?? '#config=eyJfIjoicjIiLCJxIjp7ImoiOiJzdXBwb3J0IiwibCI6MTAwfX0',
        search: options.search || ''
      },
      rewardOverlayConfig: {}
    }
  };

  vm.createContext(context);
  vm.runInContext(scriptSource, context, { filename: 'script.js' });

  return {
    context,
    elements,
    sockets,
    relay(event, data, source = parent) {
      listeners.get('message')({ source, data: { type: 'dock:tiktok-raw', data: JSON.stringify({event, data}) } });
    },
    runNextTimer() {
      const timer = timers.shift();
      assert.equal(typeof timer, 'function', 'expected a queued timer');
      timer();
    },
    getCount() {
      return Number(elements.get('#like-count').textContent.replace(/,/g, ''));
    }
  };
}

function gift(overrides = {}) {
  return {
    giftId: '5655',
    giftName: 'Rose',
    giftType: 1,
    diamondCount: 1,
    repeatCount: 1,
    repeatEnd: false,
    msgId: 'rose-1',
    userId: 'user-1',
    uniqueId: 'viewer',
    ...overrides
  };
}

test('streak gift fallback plus late repeatEnd only counts once', () => {
  const harness = createHarness();

  harness.context.handleTikfinityEvent('gift', gift({ repeatEnd: false, msgId: 'rose-1' }));
  assert.equal(harness.getCount(), 0);

  harness.runNextTimer();
  assert.equal(harness.getCount(), 1);

  harness.context.handleTikfinityEvent('gift', gift({ repeatEnd: true, msgId: 'rose-1' }));
  assert.equal(harness.getCount(), 1);
});

test('non-streak gifts count every event from the same user and gift', () => {
  const harness = createHarness();

  harness.context.handleTikfinityEvent('gift', gift({
    giftId: 'super-gg',
    giftName: 'Super GG',
    giftType: 0,
    diamondCount: 10,
    msgId: 'super-gg-1'
  }));
  harness.context.handleTikfinityEvent('gift', gift({
    giftId: 'super-gg',
    giftName: 'Super GG',
    giftType: 0,
    diamondCount: 10,
    msgId: 'super-gg-2'
  }));

  assert.equal(harness.getCount(), 20);
});

test('separate single rose streaks from same user count separately when msgId changes', () => {
  const harness = createHarness();

  harness.context.handleTikfinityEvent('gift', gift({ repeatEnd: false, msgId: 'rose-1' }));
  harness.context.handleTikfinityEvent('gift', gift({ repeatEnd: false, msgId: 'rose-2' }));

  assert.equal(harness.getCount(), 1);
  harness.runNextTimer();
  assert.equal(harness.getCount(), 2);
});

const likeOptions = { hash: '', search: '?relay=1&stateKey=test', saved: { likes: 45000, savedAt: Date.now() } };
test('Stream Output resets saved 45k and accepts the new broadcast total', () => {
  const h = createHarness(likeOptions);
  assert.equal(h.getCount(), 0);
  h.relay('like', { totalLikeCount: 45000 });
  h.relay('like', { totalLikeCount: 120 });
  assert.equal(h.getCount(), 120);
  h.relay('like', { totalLikeCount: 0, likeCount: 9 });
  assert.equal(h.getCount(), 0);
  h.relay('like', { likeCount: 3 });
  assert.equal(h.getCount(), 3);
  h.relay('like', { totalLikeCount: 999 }, {});
  assert.equal(h.getCount(), 3, 'Only the parent can relay events');
});
test('same-room reconnect preserves progress; changed room resets', () => {
  const h = createHarness(likeOptions);
  h.relay('connected', { roomId: 'first' });
  h.relay('like', { totalLikeCount: 45000 });
  h.relay('connected', { roomId: 'first' });
  assert.equal(h.getCount(), 45000);
  h.relay('connected', { roomId: 'second' });
  assert.equal(h.getCount(), 0);
});
test('stream end preserves the final score until the next stream activity', () => {
  const h = createHarness(likeOptions);
  h.relay('like', { totalLikeCount: 45000 });
  h.relay('streamEnd', {});
  assert.equal(h.getCount(), 45000);
  h.relay('like', { likeCount: 2 });
  assert.equal(h.getCount(), 2);
});
test('keep-count setting preserves stored progress across stream boundaries', () => {
  const h = createHarness({ ...likeOptions, search: '?relay=1&stateKey=test&resetOnConnect=0' });
  assert.equal(h.getCount(), 45000);
  h.relay('streamEnd', {});
  h.relay('connected', { roomId: 'new' });
  h.relay('like', { totalLikeCount: 3 });
  assert.equal(h.getCount(), 45000);
});
test('direct websocket resets on initial connection but not transport reconnect', () => {
  const h = createHarness({ ...likeOptions, search: '?stateKey=test' });
  assert.equal(h.getCount(), 45000);
  h.sockets[0].listeners.get('open')();
  h.context.handleTikfinityEvent('like', { totalLikeCount: 150 });
  h.sockets[0].listeners.get('close')();
  h.runNextTimer();
  h.sockets[1].listeners.get('open')();
  assert.equal(h.getCount(), 150);
});
test('new stream cancels pending gift streaks from the old stream', () => {
  const h = createHarness();
  h.context.handleTikfinityEvent('gift', gift());
  h.context.handleTikfinityEvent('streamEnd', {});
  h.context.handleTikfinityEvent('connected', { roomId: 'next' });
  assert.throws(() => h.runNextTimer(), /expected a queued timer/);
  assert.equal(h.getCount(), 0);
  h.context.handleTikfinityEvent('gift', gift({ repeatEnd: true }));
  assert.equal(h.getCount(), 1);
});
