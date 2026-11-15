# Offline studio and installation

Patchwork is a local-first installable web app. After an initial connected download, the complete production studio runs without Node, Cloudflare, a login, or network access. Audio synthesis, impulse responses, and drum sounds are generated on the device. Examples, guides, icons, and fonts require no remote services. The responsive React application is the same in browser tabs and installed windows.

## First launch

The browser must support service workers and use a secure origin: HTTPS on a hosted site, or loopback HTTP for local testing. `npm run build && npm run preview` serves the production app on `127.0.0.1:4173`. Vite development mode deliberately does not register a worker, so a cached release cannot hide source edits. Host the app at the origin root; subpath builds are rejected.

The footer and **More → Use offline / install** only confirm readiness after the active service worker verifies every release asset is cached. Unsupported environments show guidance; interrupted downloads show a retry action. Losing a connection does not disable editing or audio. An installed release confirms readiness without contacting the server.

On iPad, open the HTTPS site in Safari, choose **Share → Add to Home Screen**, enable **Open as Web App** if shown, and add it. Open the icon once while connected and wait for **Offline ready** before using Airplane Mode. The installed app can have separate website storage from the original Safari tab; export/import patches to move them. Installation details: [Apple iPad guide](https://support.apple.com/en-gb/guide/ipad/ipad8f1f7a29/27/ipados/27).

The manifest declares standalone display, a stable root identity/start URL, and PNG icons (192/512px and a maskable variant). A 180px Apple touch icon and Apple standalone metadata cover iPad/iPhone installation. Icons reuse the existing waveform logo. `viewport-fit=cover` and safe-area padding protect device insets; the rack retains pan/zoom in portrait, landscape, and split view. The root is bounded and non-scrolling with an opaque safe-area background. Pinch zoom is handled inside the rack rather than magnifying app controls; one finger pans empty rack space. Add modules opens an overlay instead of taking a permanent sidebar, and the workspace focus button hides the toolbar/footer. No global zoom restriction is placed on the page. Native iPadOS status-area fading cannot be verified in Chromium emulation.

## Build and cache lifecycle

The manifest's `name` and `short_name`, HTML `application-name`, Apple web-app title, and document title all use **Patchwork**. This supplies the short name both to manifest-based desktop installs and to installers using the page title as a fallback. Social-card titles retain the tagline independently. Keep the manifest identity, start URL, and scope stable when changing display names.

`scripts/offline-build.ts` runs after Vite writes its production files. It derives a precache list from the actual output rather than maintaining a second list of chunks. The revision includes asset paths/content and worker source, so changes produce a new release cache. It compiles `src/offline/worker.ts` to a classic `/service-worker.js`; `tsconfig.worker.json` checks the source against WebWorker types separately from window code. No new package dependency is needed.

App versions are generated automatically from `package.json` and the current Git commit, including its history count and hash. The bottom-right badge abbreviates the full identity in its accessible label/hover text; `*` means the build contains uncommitted changes. The emitted `version.json` and UI bundle share the same build snapshot and enter the same atomic cache. Every commit therefore produces a distinct version/cache even when app source is unchanged. An installed or offline app continues to display its running release until the normal update lifecycle activates a newer one. Build from full Git history; a shallow checkout must run `git fetch --unshallow` first. An exported source archive without Git is explicitly labelled `+source`.

Drum kit samples are embedded as bounded PCM data in the patch, not downloaded assets. Importing uses a locally bundled, chunked decoder with frame/memory bounds; unsupported compressed codecs prompt for PCM WAV, which needs no WebCodecs. The decoder’s additional JavaScript chunk is part of the complete offline release and never fetched from a third-party CDN. Importing remains silent; built-ins, imported samples, and patched audio inputs use bundled synthesis code. Export a sample-heavy patch as a backup: it consumes more browser patch-library storage, and a full library can exceed the browser quota. See [architecture](ARCHITECTURE.md#drum-kit-voice-assignment) for sample limits and format.

Installation uses an atomic `Cache.addAll` of the complete release. A failed download cannot activate a partial release or replace the previous active worker. Fetch handling serves only enumerated same-origin GET assets from that release. Root navigations (including root query strings and `/index.html`) return the cached entry page. API requests, unknown URLs, mutations, blob recordings, and third-party URLs are outside this cache.

The first worker claims its page when activated. Updates retain the normal waiting lifecycle by default; complete HTML and hashed chunks stay together during a session. A downloaded release triggers a non-modal **Patchwork has an update** notice with **Refresh now** and **Later**. Dismissing it retains the update in the footer's **Update ready** button and **More → Use offline / install**. That dialog also has **Check for updates**. Automatic checks happen on launch, online/focus/visibility return, and every fifteen minutes while visible, with a one-minute minimum between automatic checks. Check/download failures do not invalidate an already usable offline release.

**Refresh now** is an explicit exception to waiting for all windows to close. The UI blocks it during audio startup, playback/live sound, recording, final recording storage, and microphone capture/processing. It flushes the latest patch before sending `PATCHWORK_APPLY_UPDATE` to the waiting worker. The worker checks that its release is still completely cached and that the requesting window is the sole window on this origin; otherwise it refuses and the UI explains what to do. Only then does it call `skipWaiting()`. Studio controls become inert during the switch. Only the requesting page reloads, on `controllerchange`; other controller changes and first installation never auto-reload. Timeouts/refusals restore the controls. See [skipWaiting behavior](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting) and [update checks](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update).

Without explicit refresh, closing every client still applies the update naturally. Activation removes only obsolete `patchwork-shell-*` caches; it never deletes localStorage, IndexedDB, or unrelated caches. A failed release download cannot activate. Existing pre-notice installs need one normal all-windows-close/reopen cycle to receive the new UI; there is no way to add a notice retroactively to their already running JavaScript. On iPad, close the home-screen app from the app switcher and any open Safari studio tabs, then relaunch online. The worker and manifest use no-cache headers on Cloudflare; Node also revalidates entry HTML. Registration uses `updateViaCache: 'none'`.

## Device data and limitations

- Patches remain validated Project v2 data in localStorage; v1 patches migrate automatically through `parseProject`. Signed open-workspace positions survive offline saving, export/import, and reload. Autosave flushes on `pagehide` and hidden visibility, since iPadOS may suspend an app without closing it.
- Mic sampler snippets are embedded in patch saves/exports and play offline without microphone access. New capture needs secure-context device permission and never uses a network service. Hiding the app cancels capture and releases the mic.
- Takes remain original MediaRecorder blobs in IndexedDB. Offline recording, playback, and downloads as WAV, MP3 or Original work without microphone access. The conversion worker, MP3 encoder and licence are bundled in the complete release; downloads never contact a conversion service.
- Public installs never probe or upload to `/api`. The optional file adapter only considers known loopback hostnames while online, and checks the Patchwork health response before reading/writing.
- **Protect device storage** calls `StorageManager.persist()` from a user gesture and reports whether protection was granted. Browsers decide whether to grant it. See [WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
- Clearing website data removes the saved app, patches, and takes. Storage pressure can cause eviction where protection is unavailable. Export patches and download recordings for durable backups. There is no cross-device synchronization.
- Offline use does not bypass iPadOS background/screen-lock suspension, browser CPU limits, or hardware audio differences. Keep the app visible while performing. Converting an existing take to WAV is available; rendering a patch faster than real time remains separate future work.

## Cloudflare hosting

The production studio is **https://patchwork.jameslane.dev**, served by the **patchwork-studio** Cloudflare Worker. `wrangler.jsonc` points Workers Static Assets at `dist/`, with no application Worker script, bindings, database, paid services, or Node compatibility layer. It declares `patchwork.jameslane.dev` as a Custom Domain, allowing Cloudflare to manage its DNS record and HTTPS certificate. Separate `workers.dev` and preview URLs are disabled. Missing assets return 404; unknown API URLs are not rewritten to the app. `public/_headers` supplies update-cache headers plus the shared browser security baseline (same-origin scripts/connections, no framing, content-type protection, and same-origin microphone permission). Blob recording playback remains permitted; the Node production server uses the same baseline.

### Automatic deployment

Connect the **existing** `patchwork-studio` Worker to the GitHub repository `james-lane/modular-music-maker` under **Settings → Builds → GitHub**. Authorize only this repository when GitHub offers repository selection. The connection is an account setting in Cloudflare, not a field in `wrangler.jsonc`. Activation needs the one-time GitHub access confirmation; see project status for whether it has been completed.

Use these settings:

| Setting                              | Value                              |
| ------------------------------------ | ---------------------------------- |
| Production branch                    | `main`                             |
| Repository root                      | `/`                                |
| Build command                        | `npm run build:ci`                 |
| Deploy command                       | `npx wrangler deploy`              |
| Builds for other branches / Previews | Disabled                           |
| Included paths                       | All files, including documentation |
| Node                                 | 22, from `.node-version`           |

Cloudflare installs dependencies using the committed npm lockfile before the build command. Do not set `NODE_ENV=production` or omit development dependencies during installation: TypeScript, Vite, tests and Wrangler are build tools. Deployment authentication stays in Cloudflare's build-token storage; never put tokens in the repository or GitHub workflow files. No GitHub Actions deployment or local post-commit hook is needed.

`scripts/ci-build.ts` restores full history with `git fetch --unshallow origin` only when required, then verifies the checkout is clean and runs `npm run format:check` and `npm run check`. This retains the shared commit-count/hash version calculation and runs the real HTTP tests before publication. Cloudflare only runs the deploy command after a successful build. GitHub pushes to `main` then publish to the existing custom domain automatically; local commits and other branches leave production unchanged. Documentation-only commits also produce a correctly versioned release. Failed builds leave the last successful deployment available.

For initial verification, push a reviewed commit to `main`, watch its build in the Worker's **Deployments** tab, and confirm the hosted `/version.json` revision equals that GitHub commit with `dirty: false`. Check the installed update notice, public API 404 responses and offline playback. Do not run `npm run deploy` as well: that would create a second manual release. The existing session-safe offline update lifecycle remains in place.

For manual recovery only, authenticate with `npx wrangler login` if needed, run the checks above, then use `npm run deploy`. `npx wrangler deploy --dry-run` validates packaging without publishing. Wrangler credentials, `.dev.vars*`, and `.wrangler/` state remain excluded from Git. The Node API is excluded from every hosted build.

See [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) and the [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) for Cloudflare's current settings and supported Node version files.

Cloudflare documents free, unlimited static asset requests and no extra asset storage charge; Worker-script execution has separate pricing. No plan upgrade is needed: [billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Verification

Run `npm run check` and `npm run format:check`. In a fresh production profile, wait for readiness, disconnect networking, and reload. Verify saved patches, live analyser signal, editing, recording, reopening/downloading the take, library access, guides/examples, and patch import/export. Repeat at desktop, tablet portrait/landscape, phone, and short landscape sizes. Check page overflow and reachable footer, dialogs, and canvas controls. Simulate two complete releases and a failed download: verify notice/Later/manual checks, no refresh during recording or final IndexedDB saving, refusal with another studio window open, refusal on patch-save failure, immediate-edit retention on explicit offline refresh, saved-take playback afterwards, preservation of unrelated caches, and old-release offline use after a failed download.

Before distributing an iPad release, also test a physical iPad: install from Safari over HTTPS, reopen the icon in Airplane Mode after the first download, play keys/pads, record/reopen a take, and check Files downloads/imports, portrait/landscape, split view, workspace-only pinch (including a pinch starting over a knob or module header), two-finger keys/pads, top status-area fade, and resuming after screen lock. Check that releasing one finger during a pinch does not edit a module or leave a held note. Emulation cannot prove physical Safari home-screen/audio behavior.
