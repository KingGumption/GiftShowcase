# Account email delivery

Password reset and verified email changes are implemented but **disabled in production** until a sender is configured. Existing sign-in, designs, Direct links and support contact remain available. The application does not claim to send email while delivery is disabled.

To enable delivery later:

1. Create an email-provider account and verify a sending domain/address. The implemented adapter uses Resend's documented `POST https://api.resend.com/emails` endpoint: https://resend.com/docs/api-reference/emails/send-email . Check current provider limits before choosing a plan.
2. Store `RESEND_API_KEY` using Wrangler secret input, never in source or browser configuration.
3. Add `ACCOUNT_EMAIL_FROM` to Worker variables with the verified sender address.
4. Set `ACCOUNT_EMAIL_ENABLED` to `true`, build locally and deploy directly with Wrangler.
5. Test delivery to an address controlled by the site owner, reset expiry/reuse, spam placement and the new-address verification journey before announcing availability.

Reset tokens contain 256 random bits; only hashes are stored. Reset links expire in 20 minutes and email-change links in 30 minutes. They are single-use, rate limited and bound to the current account email and password hash. Successful actions invalidate existing sessions without changing design or output tokens. Reset requests return a generic response and production email delivery runs in the Worker background. Link origins are fixed to the production Studio URL. The browser removes account-action tokens from the address bar before showing the form. No account action occurs on a GET or link preview.

Local tests use a mock mail sender. No real delivery has been verified or enabled by this release.

# Creator artwork retention

Creator artwork has a 50 MiB account budget, including tracked current images, CDN caches and replacement backups. Uploads are limited to 2 MiB per image, 2048 × 2048 pixels, 10 images per batch and 30 manual batches per hour. Concurrent account writes are leased.

Replaced artwork keeps its stable public image token. The old object is retained for at least seven days before queued cleanup. Failed unreferenced uploads are removed, with ledger/audit retries for interrupted cleanup. The hourly job deletes up to four expired, unreferenced objects and audits up to 100 creator-prefix objects with a persisted cursor. Active references are checked under the account lease before deletion. Existing bulk gift PNGs and their local backups are outside this cleanup path.

The additive migration `0011_studio_safety.sql` creates only new tables/indexes. It does not rewrite any existing design, image URL, output token or account password.
