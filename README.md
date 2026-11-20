# King Gumption Studio

Stream overlays for vertical and landscape streams, using Browser Sources supported by OBS Studio, Streamlabs and other compatible streaming software.

- Website: https://kinggumption.com/
- Studio: https://kinggumption.com/studio/
- Canvas Designer: https://kinggumption.com/studio/outputs/
- Administration (authorised accounts only): https://kinggumption.com/admin/
- Request an invitation: https://kinggumption.com/request-invite/
- Compact graphics and live controls: https://kinggumption.com/help/graphics/
- Email setup and operations: https://kinggumption.com/help/email/

Production uses Cloudflare Workers Static Assets, D1 and Durable Objects. Gift images and account-hosted sounds live in R2; media caches, credentials and database backups are deliberately excluded from this repository. Existing design IDs and private Direct links are retained across source deployments.

Accounts are invitation-only. Existing accounts remain active. Administrator roles are assigned privately in the deployed database; no owner email or role grant is hard-coded into the source migration. Email integration is prepared for Resend's free tier and remains disabled until the operator configures a verified sender and API key. Gmail passwords are never needed.

Shared TikTok LIVE connections use one creator-scoped Cloudflare Durable Object and one Euler managed WebSocket per account, shared by Direct URLs and Canvases. Set the Worker secret `EULER_API_KEY`, enable `SHARED_LIVE_ENABLED`, then connect the public TikTok username from Studio. No TikTok password is used. The standalone legacy files retain their explicit local endpoint option. StreamControl is unchanged.

See DEPLOYMENT.md and Widget/cloudflare/README.md. Local verification: install the pinned development dependencies in Widget/cloudflare, then run npm test there. The browser gate uses Microsoft Edge on Windows; set STUDIO_BROWSER_EXECUTABLE for another compatible Chromium executable.

The old GitHub Pages editor is retired. GitHub hosts the maintained source; production deployment is performed directly through Cloudflare Wrangler. No repository action automatically deploys or modifies production.
