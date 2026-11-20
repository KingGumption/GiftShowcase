# Local username-based TikTok connection

This is a local prototype, separate from the deployed Cloudflare application. It replaces the TikFinity event source with `tiktok-live-connector` and translates native TikTok events into the wire format used by the existing overlays. Nothing here is deployed by the site's build script.

Requires Node 22.9 or newer (tested on Node 24).

```sh
cd Widget/local-live
npm ci --ignore-scripts
npm start
```

Open http://127.0.0.1:8788 and enter a TikTok username that is currently live. No TikTok password is used. The library uses an external signing service; its access limits and production suitability must be verified before hosting this for creators. If a signing key is required, create an ignored `.env` file **in this directory** with `SIGN_API_KEY=...`. Never put it in browser code or commit it.

The prototype listens on loopback only, allows one upstream connection, and forwards events on `ws://127.0.0.1:8788/events`. Existing overlay pages accept this address through their `endpoint` query parameter. Disconnect/replacement stops delivery from the previous stream. Upstream errors and offline/end states are shown on the connection page; reconnect manually after an upstream failure. It does not store viewer events on disk.

The live check against `@typicalgamer` on 18 November 2026 established a connection without a signing key. Optional room-info and extended gift catalogue requests are disabled because those requests hit a Business-plan endpoint during testing. Native gift details are used instead. This successful connection is not a guarantee of continued free access or production-scale capacity.

## Local simulation and verification

```sh
npm run demo
npm test
npm run test:overlays
```

Demo mode cannot connect to TikTok; its button sends explicitly simulated events through the same adapter and WebSocket. The browser suite starts its own loopback server on an ephemeral port and uses the actual overlay JS, with the Worker, D1 and graphics hubs running against in-memory test storage. External artwork is replaced with a local fixture. It never uses production accounts or data.

The browser suite checks:

- Original Carousel, Rows, Side Gifts, Goal Bar and Top Likers.
- Like, follow and share cards for all three card overlays.
- Follower and support goal counters, including ignoring unfinished gift streaks.
- All fourteen compact/live graphics, including combo, boss, vote and quest.
- Actual event transport, expected counter/animation state and browser errors.

Screenshots and `report.json` are written to ignored `outputs/`. They validate simulated input, not successful connectivity to a real TikTok stream. Chrome is detected at the standard macOS location; set `STUDIO_BROWSER_EXECUTABLE` for another Chromium executable.

## Before hosted rollout

Real-stream validation, upstream reconnect/backoff, a hosted connection service, authenticated per-creator routing, rate limits and updated setup/privacy text are still needed. The deployed Studio continues to use TikFinity until that work is complete. Existing gift catalogue sources are unchanged by this prototype.
