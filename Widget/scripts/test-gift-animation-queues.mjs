import assert from 'node:assert/strict';
import fs from 'node:fs';

const carousel = fs.readFileSync(new URL('../public/rewards.js', import.meta.url), 'utf8');
const rows = fs.readFileSync(new URL('../public/rewards-rows.js', import.meta.url), 'utf8');
const sideGifts = fs.readFileSync(new URL('../public/side-gifts.js', import.meta.url), 'utf8');
const carouselHtml = fs.readFileSync(new URL('../public/index-rewards.html', import.meta.url), 'utf8');
const rowsHtml = fs.readFileSync(new URL('../public/index-rewards-rows.html', import.meta.url), 'utf8');
const sideGiftsHtml = fs.readFileSync(new URL('../public/index-side-gifts.html', import.meta.url), 'utf8');
const designerHtml = fs.readFileSync(new URL('../public/index-rewards-config.html', import.meta.url), 'utf8');

assert.match(carousel, /const giftQueues = new Map\(\)/, 'Carousel should keep a separate queue for each configured reward');
assert.match(carousel, /return `reward:\$\{rewardIndex\}`/, 'Carousel queue identity should be the configured reward');
assert.match(carousel, /readyKeys\.find\(key => key !== previousQueueKey\) \|\| readyKeys\[0\]/, 'Carousel should give a different ready gift priority over repeats of the current gift');
assert.doesNotMatch(carousel, /let giftQueue = \[\]/, 'Carousel should not use the old global FIFO queue');
assert.match(carousel, /queueTestReward\(repeatedReward,[\s\S]*?queueTestReward\(concurrentReward,[\s\S]*?queueTestReward\(repeatedReward/, 'Carousel preview should demonstrate repeated and competing gift queues');

assert.match(rows, /const rowGiftAnimationQueues = new Map\(\)/, 'Rows should keep independent per-gift animation queues');
assert.match(rows, /groupRowsAnimationTiles\(matchingTiles\)\.forEach/, 'Rows should group duplicate rendered tiles into one configured-gift queue');
assert.match(rows, /state\.pending\.push\(\{ tiles, gift \}\)/, 'Rows should retain every repeated gift event');
assert.match(rows, /runNextRowsGiftAnimation\(queueKey, state\)/, 'Rows should advance only the completed gift queue');
assert.match(rows, /clearRowProfileAnimations\(tiles\)/, 'Rows animation cleanup should be scoped to the current gift');
assert.match(rows, /clearRowsGiftAnimation\(job\.tiles\);\s*job\.tiles\.forEach\(tile => void tile\.offsetWidth\);\s*updateRowsGiftImage/, 'Rows should flush removed classes before restarting the next queued animation');
assert.doesNotMatch(rows, /querySelectorAll\('\.reward-gift-tile\.is-hit'\)/, 'Rows should not cancel every other gift hit globally');
assert.match(rows, /queueTestGift\(repeatedGift,[\s\S]*?queueTestGift\(concurrentGift,[\s\S]*?queueTestGift\(repeatedGift/, 'Rows preview should demonstrate concurrent gifts and a repeated-gift queue');

assert.match(sideGifts, /const sideGiftAnimationQueues = new Map\(\)/, 'Side Gifts should keep independent per-gift animation queues');
assert.match(sideGifts, /groupSideGiftAnimationTiles\(matchingTiles\)\.forEach/, 'Side Gifts should group tiles by configured gift identity');
assert.match(sideGifts, /state\.pending\.push\(\{ tiles, gift \}\)/, 'Side Gifts should retain every repeated gift event');
assert.match(sideGifts, /runNextSideGiftAnimation\(queueKey, state\)/, 'Side Gifts should advance only the completed gift queue');
assert.match(sideGifts, /clearSideGiftProfileAnimations\(tiles\)/, 'Side Gifts animation cleanup should be scoped to the current gift');
assert.match(sideGifts, /clearSideGiftAnimation\(job\.tiles\);\s*job\.tiles\.forEach\(tile => void tile\.offsetWidth\);\s*updateSideGiftImages/, 'Side Gifts should flush removed classes before restarting the next queued animation');
assert.doesNotMatch(sideGifts, /sideGiftHighlightTimer/, 'Side Gifts should not retain the old shared highlight timer');
assert.match(sideGifts, /queueTestSideGift\(repeatedGift,[\s\S]*?queueTestSideGift\(concurrentGift,[\s\S]*?queueTestSideGift\(repeatedGift/, 'Side Gifts preview should demonstrate concurrent gifts and a repeated-gift queue');

assert.match(carouselHtml, /rewards\.js\?v=[^"]+/, 'Carousel Browser Sources should fetch the queue-aware renderer');
assert.match(rowsHtml, /rewards-rows\.js\?v=[^"]+/, 'Rows Browser Sources should fetch the queue-aware renderer');
assert.match(sideGiftsHtml, /side-gifts\.js\?v=[^"]+/, 'Side Gifts Browser Sources should fetch the queue-aware renderer');
assert.equal((designerHtml.match(/Auto-play samples/g) || []).length, 3, 'Designer should label all three queue-aware preview toggles clearly');

console.log('Gift animation queue checks passed.');
