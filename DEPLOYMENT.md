# Deploying King Gumption Studio

King Gumption Studio is deployed as one Cloudflare Worker application:

- Workers Static Assets serves the homepage, Studio, Output Designer and OBS overlay pages.
- The Worker and EU-jurisdiction D1 database serve accounts, saved variants, output layouts and permanent OBS URLs on the same origin.
- R2 serves the large reward-image catalogue.

## Deploy

For every production release, fetch GitHub, merge the intended changes into `main`, run `npm test` from `Widget/cloudflare`, and commit and push the tested changes. Deploy that same commit from a clean checkout. Record its Git SHA with the Cloudflare version so the deployed source can be recovered.

Configure `EULER_API_KEY` and `RESEND_API_KEY` as Worker secrets. Manage `ACCOUNT_EMAIL_FROM`, `INVITE_NOTIFY_EMAIL`, and `EULER_ACCOUNT_ID` in Cloudflare. The tracked Wrangler configuration preserves those settings on deploy and identifies the existing D1 database by name. For local tests use fixture values or an ignored `.dev.vars` file. Keep production exports, source URLs, screenshots and credentials out of release commits.

From `Widget/cloudflare`, authenticate and confirm the account when needed:

```powershell
npx wrangler login
npx wrangler whoami
```

For a new empty D1 database, apply `schema.sql` once. Follow the migration notes in `Widget/cloudflare/README.md` for an older database.

Build the small static bundle and deploy the complete application:

```powershell
npm run deploy
```

`wrangler.jsonc` attaches `kinggumption.com` and `www.kinggumption.com`. The browser client uses `/api` on the current origin automatically. `www` redirects to the apex domain.

## Production URLs

```text
Homepage:            https://kinggumption.com/
Overlay Studio:      https://kinggumption.com/studio/
OBS Output Designer: https://kinggumption.com/studio/outputs/
Privacy:             https://kinggumption.com/privacy/
OBS Browser Source:  https://kinggumption.com/output/{token}
```

The old file-based paths remain compatibility routes but should not be shared with users.

## Smoke test

1. Open the homepage and follow **Open studio**.
2. Sign in with a test account.
3. Save one overlay variant.
4. Add it to a starter output in the Output Designer.
5. Enable sample activity and check the permanent `/output/{token}` link.
6. Add that link to an OBS Browser Source with dimensions matching the output.
7. Disable sample activity, start TikFinity's Event API and confirm live events reach OBS.

## Public registration

`REGISTRATION_ENABLED` is set to `true`, so anyone can create an account. Keep the operational privacy record current:

1. Set `PUBLIC_PRIVACY_EMAIL` in Cloudflare to a monitored address approved for publication on the privacy page.
2. Confirm the notice identifies Dominic Williamson as the individual operator and controller.
3. Record the Cloudflare DPA, current subprocessors and transfer safeguards.
4. Record the D1 jurisdiction decision.
5. Complete the owner fields and procedures in `GDPR-OPERATIONS.md`.
6. Run the cloud API and browser-client tests.
7. Test account export, email correction, local-data clearing and permanent account deletion against a disposable account.

Repeat the production account smoke test after changing registration, authentication, retention or privacy behaviour.

## Shared TikTok LIVE rollout

Set `EULER_API_KEY` as a Worker secret. Keep `SHARED_LIVE_ENABLED` false until the local release gate passes, then enable it in `wrangler.jsonc` and deploy. The new `CREATOR_LIVE` binding uses the additive `v2-creator-live` SQLite Durable Object migration; there is no D1 schema migration for this feature. Each account saves its own username and shares one upstream Euler socket across Direct URLs and Canvases. A short idle grace period avoids reconnecting during source refreshes; after all sources close, the upstream is released. Euler live-start alerts use the LIVE_ALERTS Durable Object binding and the v3-live-alerts migration. EULER_ACCOUNT_ID and LIVE_ALERT_ORIGIN identify the account and canonical HTTPS callback origin. A registered username shares one private webhook target across Studio accounts. Opening a source or choosing Connect provisions it. Disconnecting releases the registration when the last owner leaves. Account quota refusals use Euler’s reset time when available. The authenticated status response includes the last hour’s connection-attempt count and retry time.

`npm test` includes two-creator shared-connection checks in the real local Cloudflare runtime. A separate real-provider smoke test can be run from the repository root with `node --env-file=Widget/cloudflare/.dev.vars Widget/scripts/smoke-creator-live.mjs <live-username>`. It uses an ephemeral local database and reports aggregate counts only. Never load production account data into local tests.

If the shared service needs to be rolled back, set the flag false and redeploy. Existing source URLs then use the legacy local event source again. Keep the additive Durable Object migration in the configuration. StreamControl is not modified by this rollout.
