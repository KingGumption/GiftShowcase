import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const defaultCatalogPath = path.join(rootDir, 'Widget/public/reward-image-catalog.js');
const defaultAssetsDir = path.join(rootDir, 'Widget/public/gift-assets');

const args = parseArgs(process.argv.slice(2));

if (!args.user && !args.input && args._?.[0]) {
  args.user = args._[0];
}

if (args.help || (!args.user && !args.input)) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const catalogPath = path.resolve(args.catalog || defaultCatalogPath);
const assetsDir = path.resolve(args.assets || defaultAssetsDir);
const shouldDownload = args.download !== 'false' && !args.remote;

const existingCatalog = await readExistingCatalog(catalogPath);
const harvestedGifts = args.input
  ? await readInputGifts(path.resolve(args.input))
  : await fetchRoomGifts(args.user);

const normalizedGifts = normalizeGiftList(harvestedGifts);

if (!normalizedGifts.length) {
  throw new Error('No gifts found in the harvested data.');
}

await mkdir(assetsDir, { recursive: true });

const nextGifts = [];

for (const gift of normalizedGifts) {
  const nextGift = { ...gift };

  if (shouldDownload && gift.sourceImage) {
    nextGift.image = await downloadGiftImage(gift, assetsDir);
  } else {
    nextGift.image = gift.sourceImage || gift.image;
  }

  delete nextGift.sourceImage;
  nextGifts.push(nextGift);
}

const mergedCatalog = mergeCatalogs(existingCatalog, nextGifts);
await writeCatalog(catalogPath, mergedCatalog);

console.log(`Harvested ${normalizedGifts.length} gifts.`);
console.log(`Catalog now contains ${mergedCatalog.length} gifts.`);
console.log(`Wrote ${path.relative(rootDir, catalogPath)}`);

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      parsed._.push(arg);
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split('=');
    const value = inlineValue ?? argv[index + 1];

    if (inlineValue === undefined && value && !value.startsWith('--')) {
      index += 1;
    }

    parsed[key] = value ?? true;
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  npm run harvest:gifts -- --user <tiktokUniqueId>
  npm run harvest:gifts -- <tiktokUniqueId>
  npm run harvest:gifts -- --input <provider-dump.json>

Options:
  --user <name>       TikTok uniqueId for a streamer who is currently live.
  --input <file>      JSON gift list/export to normalize instead of fetching live.
  --catalog <file>    Output catalog JS file. Defaults to Widget/public/reward-image-catalog.js.
  --assets <dir>      Output image directory. Defaults to Widget/public/gift-assets.
  --sign-api-key <key> Euler Stream API key. Can also use SIGN_API_KEY env var.
  --remote            Keep provider image URLs instead of downloading images locally.
  --download=false    Same as --remote.
`);
}

async function fetchRoomGifts(uniqueId) {
  let connector;

  try {
    connector = await import('tiktok-live-connector');
  } catch {
    throw new Error('Missing dependency. Run: npm install');
  }

  const { TikTokLiveConnection } = connector;
  const connection = new TikTokLiveConnection(uniqueId, {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    signApiKey: args['sign-api-key'] || process.env.SIGN_API_KEY
  });

  console.log(`Fetching room gift list for @${uniqueId}...`);
  try {
    const roomId = await connection.fetchRoomId();
    console.log(`Resolved room ID: ${roomId}`);
    return await connection.fetchAvailableGifts();
  } catch (error) {
    const message = error?.message || String(error);
    const premiumHint = /Business plan|Premium|permission/i.test(message)
      ? ' This route requires Euler Stream signing access. Use --sign-api-key with a key that has access, or harvest from a provider JSON dump with --input.'
      : '';
    throw new Error(
      `Could not fetch gifts for @${uniqueId}. The account may not be live, the username may be wrong, or TikTok blocked the signed request.${premiumHint} Original error: ${message}`
    );
  } finally {
    await connection.disconnect?.().catch?.(() => {});
  }
}

async function readInputGifts(inputPath) {
  const raw = await readFile(inputPath, 'utf8');
  return JSON.parse(raw);
}

async function readExistingCatalog(catalogPath) {
  try {
    const raw = await readFile(catalogPath, 'utf8');
    const match = raw.match(/window\.rewardImageCatalog\s*=\s*(\[[\s\S]*?\]);?\s*$/);
    return match ? JSON.parse(toJson(match[1])) : [];
  } catch {
    return [];
  }
}

function toJson(jsArray) {
  return jsArray
    .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"');
}

function normalizeGiftList(value) {
  const gifts = findGiftArray(value);

  return gifts.map(normalizeGift).filter(gift => gift.name && gift.sourceImage);
}

function findGiftArray(value) {
  if (Array.isArray(value)) return value;

  const candidates = [
    value?.gifts,
    value?.availableGifts,
    value?.giftList,
    value?.gift_list,
    value?.data?.gifts,
    value?.data?.giftList,
    value?.data?.gift_list,
    value?.data?.availableGifts
  ];

  return candidates.find(Array.isArray) || [];
}

function normalizeGift(gift) {
  const id = String(
    gift.id ??
    gift.giftId ??
    gift.gift_id ??
    gift.gift?.id ??
    gift.diamondId ??
    ''
  );
  const name = String(
    gift.name ??
    gift.giftName ??
    gift.gift_name ??
    gift.describe ??
    gift.gift?.name ??
    ''
  ).trim();
  const cost = Number(
    gift.diamondCount ??
    gift.diamond_count ??
    gift.cost ??
    gift.coins ??
    gift.price ??
    0
  );
  const sourceImage =
    gift.imageUrl ||
    gift.iconUrl ||
    gift.pictureUrl ||
    gift.giftPictureUrl ||
    gift.image?.url ||
    gift.icon?.url ||
    firstUrl(gift.image?.urlList) ||
    firstUrl(gift.icon?.urlList) ||
    firstUrl(gift.giftImage?.urlList) ||
    firstUrl(gift.gift?.image?.urlList) ||
    firstUrl(gift.gift?.icon?.urlList) ||
    '';

  return {
    id,
    name,
    cost: Number.isFinite(cost) && cost > 0 ? cost : undefined,
    image: '',
    sourceImage
  };
}

function firstUrl(urls) {
  return Array.isArray(urls) ? urls[0] : '';
}

async function downloadGiftImage(gift, assetsDir) {
  const response = await fetch(gift.sourceImage);

  if (!response.ok) {
    throw new Error(`Could not download ${gift.name}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = getImageExtension(gift.sourceImage, response.headers.get('content-type'));
  const filename = `${slugify(gift.id || gift.name)}${extension}`;
  const filePath = path.join(assetsDir, filename);

  await writeFile(filePath, bytes);

  return `./gift-assets/${filename}`;
}

function getImageExtension(url, contentType = '') {
  const pathname = new URL(url).pathname;
  const extension = path.extname(pathname).toLowerCase();

  if (['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp'].includes(extension)) {
    return extension;
  }

  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('avif')) return '.avif';

  return '.png';
}

function slugify(value) {
  return String(value || 'gift')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'gift';
}

function mergeCatalogs(existingCatalog, nextCatalog) {
  const byKey = new Map();

  existingCatalog.forEach(entry => {
    const key = getCatalogKey(entry);
    if (key) byKey.set(key, stripEmpty(entry));
  });

  nextCatalog.forEach(entry => {
    const key = getCatalogKey(entry);
    if (!key) return;

    byKey.set(key, stripEmpty({
      ...byKey.get(key),
      ...entry
    }));
  });

  return [...byKey.values()].sort((first, second) => first.name.localeCompare(second.name));
}

function getCatalogKey(entry) {
  return String(entry.id || entry.name || entry.image || '').toLowerCase();
}

function stripEmpty(entry) {
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined && value !== ''));
}

async function writeCatalog(catalogPath, catalog) {
  const content = `window.rewardImageCatalog = ${JSON.stringify(catalog, null, 2)};\n`;
  await writeFile(catalogPath, content, 'utf8');
}
