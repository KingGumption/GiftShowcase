# Deploying King Gumption Studio

King Gumption Studio is deployed as one Cloudflare Worker application:

- Workers Static Assets serves the homepage, Studio, Output Designer and OBS overlay pages.
- The Worker and EU-jurisdiction D1 database serve accounts, saved variants, output layouts and permanent OBS URLs on the same origin.
- R2 serves the large reward-image catalogue.

## Deploy

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

1. Confirm `redacted@example.invalid` remains monitored for privacy requests.
2. Confirm the notice identifies Dominic Williamson as the individual operator and controller.
3. Record the Cloudflare DPA, current subprocessors and transfer safeguards.
4. Record the D1 jurisdiction decision.
5. Complete the owner fields and procedures in `GDPR-OPERATIONS.md`.
6. Run the cloud API and browser-client tests.
7. Test account export, email correction, local-data clearing and permanent account deletion against a disposable account.

Repeat the production account smoke test after changing registration, authentication, retention or privacy behaviour.
