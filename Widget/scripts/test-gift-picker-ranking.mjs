import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/rewards-admin.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Could not find ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not read ${name}`);
}

const context = {
  isGiftFavorite: image => image === 'gg-hype.png'
};
vm.createContext(context);
vm.runInContext([
  extractFunction('normalizeName'),
  extractFunction('getGiftSearchRank'),
  extractFunction('sortGiftEntriesForPicker')
].join('\n'), context);

context.entries = [
  { id: '101', name: 'Egg Basket', label: 'Egg Basket', image: 'egg.png' },
  { id: '836', name: 'GG Hype', label: 'GG Hype', image: 'gg-hype.png' },
  { id: '8327', name: 'Epic GG', label: 'Epic GG', image: 'epic-gg.png' },
  { id: '30', name: 'GG', label: 'GG', image: 'gg.png' },
  { id: '913', name: 'Super GG', label: 'Super GG', image: 'super-gg.png' }
];

const ranked = vm.runInContext(`sortGiftEntriesForPicker(entries, 'gg')`, context);
assert.deepEqual(Array.from(ranked, entry => entry.name), [
  'GG',
  'GG Hype',
  'Epic GG',
  'Super GG',
  'Egg Basket'
], 'Exact matches should outrank favourites and broader substring matches');

const idRanked = vm.runInContext(`sortGiftEntriesForPicker(entries, '30')`, context);
assert.equal(idRanked[0].name, 'GG', 'An exact gift ID should also rank first');

console.log('Gift picker search relevance checks passed.');
