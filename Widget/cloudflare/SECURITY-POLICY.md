# Authentication and link policy — reviewed 17 November 2026

- Existing accounts retain their current hashes and can still sign in with their existing passwords. No account password or public link is rewritten by this release.
- Registration and password reset now require at least 15 Unicode characters, reject a short set of obvious/repeated passwords, allow passphrases and retain the 200-code-unit maximum. Login keeps the legacy minimum so existing accounts are not locked out. Password managers and paste remain supported; there are no composition rules or periodic forced resets.
- Password hashing remains salted PBKDF2-HMAC-SHA-256 with 100,000 iterations and a per-record iteration count. Constant-time comparison, authentication throttling, generic login errors and 30-day hashed sessions remain in place.
- This work factor is below OWASP's current 600,000-iteration recommendation. The deployed Cloudflare runtime has historically rejected calls above 100,000; Cloudflare's proposal to raise that default is still open. Local Node/workerd timing alone does not prove production support. Increasing the constant without a supported runtime migration could break registration, sign-in and recovery.
- A future KDF change must first validate the deployed runtime, CPU/abuse budget and recovery path, then rehash on successful authentication using stored per-record parameters. Prefer a supported standard KDF/provider rather than a custom chained construction. Retain legacy verification until accounts migrate. Do not claim the current hashing policy meets the higher recommended work factor.
- Direct links use random capability tokens. Replacing a design's Direct link requires current-password confirmation, revokes the old token and leaves saved design data and canvas URLs unchanged. Canvas token rotation remains an explicit separate action. App/API/capability routes send noindex/nofollow guidance, which is not access control.
- Sound URLs are capabilities as well. Removed library entries retain their audio for old designs/history and remain within the 10 MiB account budget. Account deletion purges the account sound prefix and metadata.
- Email recovery is implemented but remains disabled until a verified mail sender is configured. The existing account-recovery setup document describes enabling and validating delivery.

Primary references reviewed:

- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- https://github.com/cloudflare/workerd/pull/7550

These are engineering controls and a migration policy, not a security certification.
