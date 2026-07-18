import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const catalogSource = fs.readFileSync(new URL('../public/reward-image-catalog.js', import.meta.url), 'utf8');
const rendererSource = fs.readFileSync(new URL('../public/rewards.js', import.meta.url), 'utf8');
const catalogContext = { window: {} };
vm.runInNewContext(catalogSource, catalogContext);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Could not find ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error(`Could not read ${name}`);
}

const functionNames = [
  'normalizeId',
  'normalizeName',
  'getIdFromImagePath',
  'getDisplayNameFromImagePath',
  'findCatalogEntryForReward'
];
const rendererContext = {
  window: { rewardImageCatalog: catalogContext.window.rewardImageCatalog }
};
vm.createContext(rendererContext);
vm.runInContext(functionNames.map(name => extractFunction(rendererSource, name)).join('\n'), rendererContext);

function resolve(item) {
  rendererContext.item = item;
  return vm.runInContext('findCatalogEntryForReward(item)', rendererContext);
}

const compactJabDom = {
  title: 'Jab Dom',
  giftNames: ['Gold Boxing Gloves'],
  giftIds: ['817'],
  giftImageNames: [],
  giftImageIds: [],
  image: ''
};
const correctImage = './rewards/817_Gold_Boxing_Gloves.png';

assert.equal(resolve(compactJabDom)?.image, correctImage, 'Name should disambiguate duplicate gift ID 817');
assert.equal(resolve({ ...compactJabDom, image: correctImage })?.image, correctImage, 'Explicit image should win');
assert.equal(resolve({ ...compactJabDom, title: '', giftNames: [] }), null, 'Ambiguous ID-only lookup should not guess');

console.log('Reward catalogue collision regression checks passed.');
