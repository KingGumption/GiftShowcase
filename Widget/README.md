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
Copy Config URL
```

Those URLs include the current config in `#config=...`, so they can be pasted directly into an OBS Browser Source without needing a backend. This is the recommended path for GitHub Pages, Netlify, Cloudflare Pages, or another static host.

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
