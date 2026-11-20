const refreshInterval = 6 * 60 * 60 * 1000;
const manualInterval = 15 * 60 * 1000;
const imageLifetime = 7 * 24 * 60 * 60 * 1000;
const legacyBase = 'https://pub-099cf604176d4f20bce0cd8bb2c4d3c6.r2.dev/';

function regionFor(env) {
  const region = String(env.GIFT_CATALOGUE_REGION || 'GB').toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) throw new Error('Invalid catalogue region');
  return region;
}

export function safeImageUrl(value) {
  try {
    const url = new URL(value);
    const allowed = ['tiktokcdn.com', 'tiktokcdn-eu.com', 'byteimg.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      allowed.some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

async function readBytes(response, maximum) {
  if (!response.ok) throw new Error('Upstream request failed');
  if (Number(response.headers.get('content-length')) > maximum) throw new Error('Upstream response too large');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) throw new Error('Upstream response too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function readJson(response) {
  return JSON.parse(new TextDecoder().decode(await readBytes(response, 4 * 1024 * 1024)));
}

async function legacyImages(env) {
  if (!env.ASSETS) return new Map();
  const response = await env.ASSETS.fetch(new Request('https://kinggumption.com/Widget/public/reward-image-catalog.js'));
  if (!response.ok) return new Map();
  const text = await response.text();
  const entries = JSON.parse(text.slice(text.indexOf('[')).trim().replace(/;$/, ''));
  const images = new Map();
  for (const entry of entries) {
    if (!images.has(String(entry.id)) && /^\.\/rewards\/[^/]+$/.test(entry.image || '')) {
      images.set(String(entry.id), legacyBase + encodeURIComponent(entry.image.slice('./rewards/'.length)));
    }
  }
  return images;
}

export function normaliseGifts(data, region, legacy = new Map()) {
  const raw = data?.data?.gifts;
  if (!Array.isArray(raw) || raw.length < 50 || raw.length > 10000) throw new Error('Incomplete gift list');
  const gifts = new Map();
  for (const gift of raw) {
    const id = String(gift.id || '');
    const name = String(gift.name || '').trim().slice(0, 160);
    const coins = Number(gift.diamond_count);
    const urls = [...new Set([...(Array.isArray(gift.image?.url_list) ? gift.image.url_list : []), ...(Array.isArray(gift.icon?.url_list) ? gift.icon.url_list : [])])].filter(safeImageUrl).slice(0, 4);
    if (!/^\d{1,20}$/.test(id) || !name || !Number.isFinite(coins) || coins < 0 || !urls.length) continue;
    const item = {
      id, name, coins, region,
      urls,
      sourceKey: String(gift.image?.uri || gift.icon?.uri || new URL(urls[0]).pathname).slice(0, 512),
      legacyImage: legacy.get(id) || null
    };
    // Prefer the normal panel entry when TikTok supplies multiple skins for one ID.
    if (!gifts.has(id) || gift.is_displayed_on_panel === true) gifts.set(id, item);
  }
  if (gifts.size < 50 || gifts.size < raw.length * .8) throw new Error('Gift list failed validation');
  return [...gifts.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function normaliseTikfinityGifts(raw, legacy = new Map()) {
  if (!Array.isArray(raw) || raw.length < 50 || raw.length > 10000) throw new Error('Incomplete TikFinity catalogue');
  const gifts = new Map();
  for (const row of raw) {
    const id = String(row?.giftId ?? '').trim();
    const name = String(row?.name || row?.nameEn || '').trim();
    const coins = row?.diamondCount;
    if (!/^[1-9]\d{0,19}$/.test(id) || !name || name.length > 160 || !Number.isSafeInteger(coins) || coins < 0 || coins > 10000000 || !safeImageUrl(row?.imageUrl)) continue;
    const image = new URL(row.imageUrl);
    const urls = [image.href];
    // TikFinity supplies one URL. These TikTok CDN hosts serve the same image paths.
    if (['p16-webcast.tiktokcdn.com', 'p19-webcast.tiktokcdn.com'].includes(image.hostname)) {
      const mirror = new URL(image); mirror.hostname = image.hostname.startsWith('p16-') ? 'p19-webcast.tiktokcdn.com' : 'p16-webcast.tiktokcdn.com';
      urls.push(mirror.href);
    }
    const item = { id, name, coins, region: 'TF', urls, sourceKey: image.pathname.slice(0, 512), legacyImage: legacy.get(id) || null };
    const previous = gifts.get(id);
    if (previous && (previous.name !== name || previous.coins !== coins || previous.sourceKey !== item.sourceKey)) throw new Error('Conflicting TikFinity gift IDs');
    gifts.set(id, item);
  }
  if (gifts.size < 50 || gifts.size < raw.length * .9) throw new Error('TikFinity catalogue failed validation');
  return [...gifts.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function syncTikfinityCatalogue(env, options = {}) {
  if (env.TIKFINITY_CATALOGUE_ENABLED !== 'true') return { refreshed: false, reason: 'TikFinity catalogue is not enabled' };
  return syncGiftCatalogue(env, { ...options, source: 'tikfinity' });
}

export async function syncGiftCatalogue(env, options = {}) {
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher || fetch;
  const isTikfinity = options.source === 'tikfinity';
  const region = isTikfinity ? 'TF' : regionFor(env);
  const token = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO gift_catalogue_state (region) VALUES (?) ON CONFLICT(region) DO NOTHING').bind(region).run();
  const current = await env.DB.prepare('SELECT * FROM gift_catalogue_state WHERE region = ?').bind(region).first();
  const minimumAttempt = options.force ? manualInterval : 0;
  const lock = await env.DB.prepare(`UPDATE gift_catalogue_state SET lease_token = ?, lease_until = ?, last_attempt_at = ?
    WHERE region = ? AND lease_until <= ? AND last_attempt_at <= ? AND (? = 1 OR next_refresh_at <= ?)`)
    .bind(token, now + 120000, now, region, now, now - minimumAttempt, options.force ? 1 : 0, now).run();
  if (!lock.meta.changes) return { refreshed: false, reason: 'Recent check or sync in progress' };
  try {
    const legacy = options.legacy || await legacyImages(env);
    let gifts, sourceUpdatedAt;
    if (isTikfinity) {
      const response = await fetcher('https://api.tikfinity.com/v1/gift?locale=en-' + regionFor(env), {
        signal: AbortSignal.timeout(20000), redirect: 'manual', headers: { Accept: 'application/json' }
      });
      sourceUpdatedAt = response.headers.get('last-modified');
      gifts = normaliseTikfinityGifts(await readJson(response), legacy);
    } else {
      const apiResponse = await fetcher('https://api.eulerstream.com/webcast/gifts?region=' + region, {
        signal: AbortSignal.timeout(20000), redirect: 'manual'
      });
      const descriptor = await readJson(apiResponse);
      const source = new URL(descriptor.url);
      if (source.protocol !== 'https:' || !source.hostname.endsWith('.r2.cloudflarestorage.com') || source.username || source.password || source.port) {
        throw new Error('Invalid catalogue download location');
      }
      const response = await fetcher(source.href, { signal: AbortSignal.timeout(30000), redirect: 'manual' });
      sourceUpdatedAt = response.headers.get('last-modified');
      const data = await readJson(response);
      gifts = normaliseGifts(data, region, legacy);
    }
    const previous = current.payload_json ? JSON.parse(current.payload_json) : [];
    if (previous.length && gifts.length < previous.length * .6) throw new Error('Unexpected catalogue shrink');
    if (sourceUpdatedAt && current.source_updated_at && Date.parse(sourceUpdatedAt) < Date.parse(current.source_updated_at)) {
      throw new Error('Upstream catalogue is older than the published version');
    }
    const revisionBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(gifts.map(({ urls, legacyImage, ...gift }) => gift))));
    const revision = [...new Uint8Array(revisionBytes)].map(value => value.toString(16).padStart(2, '0')).join('');
    const payload = JSON.stringify(gifts);
    if (new TextEncoder().encode(payload).length > 1500000) throw new Error('Catalogue exceeds storage limit');
    const publication = await env.DB.batch([
      env.DB.prepare(`INSERT INTO gift_catalogue_items (region, gift_id, metadata_json)
        SELECT ?, json_extract(value, '$.id'), value FROM json_each(?)
        WHERE EXISTS (SELECT 1 FROM gift_catalogue_state WHERE region = ? AND lease_token = ?)
        ON CONFLICT(region, gift_id) DO UPDATE SET metadata_json = excluded.metadata_json`)
        .bind(region, payload, region, token),
      env.DB.prepare(`UPDATE gift_catalogue_state SET payload_json = ?, revision = ?, source_updated_at = ?,
        last_success_at = ?, next_refresh_at = ?, last_error = NULL, lease_token = NULL, lease_until = 0
        WHERE region = ? AND lease_token = ?`)
        .bind(payload, revision, sourceUpdatedAt, now, now + refreshInterval, region, token)
    ]);
    return publication[1].meta.changes ? { refreshed: true, count: gifts.length } : { refreshed: false, reason: 'A newer sync has already published' };
  } catch (error) {
    await env.DB.prepare(`UPDATE gift_catalogue_state SET last_error = ?, next_refresh_at = ?, lease_token = NULL, lease_until = 0
      WHERE region = ? AND lease_token = ?`)
      .bind('Refresh failed; the last verified catalogue is retained.', now + 3600000, region, token).run();
    // Do not log presigned URLs or upstream response bodies.
    console.warn('Gift catalogue refresh failed', error.name, String(error.message).replace(/https?:[^\s]+/g, '[upstream]'));
    return { refreshed: false, reason: 'Refresh failed; the last verified catalogue is retained.' };
  }
}

export async function getGiftCatalogue(env, origin, includeGifts = true) {
  const region = regionFor(env);
  const fields = includeGifts ? '*' : 'region, revision, last_success_at, source_updated_at, last_error, json_array_length(payload_json) AS gift_count';
  const result = await env.DB.prepare('SELECT ' + fields + ' FROM gift_catalogue_state WHERE region IN (?, ?)').bind(region, 'TF').all();
  const rows = new Map(result.results.map(row => [row.region, row]));
  const sources = [region, 'TF'].filter(key => key !== 'TF' || rows.has('TF') || env.TIKFINITY_CATALOGUE_ENABLED === 'true').map(key => {
    const row = rows.get(key);
    const items = includeGifts && row?.payload_json ? JSON.parse(row.payload_json) : [];
    return { id: key === 'TF' ? 'tikfinity' : 'regional', name: key === 'TF' ? 'TikFinity catalogue' : region + ' regional feed',
      count: includeGifts ? items.length : Number(row?.gift_count || 0), checkedAt: row?.last_success_at || null,
      sourceUpdatedAt: row?.source_updated_at || null, error: row?.last_error || null,
      stale: !row?.last_success_at || Date.now() - row.last_success_at > 86400000 ||
        Boolean(row.source_updated_at && Date.now() - Date.parse(row.source_updated_at) > 3 * 86400000), items };
  });
  const merged = new Map();
  // Preserve regional metadata and image URLs on overlapping IDs. Account creator gifts override this in the editor.
  for (const source of sources) for (const gift of source.items) {
    if (!merged.has(gift.id)) merged.set(gift.id, { id: gift.id, name: gift.name, coins: gift.coins,
      source: source.id, image: new URL('/api/v1/gifts/images/' + (source.id === 'tikfinity' ? 'TF' : region) + '/' + gift.id + '.webp', origin).href });
  }
  return { region, revision: [rows.get(region)?.revision, rows.get('TF')?.revision].filter(Boolean).join('-'),
    checkedAt: Math.max(...sources.map(source => source.checkedAt || 0)) || null,
    sourceUpdatedAt: rows.get(region)?.source_updated_at || null,
    stale: sources.some(source => source.stale),
    error: sources.filter(source => source.error).map(source => source.name + ': ' + source.error).join(' ') || null,
    sources: sources.map(({items, ...source}) => source),
    gifts: [...merged.values()].sort((a,b) => a.id.localeCompare(b.id)) };
}

export function imageType(bytes) {
  const text = new TextDecoder('ascii').decode(bytes.slice(0, 12));
  if (bytes.length >= 20 && text.startsWith('RIFF') && text.slice(8) === 'WEBP' && new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true) + 8 === bytes.length) return 'image/webp';
  if (bytes.length >= 45 && new TextDecoder().decode(bytes.slice(-8, -4)) === 'IEND' && bytes[0] === 137 && text.slice(1, 4) === 'PNG' && new TextDecoder().decode(bytes.slice(12, 16)) === 'IHDR') return 'image/png';
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return 'image/jpeg';
  if (bytes.length >= 14 && (text.startsWith('GIF87a') || text.startsWith('GIF89a')) && bytes.at(-1) === 59) return 'image/gif';
  if (text.slice(4, 8) === 'ftyp' && /avif|avis/.test(text.slice(8))) return 'image/avif';
  throw new Error('Invalid gift image');
}

export function imageResponse(object, stale = false, head = false) {
  return new Response(head ? null : object.body, { headers: {
    'Content-Type': object.httpMetadata?.contentType || 'image/webp',
    'Cache-Control': 'public, max-age=' + (stale ? 60 : 300),
    'X-Content-Type-Options': 'nosniff',
    'X-Gift-Image': stale ? 'last-known-good' : 'current',
    ...(object.httpEtag ? { ETag: object.httpEtag } : {})
  } });
}

export async function getGiftImage(env, region, id, options = {}) {
  if (!/^[A-Z]{2}$/.test(region) || !/^\d{1,20}$/.test(id)) return new Response('Image not found', { status: 404 });
  const bucket = env.GIFT_IMAGES;
  if (!bucket) return new Response('Image cache unavailable', { status: 503 });
  const row = await env.DB.prepare('SELECT * FROM gift_catalogue_items WHERE region = ? AND gift_id = ?').bind(region, id).first();
  if (!row) return new Response('Image not found', { status: 404 });
  return serveGiftImage(env, row, 'gift-sync/' + region + '/' + id + '/', options, async (fields, values, sourceKey) => {
    await env.DB.prepare('UPDATE gift_catalogue_items SET ' + fields + " WHERE region = ? AND gift_id = ? AND json_extract(metadata_json, '$.sourceKey') = ?")
      .bind(...values, region, id, sourceKey).run();
  });
}

export async function serveGiftImage(env, row, prefix, options, update) {
  const bucket = env.GIFT_IMAGES;
  const gift = JSON.parse(row.metadata_json);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(gift.sourceKey));
  const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  const key = prefix + fingerprint;
  const cached = await bucket.get(key);
  const now = options.now ?? Date.now();
  if (cached && now - Number(cached.customMetadata?.checkedAt) < imageLifetime) {
    return imageResponse(cached, false, options.head);
  }
  const fallback = cached || (row.cached_key ? await bucket.get(row.cached_key) : null);
  if (row.failed_source === gift.sourceKey && now - Number(row.failed_at) < 3600000) {
    return fallback ? imageResponse(fallback, true, options.head)
      : new Response('Gift image temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const fetcher = options.fetcher || fetch;
  for (const url of gift.urls.filter(safeImageUrl)) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'manual' });
      const bytes = await readBytes(response, 2 * 1024 * 1024);
      const type = imageType(bytes);
      await (options.store || ((...args)=>bucket.put(...args)))(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { checkedAt: String(now) } });
      // A slow request for an old catalogue cannot replace a newer last-good pointer.
      await update('cached_key = ?, failed_source = NULL, failed_at = NULL', [key], gift.sourceKey);
      return imageResponse({ body: bytes, httpMetadata: { contentType: type } }, false, options.head);
    } catch { /* Try the next supplied CDN URL. */ }
  }
  await update('failed_source = ?, failed_at = ?', [gift.sourceKey, now], gift.sourceKey);
  if (fallback) return imageResponse(fallback, true, options.head);
  if (gift.legacyImage?.startsWith(legacyBase)) {
    try {
      const response = await fetcher(gift.legacyImage, { signal: AbortSignal.timeout(8000), redirect: 'manual' });
      const bytes = await readBytes(response, 2 * 1024 * 1024);
      const type = imageType(bytes);
      const legacyKey = prefix + 'legacy';
      await (options.store || ((...args)=>bucket.put(...args)))(legacyKey, bytes, { httpMetadata: { contentType: type }, customMetadata: { checkedAt: String(now) } });
      await update('cached_key = ?', [legacyKey], gift.sourceKey);
      return imageResponse({ body: bytes, httpMetadata: { contentType: type } }, true, options.head);
    } catch { /* Retain the selected design and report a temporary image failure. */ }
  }
  return new Response('Gift image temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

export async function warmGiftImages(env, catalogueKey = regionFor(env)) {
  const region = catalogueKey;
  const row = await env.DB.prepare('SELECT * FROM gift_catalogue_state WHERE region = ?').bind(region).first();
  if (!row?.payload_json) return;
  const gifts = JSON.parse(row.payload_json);
  const start = Number(row.warm_cursor || 0) % gifts.length;
  const batch = Array.from({ length: Math.min(4, gifts.length) }, (_, i) => gifts[(start + i) % gifts.length]);
  await Promise.all(batch.map(async gift => {
    const response = await getGiftImage(env, region, gift.id);
    await response.body?.cancel();
  }));
  await env.DB.prepare('UPDATE gift_catalogue_state SET warm_cursor = ? WHERE region = ?')
    .bind((start + batch.length) % gifts.length, region).run();
}
