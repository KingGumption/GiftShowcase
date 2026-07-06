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

function createHarness() {
  const elements = new Map();
  const timers = [];
  const storage = new Map();

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
      location: {
        hash: '#config=eyJfIjoicjIiLCJxIjp7ImoiOiJzdXBwb3J0IiwibCI6MTAwfX0',
        search: ''
      },
      rewardOverlayConfig: {}
    }
  };

  vm.createContext(context);
  vm.runInContext(scriptSource, context, { filename: 'script.js' });

  return {
    context,
    elements,
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
