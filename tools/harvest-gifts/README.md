# Gift Image Harvester

This tool seeds `Widget/public/reward-image-catalog.js` from a TikTok LIVE room gift list or a saved provider JSON dump.

## Setup

Install dependencies once:

```bash
npm install
```

## Fetch from a live room

The streamer must currently be live:

```bash
npm run harvest:gifts -- --user tiktokUniqueId
```

TikTok's room gift endpoint requires a signed request. With `tiktok-live-connector`, that signing is handled through Euler Stream. If Euler returns a plan/permission error, use a key with access:

```bash
npm run harvest:gifts -- --user tiktokUniqueId --sign-api-key YOUR_EULER_KEY
```

or set:

```bash
$env:SIGN_API_KEY = "YOUR_EULER_KEY"
npm run harvest:gifts -- tiktokUniqueId
```

By default the harvester downloads images into `Widget/public/gift-assets` and rewrites `Widget/public/reward-image-catalog.js` to point at those local hosted files.

## Normalize a provider dump

If you get gift data from Euler Stream, TikFinity, or another provider, save it as JSON and run:

```bash
npm run harvest:gifts -- --input ./provider-gifts.json
```

## Keep remote URLs

For quick testing without downloading images:

```bash
npm run harvest:gifts -- --user tiktokUniqueId --remote
```

## How Long Should It Run?

For one active LIVE room, this should be a single fetch, usually seconds to a minute. It does not need to sit open for a whole stream to collect that room's available gift list.

"All gifts" is not a single stable global list. TikTok gifts can vary by room, region, account, fanclub, campaigns, and time. To grow a broad catalog, run this against different live rooms/accounts over time. The harvester merges new gifts into the existing catalog instead of replacing it.
