# TikFinity TikTok Live Goal Widget

OBS browser-source widget for a TikTok Live like goal and biggest support display, using TikFinity's local Event API WebSocket.

## Setup

1. Open TikFinity and enable the Event API.

2. Add this file as an OBS Browser Source:

   ```text
   C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index.html
   ```

Recommended OBS source size: `575 x 154`.

There is also a thin version for placing over a narrow purple line:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-thin.html
```

Recommended OBS source size: `1080 x 44`.

There is also a standalone Biggest Support source, designed as a compact badge you can place away from TikTok's mobile comments:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-support.html
```

Recommended OBS source size: `420 x 74`.

There is also a Top Likers source for session likes from TikFinity `like` events:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-top-likers.html
```

Recommended OBS source size: `390 x 260` for three places.

Use this test source to preview profile pictures, totals, medal hearts, and overtaking animations without TikFinity:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-top-likers-test.html
```

Top Likers can also be configured from `index-rewards-config.html`, including layout, colours, transparency, title visibility, outer box visibility, row background visibility, and the copied OBS URL.

There is also a Side Gifts source for vertical streams, with its own configurable gift list displayed as left/right edge columns:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-side-gifts.html
```

Recommended OBS source size: `1080 x 960`.

In composite Browser Source outputs, the Side Gifts layer height automatically fits the larger left/right gift column using the configured icon size, labels, tiles, and gaps. Removing gifts therefore removes unused transparent space from the layout layer.

Use this test source to preview side-column gift hits without TikFinity:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-side-gifts-test.html
```

There is also a rotating glass rewards source:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-rewards.html
```

Recommended OBS source size: `112 x 318`.

To edit the rewards, update:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\rewards-config.js
```

You can also use the small configuration page:

```text
C:\Users\Zatanna\Documents\StreamStuff\StreamAssets\overlays\Widget\public\index-rewards-config.html
```

The page saves settings into browser local storage for the rewards overlay. Use Export there when you want a generated `rewards-config.js` file.

For a hosted/static setup, use the copy URL buttons on the config page:

```text
Copy Carousel URL
Copy Rows URL
Copy Side Gifts URL
Copy Top Likers URL
Copy Config URL
```

Those legacy URLs include the current config in `#config=...` and remain available temporarily during migration. New account-based setups should use the permanent Browser Source outputs below.

## Accounts, cloud variants, and permanent OBS outputs

The cloud service in `Widget/cloudflare` adds user accounts, named server-backed variants for each overlay type, automatic revision history, and permanent read-only OBS Browser Source URLs. The configuration editor is account-gated: its controls and previews remain hidden until the cloud API is configured and the user is signed in. Existing direct overlay and `#config=...` snapshot URLs remain temporarily compatible during migration, but they are no longer presented as the primary editor workflow.

Deploy the Worker by following `cloudflare/README.md`, then set these values in `public/overlay-cloud-config.js`:

```js
window.overlayCloudConfig = Object.freeze({
  apiBaseUrl: 'https://your-worker.workers.dev',
  appBaseUrl: 'https://your-site.example/Widget/public'
});
```

The cloud workflow is:

1. Create an account or sign in on `index-rewards-config.html`. The editor appears after the session is verified.
2. Choose an overlay tab and save its settings as a typed cloud variant. Each tab lists only variants for that overlay type. **Migrate Local Versions** splits every named browser-local configuration into one variant per overlay type.
3. Every account starts with a 1080 × 1920 vertical output and a 1920 × 1080 horizontal output. Add the selected variant to either output from the Overlay Editor.
4. Open `index-obs-dock.html`, expand an output, then drag and resize its overlay layers on the scaled layout canvas. Layers can be dragged past any canvas edge when only part of an overlay should appear in the cropped Browser Source. Turn on **Show sample activity** to fill event-driven layers such as Top Likers with test content in both the canvas and the output's permanent Browser Source. Turn it off when positioning is finished to reconnect that same Browser Source to TikFinity. Additional custom-sized outputs can be created when separate Browser Sources are useful.
5. Copy the output's generated `index-dock.html?dock=...` URL into an OBS Browser Source once and set the source dimensions to match the output.
6. Edit variants or change the output layout. The OBS URL remains unchanged and affected visual layers update automatically.

The Output Designer is an optional control panel. To keep it inside OBS, add the hosted `index-obs-dock.html` URL under **Docks → Custom Browser Docks**. Each generated output URL belongs in the scene as an OBS Browser Source.

Each output shell owns one TikFinity connection and forwards events to all of its active visual layers. When a variant revision changes, only affected renderers are swapped after the replacements have loaded, without closing or reopening TikFinity. Goal and Top Likers state remain in browser storage across renderer swaps.

Output width and height define the layout's real pixel coordinate system and should match the OBS Browser Source dimensions. OBS does not allow the webpage to change an existing Browser Source's viewport, so changing those values later also requires changing the source dimensions in OBS.

Put manually sourced reward images in `public\rewards`, then point each reward's `image` value at it. Match incoming gifts with either `giftNames` or `giftIds`.

Set `enabled` per reward to stage rewards without showing or matching them yet:

```js
enabled: false
```

Put reward sounds in `public\sounds`, then add `sound` and optional `volume` to each reward:

```js
{
  title: 'Bean',
  giftNames: ['Super GG'],
  giftIds: [913],
  image: './rewards/913_Super_GG.png',
  sound: './sounds/bean.mp3',
  volume: 0.85
}
```

OBS browser sources can play these sounds as long as the source has audio enabled in OBS. In a normal browser, autoplay rules may require clicking the page once before sounds can play.

For customizable gifts such as Heart Me, set `useGiftImage: true`. If the reward also matches other gifts, use `giftImageNames` or `giftImageIds` so only the customizable gift can replace the image:

```js
{
  title: 'TTS',
  giftNames: ['Rose', 'Heart Me'],
  giftIds: [1, 33],
  image: './rewards/033_Heart_Me.png',
  useGiftImage: true,
  giftImageNames: ['Heart Me'],
  giftImageIds: [33]
}
```

In `rewards-config.js`, set `visibleNext` to control the stack:

```text
0 = current reward only
1 = current reward + next reward
3 = current reward + next 3 rewards
```

TikFinity's default endpoint is:

```text
ws://localhost:21213/
```

## URL Options

You can add query options in OBS:

```text
file:///C:/Users/Zatanna/Documents/StreamStuff/StreamAssets/overlays/Widget/public/index.html?step=5000&start=0
```

- `step`: goal jump size. With `5000`, the widget shows `0 / 5,000`, then `5,000 / 10,000`, then `10,000 / 15,000`; at `19,000` likes the active goal is `20,000`.
- `start`: starting like count for this browser source.
- `endpoint`: alternate TikFinity WebSocket endpoint.
- `resetOnConnect`: defaults to `1`, which clears likes and Biggest Support when TikFinity connects. Use `resetOnConnect=0` to keep saved state across reconnects.
- `limit`: top likers source only; number of liker rows to show, from `1` to `10`. Default is `3`.
- `avatar=0`: top likers source only; hides profile pictures.
- `names=0`: top likers source only; hides names and @handles.
- `heart=0`: top likers source only; hides the like heart icon.
- `medalHearts=0`: top likers source only; uses the normal red heart for 1st, 2nd, and 3rd instead of gold, silver, and bronze.
- `likeMilestone`: top likers source only; border pulse every time a liker reaches a multiple of this amount. Default is `500`; use `0` to turn it off.
- `width` and `height`: top likers source only; override the configured overlay size.
- `rotateMs`: rewards source only; controls how quickly the reward stack rotates.
- `holdMs`: rewards source only; controls how long it stays on a matched gift after a hit.
- `labelMs`: rewards source only; controls how long the gifter label stays visible.
- `visibleNext`: rewards source only; overrides how many upcoming rewards are shown.
- `test=1`: rewards source only; simulates matched gift events without TikFinity so you can tune animations.
- `savedConfig=0`: rewards source only; ignores configuration saved by the config page and uses `rewards-config.js`.
- `#config=...`: rewards sources and the config page can load an encoded shared config from the URL hash. Hash config takes priority over local storage.

The widget stores the current likes and biggest support in OBS/browser local storage during a run. By default, a successful TikFinity connection starts a fresh run.

To reset it, open the browser source properties in OBS and clear the Browser Source cache, or change the `step` value temporarily to create a fresh storage key.

## Notes

The display font is `Bangers`, which is a close Google Fonts match to the green text in your reference. Body text uses `Inter`.

The gift handler accepts TikFinity's `{ "event": "gift", "data": {} }` shape and also understands common TikTok-Live-Connector field names inside `data`.
