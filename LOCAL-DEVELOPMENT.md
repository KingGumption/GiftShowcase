# Starting GiftShowcase locally

## Start from the repository root

From this folder:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays
```

run:

```powershell
npm --prefix .\Widget\cloudflare run dev
```

The `--prefix` option tells npm where the project's `package.json` lives. Running plain `npm run dev` from the repository root fails with `ENOENT` because the root is not an npm package.

You can alternatively change directory first:

```powershell
Set-Location .\Widget\cloudflare
npm run dev
```

On the first run, `npx` may ask permission to download Wrangler. Accept the prompt and wait for Wrangler to report that it is listening on port `8081`.

## Open the local site

- Homepage: <http://127.0.0.1:8081/>
- Overlay Studio: <http://127.0.0.1:8081/studio/>
- Output Designer: <http://127.0.0.1:8081/studio/outputs/>

Wrangler serves the website, API, and local D1 database together. Keep the terminal open while using the site and press `Ctrl+C` to stop it.

The development command builds the latest files into `Widget\cloudflare\dist` before starting the server. Restart it after changing server code. Browser-side files normally require only a refresh, although a hard refresh may be needed after cache-key changes.

## Initialize the local database only when necessary

This workspace already contains local Wrangler database state. Initialize it only if Studio reports missing database tables, the `.wrangler` state was removed, or the D1 database ID in `wrangler.jsonc` changed.

From the repository root:

```powershell
Push-Location .\Widget\cloudflare
npx wrangler d1 execute gift-showcase-eu --local --file=./schema.sql
Pop-Location
```

Then start the development server again. Do not add `--remote`: that would target the deployed Cloudflare database instead of the isolated local database.

## Quick troubleshooting

- `ENOENT ... overlays\package.json`: use the `npm --prefix .\Widget\cloudflare run dev` command above.
- Port `8081` is already in use: stop the older Wrangler terminal with `Ctrl+C`, then retry.
- Studio opens but account requests fail with missing-table errors: initialize the local database using the command above.
- Changes do not appear: restart Wrangler, then hard-refresh the browser with `Ctrl+F5`.
