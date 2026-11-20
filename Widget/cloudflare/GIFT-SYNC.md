# Free regional gift sync

The existing Worker uses Euler Stream's anonymous regional gift feed:
https://www.eulerstream.com/docs/api/tiktok-live-gifts

No subscription or API key is required for the `/webcast/gifts?region=GB` endpoint. The separate business catalogue API is not used. The upstream feed is cached regional data, not a promise of the exact gifts available in a particular live room.

- `GIFT_CATALOGUE_REGION` defaults to `GB`.
- Cron `15 * * * *` checks hourly; metadata is refreshed every six hours, failures retry after one hour. Authenticated manual refreshes have a global fifteen-minute cooldown.
- `GIFT_IMAGES` binds to the existing `giftshowcase-rewards` R2 bucket. New objects are isolated under `gift-sync/`; legacy objects are untouched.
- Images are validated, fetched using fallback CDN URLs, cached on demand, and revalidated after seven days. Four images are warmed per scheduled run. Failed versions retry after one hour and keep the previous cached artwork.
- Published catalogue metadata and historical ID mappings live in additive D1 tables. Failed validation, major unexpected shrinkage, older source timestamps, and overlapping refreshes cannot replace the last verified catalogue.
- New selections store stable `/api/v1/gifts/images/GB/{giftID}.webp` URLs. Existing configurations and revisions are never rewritten. Retired IDs retain historical metadata/cache. The full original library remains available in the editor.
- Renderers check catalogue revisions every fifteen minutes when they contain synced gift images, so changed artwork can refresh without changing the OBS link.
- The free source has no availability guarantee. Normal existing Cloudflare usage limits and billing apply; no paid data-provider service is enabled.

Apply `migrations/0009_gift_catalogue.sql` to an existing database before deploying. `schema.sql` includes it for fresh local databases. Build with `node build-site.mjs`, then deploy directly with Wrangler; GitHub is not involved.

Run `node Widget/scripts/test-gift-catalogue.mjs` from the project root for validation, concurrency, image fallback, retained selections and scheduled-job regression tests. The other `Widget/scripts/test-*.mjs` cover existing overlays and account/output behavior.


## Creator discovery and imports

Apply additive migration `0010_creator_gifts.sql` before deploying this version. Creator metadata is scoped to the account and cascades on account deletion; uploaded/cached creator artwork under `creator-gifts/{userId}/` is also removed when deleting an account. Account exports include creator gift metadata.

All five standalone renderers and the canvas observe their existing TikFinity socket. They forward only gift ID, name, per-gift coin value and available image URLs, never viewer identities or raw events. No extra TikTok connection or paid data provider is used. Discovery happens only while a direct widget/canvas is running beside TikFinity, and learns gifts after receipt. Sample activity does not produce discovered gifts. Unknown coin values remain unknown; streak totals are not treated as unit prices.

OBS link tokens allow only bounded discovery writes to their owner's creator library, in addition to existing public output reads. They do not permit manual imports, library listing, editing designs or account access. Discovery is deduplicated in the browser, batched (up to 25 gifts), retried on transient errors and limited per account to one batch per ten seconds. Imported/manual fields take precedence over discovery. The editor checks the account library every thirty seconds and merges creator entries over regional entries with matching IDs.

The editor's **Import creator gifts** dialog supports one gift with optional artwork upload (PNG/WebP/JPEG/GIF, up to 2 MB), or CSV/JSON batches of 1–100 gifts with a preview. CSV columns: `id,name,coins,imageUrl`; JSON: an array or `{ "gifts": [...] }`. IDs/names/whole coin values are validated before publication. Supported remote image URLs use TikTok's CDN; upload other artwork. An omitted image keeps existing artwork, or uses a gift placeholder if none exists. Matching IDs update the library entry without changing saved design configurations/revisions. Existing creator image links follow the corrected artwork.

Coin searches accept `coins:100`, `100 coins`, `100-500`, `>=100` and combinations such as `Rose coins:1`. Bare numbers match gift IDs or exact coin values. Unknown prices are never treated as zero.

Run `node Widget/scripts/test-creator-gifts.mjs` along with the existing suite. This covers permissions, account isolation, manual priority, bounded/bulk imports, artwork caching and cleanup, CSV parsing, coin search, metadata-only discovery and unchanged saved designs.


## TikFinity catalogue extraction

The general gift browser's public app code calls `https://api.tikfinity.com/v1/gift?locale=en-GB`. This response was verified without a login or API key and contains `giftId`, `name`, `diamondCount` and `imageUrl` in each record. The authenticated `/v1/gift/paginated` route is not used; no TikFinity credentials or browser session data are copied to Cloudflare. This is a currently accessible app endpoint, not a guaranteed public integration API or a complete list for a specific creator/room.

`TIKFINITY_CATALOGUE_ENABLED=true` enables the additional source. It shares the existing six-hour refresh cycle, hourly retry checks, manual fifteen-minute cooldown, schema and last-good validation safeguards. The TikFinity source uses internal catalogue key `TF`; its records live alongside `GB` records in the existing tables, and its canonical images use `/api/v1/gifts/images/TF/{id}.webp`. Images are fetched/validated/cached on demand with an alternate TikTok CDN hostname, and keep their previous cached artwork on failure. Scheduled warming alternates sources hourly and still processes at most four images per run.

The public catalogue merges IDs from both sources, preserving regional entries on overlaps. Account-specific discovered/imported gifts still override those entries in the editor. Source counts, last successful checks and failures appear in the API and editor; upstream content age is only reported when the source supplies a timestamp. Historical image records, saved configurations, revisions, OBS tokens and manual corrections are retained. If TikFinity changes or restricts the endpoint, its last verified catalogue remains available while the regional source and discovery continue independently.

No new migration is needed. The public catalogue integration adds records to the existing additive gift tables. Regression coverage: `node Widget/scripts/test-tikfinity-catalogue.mjs`, plus the existing suite. Actual upstream downloads, stable image-ID mapping and image cache behavior should also be checked through a local Wrangler preview before direct deployment.
