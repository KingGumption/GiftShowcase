# Gift Showcase cloud API

This Worker provides accounts, server-backed overlay variants, immutable revision history, composite OBS Browser Source outputs, and real-time output notifications.

## Initial deployment

1. Install or run Wrangler and authenticate with Cloudflare.
2. Create the database:

   ```text
   npx wrangler d1 create gift-showcase
   ```

3. Put the returned database ID into `wrangler.jsonc`.
4. Apply the schema:

   ```text
   npx wrangler d1 execute gift-showcase --remote --file=schema.sql
   ```

5. Update `ALLOWED_ORIGINS` and the custom-domain routes if the editor moves away from `kinggumption.com`.
6. Build the static application bundle and deploy:

   ```text
npm run deploy
   ```

The browser client uses `/api` on the current origin. Static assets are built into `dist`; `public/rewards` is excluded because those files are served from the existing R2 bucket.

## Upgrading an existing database

Apply any migrations that have not yet been run before deploying the updated Worker:

```text
npx wrangler d1 execute gift-showcase --remote --file=migrations/0002_composite_output_docks.sql
npx wrangler d1 execute gift-showcase --remote --file=migrations/0003_typed_overlay_variants.sql
npx wrangler d1 execute gift-showcase --remote --file=migrations/0004_remove_legacy_docks.sql
npx wrangler d1 execute gift-showcase --remote --file=migrations/0005_output_sample_activity.sql
npx wrangler d1 execute gift-showcase-eu --remote --file=migrations/0006_privacy_and_auth_hardening.sql
npx wrangler d1 execute gift-showcase-eu --remote --file=migrations/0007_site_live_status.sql
```

For local development, replace `--remote` with `--local`. The migrations preserve existing output tokens, add the vertical and horizontal starter outputs to existing accounts, split every legacy all-in-one variant into typed Carousel, Rows, Side Gifts, Goal Bar, and Top Likers variants, remove obsolete single-overlay rows that can block variant deletion, and add the output-level sample activity switch with live mode as the safe default.

## Site-wide live banner

The public, read-only `GET /v1/live-status` endpoint powers the promotional banner on the homepage, privacy page, Overlay Editor and Output Designer. Visitors cannot configure it. It reports only platform statuses detected by the Worker.

Keep provider credentials in Worker secrets, never in `wrangler.jsonc`:

```powershell
npx wrangler secret put TWITCH_CLIENT_ID
npx wrangler secret put TWITCH_CLIENT_SECRET
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put TIKTOK_ACCESS_TOKEN
```

Set `YOUTUBE_CHANNEL_ID`, `TIKTOK_ADVERTISER_ID`, `TIKTOK_IDENTITY_ID`, and optionally `TIKTOK_IDENTITY_TYPE` as Worker variables once those platform identifiers are known. `TWITCH_CHANNEL_LOGIN` and the destination URLs are configured in `wrangler.jsonc`.

The API stores session tokens as SHA-256 hashes, passwords as salted PBKDF2 hashes, and exposes output configurations only through random read-only capability URLs. Rotating an output token invalidates its previous URL.
