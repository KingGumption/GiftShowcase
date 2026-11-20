# Local release workflow

The supported path is local development and direct Cloudflare deployment. No Git repository, GitHub integration or hosted CI is required.

## One local validation command

Install the pinned development dependencies once with `npm ci` in this directory, then run:

```powershell
npm test
```

This runs every `Widget/scripts/test-*.mjs` check (API ownership, schema/migrations, auth, catalogues, sounds, quotas, rollback, stale saves and public JavaScript parsing), builds the site, and runs `release-browser.mjs` in an installed Edge browser. Set `STUDIO_BROWSER_EXECUTABLE` to another Chromium executable if needed. `STUDIO_TEST_MODULES` can point at an existing dependency directory; it is optional.

The browser gate uses an in-memory database, mock R2 and fixture images. It performs no production requests. It covers all five editors, card creation, save/reload/conflict resolution, stable Direct links, history, the design library, historic configuration fixtures, keyboard focus, automated accessibility, responsive layout, the Side Gifts homepage demo and help/404 handling. The separate local review scripts retained with release evidence also exercise actual sound decoding/trimming/upload, gift filters, all appearance modes, multi-layer canvas tools, renderer preservation and real local artwork.

## Deploy and verify

1. Retain a hashed source manifest, copies of changed source before/after, and a private D1 export. Database exports contain account information and capability tokens; never publish them in static assets or paste them into logs.
2. Recheck original source hashes so another local edit is not overwritten.
3. Apply only the required additive migration with `wrangler d1 execute gift-showcase-eu --remote --file migrations/0012_medium_studio.sql`. Do not reapply the consolidated schema to production.
4. Build using `npm run build`, then upload with `wrangler deploy` from this directory.
5. Verify live public asset bytes, homepage/Studio/help routes, noindex headers, and an isolated temporary account's save, stable link, conflict, restore, sound and canvas journeys. Delete the temporary account and its stored objects afterward.
6. Export D1 again and compare protected existing accounts, design JSON, revisions, canvases, layers, creator gifts and `variant_links` rows. Keep the Cloudflare version ID and measured results in release notes. A user's independent live edits must be distinguished from deployment changes.

## Roll back

Restore changed source from the release's before copy, remove new files identified by the manifest, rebuild and upload directly. Additive tables can remain in place. Prefer code rollback to a destructive database restore. Do not restore a database backup over newer legitimate edits or account deletions.

## Performance and privacy checks

Keep one selected visible homepage renderer; never open localhost sockets from homepage/editor previews. Pause inactive previews. Reuse canvas renderer documents through selection, save, move, resize, order and undo. Modern resolved configurations can skip historical catalogue metadata; ID-only historical configurations retain the complete fallback. Colour-only Carousel/Rows theme changes patch preview CSS without navigation. Resize callbacks batch work and ignore height-only notifications. Diagnostics expose build/type/counts/layout state, never passwords, account email, viewer information, design contents or full OBS/audio capability URLs.

The authentication review and production runtime limitation are documented in `SECURITY-POLICY.md`. Email recovery remains disabled until the sender setup in `ACCOUNT-RECOVERY.md` is completed.
