# Project status

Last updated: **15 November 2026**.

## Implemented foundation

Patchwork v0.1 is a TypeScript/React/Vite frontend with an Express/Node local persistence API. It includes thirteen functioning modules, including a 16-step drum machine, 25-key keyboard, 16-pad controller, and four-input audio Merger, a connected starter composition, a hardware-inspired panel design, patch cables, drag/drop and movement, composition controls, undo/redo, browser autosave, optional Node saves, JSON backups/import, live recording, recording playback/download, and keyboard-accessible controls.

The initial connected patch is **Step sequencer → Oscillator → Filter → Delay → Output**, named _Sunday circuits_. Eight steps run at 108 BPM in C minor. Sound begins after Play/Record or a live instrument gesture.

## Workspace-first iPad layout

The separate navigation header and permanent catalog sidebar have been replaced by one compact transport toolbar and an Add modules drawer. Patch/recording libraries, examples, help, and settings are under More. Workspace focus hides the toolbar/footer without stopping audio; its heading button restores them. The workspace fills the available width in portrait, landscape, and split view. Menus scroll in short windows, drawer search receives focus, Escape closes it, and dismissal returns focus to Add modules.

The rack now owns pinch zoom, including midpoint panning, with bounded zoom and a fixed point under the fingers. Drag empty rack space with one finger to pan. Knobs/module headers retain their usual single-pointer editing, while a pinch cancels their in-progress gesture. Multiple fingers on keys/pads remain musical input. Trackpad pinch zoom and zoom buttons also preserve their focal point. Patch data and audio topology remain independent of navigation.

An opaque, fixed, safe-area-padded shell prevents document scrolling/overscroll and keeps scrolling content in internal surfaces. This addresses app-side conditions around the reported top fade; it has not yet established whether iPadOS 27.0.1's native fade is eliminated on the user's iPad Pro 11-inch. No global browser zoom restriction was added.

Touch-enabled Chromium QA at 1194×834 verified a full-width 1194×706 rack (about 85% of window height, before physical safe-area insets), workspace pinch without page magnification, focal-point retention, touch panning, library/guide focus and Escape, workspace focus, live analyser output, recording/reopening/playback, and saved-patch restoration. Layout/menu/drawer checks also cover 834×1194, 768×1024, 1024×768, 390×844, 844×390, and 360×640 without page overflow. Checks use an isolated browser context, preserving user work. Additional production/offline checks verified pinches beginning on module headers and knobs, cancelled drag previews, lifting one finger without resuming an edit, ordinary knob/module movement afterwards, two simultaneously held keys, key release when a gesture changes into navigation, and pinch/drawer use after an offline reload. All 30 automated tests, strict types, production build, and formatting pass. Physical iPad pinch, safe areas, and the OS fade need on-device confirmation.

## Offline use and installation

Production builds are installable, offline-capable web apps. Complete releases are cached atomically, including code, styles, examples, guides, and icons. The footer confirms **Offline ready** after checking the cache. **More → Use offline / install** provides iPad/Safari and desktop/Android instructions, retry, update information, and optional persistent-storage protection. Updates wait for all app windows to close by default. A complete downloaded release now offers **Refresh now** and **Later**; the action also lives under **More → Use offline / install**, alongside **Check for updates**. Explicit refresh saves the latest patch and is blocked until audio is idle and the final recording data has been stored. The worker refuses if another window is open or its release cache is incomplete; only the requesting window reloads on activation. Automatic checks cover launch, foreground return, reconnection, and a visible fifteen-minute interval. No performance is automatically reloaded. The offline runtime adds no package dependency.

Patches and takes remain local, and public installs make no patch API requests. The optional Node adapter stays restricted to a verified loopback server and is skipped when offline. Autosave flushes when a mobile app becomes hidden. Safe-area padding and viewport-bounded minimum height keep installed and short landscape windows usable. Home-screen/maskable PNG icons reuse the waveform mark.

The production studio is published at **[patchwork.jameslane.dev](https://patchwork.jameslane.dev)** on the **patchwork-studio** Cloudflare Worker. `wrangler.jsonc` declares its Custom Domain and publishes only static assets, without application server code, a database, or a paid service. Cloudflare manages DNS and HTTPS; separate `workers.dev` and preview URLs are disabled. A project-local Wrangler dependency and `npm run deploy` make deployment reproducible. Deployments are manual; GitHub pushes do not automatically publish. Local credentials and deployment state are excluded from Git.

Hosted verification confirmed HTTPS, all ten public files matching the local production build, revalidated HTML, no-cache worker/manifest headers, and 404 responses for the unavailable Node API. Browser checks confirmed an example opening, a nonzero live output meter, recording and saved-take playback, edited tempo and recording persistence after reload, and **Offline ready**, with no browser warnings or errors. The example tempo was restored after checking persistence. Strict types, all 28 tests, production build, formatting, and Wrangler's deployment dry run passed.

Browser QA confirmed a full offline reload, restored patches, live output signal, recording/reopening/playback/download, and patch export/import. Desktop, 1024×768 and 768×1024 tablet, 390×844 phone, and 844×390 landscape layouts kept their footer and dialog accessible without horizontal overflow. No page errors occurred. Checks used a fresh browser profile on a separate preview origin, preserving user work.

Update QA deliberately failed a release download and confirmed the old copy still reloaded offline. A subsequent complete update waited while recording remained active. After closing and reopening offline, the new release activated, the saved patch and take survived, and only obsolete Patchwork caches were removed; an unrelated cache remained intact.

Update-notice QA verified detection during recording without interruption, disabled refresh during playback and artificially delayed take storage, Later and dialog recovery, refusal with a second open window, refusal on patch-storage failure, retention of an edit made just before refresh, explicit activation/reload while offline, saved-take playback, failed-download recovery, foreground update checks, and tablet/phone/short-landscape notices without overflow. Only obsolete Patchwork caches were removed; an unrelated cache survived. Service-worker tests also exercise sole-client authorization and incomplete-cache refusal. All 32 tests, strict types, formatting, and the production build pass. Existing installs predating the notice need one close-all-windows/reopen cycle to receive it.

The workspace layout/gesture changes and update notice are deployed to **patchwork.jameslane.dev** (Cloudflare version `c6ceb0ec-309d-44a7-a057-d2da3a36d15a`). Hosted verification matched all ten release files to the local build, confirmed update-cache headers and public API isolation, and passed touch/layout, live signal, recording/reopening, patch restoration, drawer/guide, focus mode, and phone/short-window checks without page errors. The prior deployed version is `29763a92-6237-4fc7-b699-cea90eb751ea` if a code/assets rollback is needed; browser-saved work is independent of deployment versions.

The user reports that the installed iPad app works well. Automated emulation still cannot verify physical iPad audio, Files interactions, or the reported native top fade. Emulation does not establish physical-device parity. See [offline documentation](OFFLINE.md) for first-download requirements, storage boundaries, the device checklist, and pricing sources.

## Example patches

**More → Example patches** opens five contrasting starting points: Sunday circuits (warm sequenced melody), Pocket rhythm (live drums/keys/pads), Warehouse pulse (128 BPM bass/drums), Coastal static (free-running modulated noise/reverb), and Tiny arcade (152 BPM two-voice chiptune). First visits open the chooser automatically; returning visits restore their active saved patch. Each selection opens a fresh editable copy, preserving the previous patch in My patches and stopping playback. Cards explain the sound and suggest a first adjustment.

Browser QA verified first-visit display, all five examples producing a live output signal, stopping playback on example switches, saving/reopening an edited variation, fresh original settings on repeated selection, returning-visit restoration, Escape, header/More entry points, and 390px phone scrolling with no horizontal overflow. The user's original studio patch was retained; audio/persistence checks used a separate local preview origin. No browser errors occurred.

## Module guides

Each library module has a question-mark button opening a guide with setup steps, control explanations, socket-compatible modules, a tip, and a worked patch example. Compatible modules can be explored inside the same modal, with Back navigation. Guides are read-only and retain the original library search/category and mobile drawer state. Compatibility derives from the registry; worked examples use actual port IDs and are checked by the patch validator.

Browser QA opened all twelve guides and verified related-guide navigation, Back, Escape, focus returning to the help button, retained library search, and a scrolling 390px phone layout without horizontal overflow. The patch stayed unchanged and playback stayed stopped throughout guide browsing; no browser errors were reported.

## Hardware appearance

**More → Studio settings → Patch cable style** now offers **Braided module colours** alongside the default **Classic colours**. Braided cables weave the two connected modules' enclosure colours into a static sleeve: cream/ochre for Sequencer → Oscillator, ochre/forest green for Oscillator → Filter, and so on. Shared CSS enclosure tokens supply both panel faces and strands; plug/socket accents remain independent. The browser remembers the choice across patches and reloads independently of patch files, undo history, and audio. Unknown/unavailable storage falls back safely; a failed save keeps the choice for the current visit and shows a notice.

Cable appearance browser QA verified live output while switching styles, alignment after moving a connected module, double-click unplugging/reconnection, saved connections and braided styling after reload, and keyboard operation/Escape in the settings dialog. The settings fit a 390px phone viewport with no horizontal overflow. Checks used a separate local preview origin, preserving the user's active patch.

The enclosure-colour correction was checked against the rendered panel face and strand colours for all four starter cables, confirming that strands match cream/ochre/forest-green/blue enclosures while plugs retain their independent accents. Live output, Classic/Braided switching, and reload persistence also passed, with no browser errors.

The circuit board has no decorative instructional text; the former “Room for your next idea” note and its subtitle have been removed.

The new **Merger** is a petrol-teal summing box with four audio inputs, a SUM OUT socket, an ivory Sum level knob, and amber cable-occupancy indicators. It sums without automatic normalization and can chain into another Merger. It uses the ordinary v1 parameter model, preserving existing Mixer modules and saved patches. Its guide includes compatibility information and a four-source example with an echo return.

Merger browser QA verified adding, moving with cables attached, all four inputs sounding individually, their combined output, silence at zero level, incompatible modulation rejection, unplug/reconnect, removal/undo with audio disposal/recovery, export/import, saved level and connections after reload, and a scrolling 390px phone guide without horizontal overflow. A merged take was recorded, played back, downloaded, and decoded as stereo Opus at 48 kHz; its measured RMS was approximately −21.5 dBFS. Tests used a separate local preview origin, leaving the user's active patch intact. No browser errors occurred during verification.

The user prefers individually designed instruments with different materials, colours, sizes, silhouettes, and controls. The current set includes a cream/charcoal drum computer, walnut-sided keyboard, violet pad enclosure, ochre oscillator, green filter, blue delay, plum reverb, terracotta LFO, graphite noise source, and a compact brushed-aluminium mixer with faders. Output has a cream laboratory enclosure and red master dial. Colours and material details are configurable in `components/module-finishes.css`; dimensions remain registry-driven. Selected modules are narrower, preserving previously valid saved positions. Browser QA verified the contrasting finishes across the catalog, control/socket spacing, live playback, and the mixer faders using both dragging and arrow keys; fader values persisted across saving and reload.

## Validation

- Strict TypeScript checking and a production Vite build.
- Thirty-two automated tests covering starter round trips, all registry defaults, musical pitch conversion, routing invariants, untrusted import data, cycles/dangling cables, atomic file persistence, corrupt neighboring files, real HTTP API validation, drum pattern validation/muting, controller event routing, backward-compatible v1 loading, all sixteen drum recipes, source disposal, hat choking, held-note priority/release, octave edits, and rebuilding disposed audio engines during development reload, guide control coverage, signal-specific compatibility guidance, valid wiring for every guide example, distinct/fully connected/non-overlapping example patches with independent copies, Merger input independence/chaining/saved levels/signal rejection/node disposal, and cable preference persistence/validation/unavailable storage without changing patch data, and immediate offline/public browser libraries without API traffic plus verified optional loopback saving, focal-point geometry/degenerate pinch starts, and explicit update activation/single-window/cache-completeness guards.
- Browser verification: live playback/analysis, keyboard knob changes, recording/save/reopen/download, Node saving, library drag-and-drop, module movement, modulation routing, incompatible-socket rejection, undo/redo, composition settings across reload, and desktop/390px phone layouts. The downloaded take was verified as stereo Opus at 48 kHz. New-instrument browser checks also verified live keyboard/pad audio with the drum pattern muted, note release, recording/reopening the live performance, and drum pattern/keyboard-octave persistence through a page reload. No browser errors occurred in the final verification run. See Git history for later validation updates.

## Known boundaries

- The source and history are hosted on GitHub, and production runs on Cloudflare Workers. A separate private Sites project was registered earlier, but source synchronization/publication to Sites was blocked by automatic approval review because that upload was not explicitly authorized. No Sites version has been published. Obtain explicit user authorization before retrying that separate upload.

- Local-first, single-user storage. No accounts or cloud database; static hosted copies use browser storage. The Node server remains local and unauthenticated.
- The melodic sequencer has eight steps; drum patterns have sixteen sixteenths. Keyboard voices are monophonic with last-note priority and chromatic pitch. No physical MIDI support.
- Eight-step melodic and sixteen-step drum patterns; time signature controls beat grouping rather than pattern length. 6/8 currently uses three quarter-note groups, not a compound-meter transport.
- Native MediaRecorder audio files (WebM/Ogg/MP4 depending on browser), not WAV/offline export. Recording takes are capped at 10 minutes.
- Entire module graph rebuilds when routing changes, which may make a small transient. Parameter/position edits keep the existing graph.
- Noise and reverb are generated anew for each graph, so their exact texture is not deterministic between sessions.
- Background tab throttling can interrupt browser audio scheduling.
- Responsive canvas scrolls/pans on narrow screens; a full hardware rack remains larger than a phone viewport.

## Suggested next work

1. Continue the dedicated-panel pattern established for the keyboard, pads, and drum machine as the catalog grows.
2. Add an ADSR/envelope and VCA module with a clear gate signal contract.
3. Add more editable drum lanes, tempo-synced effects, and configurable pattern lengths.
4. Provide deterministic noise/impulse seeds and gradual graph crossfades.
5. Add offline WAV rendering and MIDI input after defining their lifecycle and permissions.
6. Add user accounts and a real persistence adapter only when cloud sync is requested.

Keep these as potential directions, not automatic scope for future sessions.
