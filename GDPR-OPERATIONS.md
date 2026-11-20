# King Gumption Studio data-protection operations

Last reviewed: 10 August 2026

This is the operational companion to the public `privacy.html`. It records the controls implemented in the repository and the decisions the service owner must maintain. It is not a substitute for legal advice.

## Launch status

Public account registration is closed by default through `REGISTRATION_ENABLED=false`. It must remain closed until the owner checklist at the end of this document is complete.

## Roles and contacts

- Controller: **Dominic Williamson, individual operator of the King Gumption Studio personal project.**
- Privacy contact: **redacted@example.invalid.**
- Supervisory authority: UK Information Commissioner's Office (ICO).
- Primary processor: Cloudflare (Workers and D1).
- Static host: GitHub Pages.
- Website font provider: Google Fonts.
- User-selected integrations: TikFinity and TikTok.

## Processing record

| Processing | Data subjects and data | Purpose | Lawful basis | Recipient/location | Retention/control |
|---|---|---|---|---|---|
| Studio accounts | Streamers; email, salted password hash, timestamps | Create and secure an account | Contract/service requested | Cloudflare D1, EU jurisdiction | Until account deletion |
| Sessions | Streamers; hashed random session token, account ID, timestamps | Authenticated access | Contract/service requested | Cloudflare D1 | 30 days; daily deletion after expiry |
| Saved designs | Streamers; names, configuration JSON, layout and timestamps | Cloud overlay and OBS output service | Contract/service requested | Cloudflare D1 | Until item/account deletion |
| Revision history | Streamers; configuration JSON and timestamps | Restore earlier designs | Contract/service requested | Cloudflare D1 | 365 days and latest 50 per overlay |
| Authentication protection | Visitors/account users; hashed IP/email rate-limit keys and timestamps | Prevent abuse and account compromise | Legitimate interests | Cloudflare D1 | 24 hours |
| Local editor preferences | Studio operator; overlay settings and favourites | Remember requested editor state | Contract/strictly necessary storage | User browser/OBS only | Until cleared by user |
| Local live activity | TikTok viewers; display name, avatar URL, likes and gift/supporter details | Render requested live overlays | Controller role depends on streamer/service relationship; review before launch | User browser/OBS only | Names/avatar/supporter state up to 7 days |
| Public-site request logs | Visitors; IP and request metadata | Hosting and security | Legitimate interests | GitHub Pages and infrastructure providers | Provider-controlled; record current provider terms |

Do not add analytics, advertising pixels, mailing lists or new external storage without updating this record, the public notice and the PECR assessment first.

## Individual-rights procedure

Requests may be made through the published privacy contact and do not have to use particular wording.

1. Record the date, requester's contact details and requested right in a restricted request log.
2. Verify identity proportionately. Do not request more identity information than necessary.
3. Search the user record, variants, revisions, outputs and output items by verified account ID.
4. Use Studio's **Download my data**, **Change email** or **Delete account** control where it satisfies the request. An authorised administrator may use the equivalent API operation.
5. Check whether an exemption or legal retention obligation applies before refusing or limiting a request.
6. Respond without undue delay and normally within the applicable statutory period. Record the response and completion date.
7. If deletion is required, delete the live account and associated rows, then handle any processor backups according to the processor agreement and deletion cycle.

The export deliberately excludes password hashes, salts, session-token hashes, rate-limit keys and private output capability tokens because disclosing them would undermine account or output security. Explain that exclusion if relevant to a request.

## Retention operation

Cloudflare invokes the Worker's scheduled cleanup daily at 04:00 UTC. It removes:

- expired sessions;
- authentication rate-limit records older than 24 hours;
- overlay revisions older than 365 days, while retaining the newest revision;
- revisions beyond the latest 50 for an overlay.

Account, current overlay and output records remain while needed to keep the requested service and permanent OBS URLs operating. A user's account-deletion request removes the user row and cascades to sessions, variants, revisions, outputs and output items.

Review the retention values annually and whenever the feature set changes. Never lengthen them merely because data may be useful later.

## Security and incident procedure

Implemented controls include salted PBKDF2-SHA256 password hashes at 600,000 iterations, automatic upgrade of older 210,000-iteration hashes, server-side session-token hashing, 30-day expiry, ownership checks, rate limiting, origin allowlisting, capability-token rotation, API security headers and encrypted Cloudflare D1 storage.

The browser session token is kept in session storage rather than persistent local storage. It remains accessible to same-origin JavaScript, so maintain a restrictive CSP and review every script added to authenticated pages. A same-site custom domain and HttpOnly cookie design should be considered before materially increasing the service's risk or user count.

If a suspected breach occurs:

1. Contain it: disable registration, revoke affected sessions/tokens and restrict the Worker if needed.
2. Preserve a minimal incident record without copying unnecessary personal data.
3. Establish affected records, people, dates, exposure and likely consequences.
4. Document the risk assessment and mitigation.
5. Where required, notify the ICO within the applicable deadline and notify affected people when the risk threshold requires it.
6. Correct the cause, test the correction and record lessons/actions.

## Processor and transfer checklist

- Save the Cloudflare Data Processing Addendum version applicable to the production account.
- Record Cloudflare's current subprocessors and subscribe to change notices if available.
- Record the production D1 database as `gift-showcase-eu`; Cloudflare reports the EU jurisdiction and an Eastern Europe running region.
- Record the transfer mechanism and complete any required transfer risk assessment.
- Record GitHub Pages' applicable privacy/hosting terms and the fact that Pages records visitor IP addresses.
- Decide whether to self-host fonts to remove the Google Fonts request; otherwise keep it in the public notice and vendor record.
- Recheck providers and transfers at least annually.

## Owner checklist before public registration

- [x] Individual controller confirmed as Dominic Williamson, operator of King Gumption Studio.
- [x] Public privacy email added to `privacy.html`: redacted@example.invalid.
- [ ] Privacy URL changed from localhost to the production URL.
- [ ] Cloudflare DPA and subprocessors recorded.
- [x] D1 configured with an EU storage jurisdiction; international transfers still require the Cloudflare DPA record.
- [ ] ICO data-protection fee self-assessment completed.
- [ ] Live-viewer data/controller responsibilities reviewed, including use involving children.
- [ ] Rights-request and incident-response owners assigned.
- [ ] Account controls and scheduled cleanup tested in production.
- [ ] `REGISTRATION_ENABLED=true` set only after all preceding items pass.
