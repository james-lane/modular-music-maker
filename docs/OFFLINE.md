# Offline studio and installation

Patchwork is a local-first installable web app. After an initial connected download, the complete production studio runs without Node, Cloudflare, a login, or network access. Audio synthesis, impulse responses, and drum sounds are generated on the device. Examples, guides, icons, and fonts require no remote services. The responsive React application is the same in browser tabs and installed windows.

## First launch

The browser must support service workers and use a secure origin: HTTPS on a hosted site, or loopback HTTP for local testing. `npm run build && npm run preview` serves the production app on `127.0.0.1:4173`. Vite development mode deliberately does not register a worker, so a cached release cannot hide source edits. Host the app at the origin root; subpath builds are rejected.

The footer and **More → Use offline / install** only confirm readiness after the active service worker verifies every release asset is cached. Unsupported environments show guidance; interrupted downloads show a retry action. Losing a connection does not disable editing or audio. An installed release confirms readiness without contacting the server.

On iPad, open the HTTPS site in Safari, choose **Share → Add to Home Screen**, enable **Open as Web App** if shown, and add it. Open the icon once while connected and wait for **Offline ready** before using Airplane Mode. The installed app can have separate website storage from the original Safari tab; export/import patches to move them. Installation details: [Apple iPad guide](https://support.apple.com/en-gb/guide/ipad/ipad8f1f7a29/27/ipados/27).

The manifest declares standalone display, a stable root identity/start URL, and PNG icons (192/512px and a maskable variant). A 180px Apple touch icon and Apple standalone metadata cover iPad/iPhone installation. Icons reuse the existing waveform logo. `viewport-fit=cover` and safe-area padding protect device insets; the rack retains pan/zoom in portrait, landscape, and split view.

## Build and cache lifecycle

`scripts/offline-build.ts` runs after Vite writes its production files. It derives a precache list from the actual output rather than maintaining a second list of chunks. The revision includes asset paths/content and worker source, so changes produce a new release cache. It compiles `src/offline/worker.ts` to a classic `/service-worker.js`; `tsconfig.worker.json` checks the source against WebWorker types separately from window code. No new package dependency is needed.

Installation uses an atomic `Cache.addAll` of the complete release. A failed download cannot activate a partial release or replace the previous active worker. Fetch handling serves only enumerated same-origin GET assets from that release. Root navigations (including root query strings and `/index.html`) return the cached entry page. API requests, unknown URLs, mutations, blob recordings, and third-party URLs are outside this cache.

The first worker claims its page when activated. Updates use the normal waiting lifecycle, without `skipWaiting` or automatic reloads. Current HTML and hashed chunks stay together while any old client is open, including during recording. When all old clients close, the new worker activates and removes only obsolete `patchwork-shell-*` caches. It never deletes localStorage, IndexedDB, or unrelated caches. Available updates are explained in the offline dialog. The worker and manifest use no-cache headers on Cloudflare; Node also revalidates entry HTML. Registration uses `updateViaCache: 'none'`.

## Device data and limitations

- Patches remain validated Project v1 data in localStorage. Autosave flushes on `pagehide` and hidden visibility, since iPadOS may suspend an app without closing it.
- Takes remain blobs in IndexedDB. Offline recording, playback, and download use the supported MediaRecorder format, without microphone access.
- Public installs never probe or upload to `/api`. The optional file adapter only considers known loopback hostnames while online, and checks the Patchwork health response before reading/writing.
- **Protect device storage** calls `StorageManager.persist()` from a user gesture and reports whether protection was granted. Browsers decide whether to grant it. See [WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
- Clearing website data removes the saved app, patches, and takes. Storage pressure can cause eviction where protection is unavailable. Export patches and download recordings for durable backups. There is no cross-device synchronization.
- Offline use does not bypass iPadOS background/screen-lock suspension, browser CPU limits, or hardware audio differences. Keep the app visible while performing. Offline WAV rendering remains separate future work.

## Cloudflare preparation

`wrangler.jsonc` points Workers Static Assets at `dist/`, with no Worker script, bindings, database, paid services, or Node compatibility layer. Default missing-asset handling is retained; unknown API URLs are not rewritten to the app. `public/_headers` supplies update-cache headers. No deployment, account changes, or source upload occurred.

When deployment is requested, build with `npm run build` and deploy using Workers Static Assets and this configuration. The Node API is excluded from the hosted build. Cloudflare documents free, unlimited static asset requests and no extra asset storage charge; Worker-script execution has separate pricing. Remain on the Free plan and review current terms/limits before publishing: [billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/).

## Verification

Run `npm run check` and `npm run format:check`. In a fresh production profile, wait for readiness, disconnect networking, and reload. Verify saved patches, live analyser signal, editing, recording, reopening/downloading the take, library access, guides/examples, and patch import/export. Repeat at desktop, tablet portrait/landscape, phone, and short landscape sizes. Check page overflow and reachable footer, dialogs, and canvas controls.

Before distributing an iPad release, also test a physical iPad: install from Safari over HTTPS, reopen the icon in Airplane Mode after the first download, play keys/pads, record/reopen a take, and check Files downloads/imports, portrait/landscape, split view, and resuming after screen lock. Emulation cannot prove physical Safari home-screen/audio behavior.
