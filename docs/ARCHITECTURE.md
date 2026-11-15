# Architecture

## Stack and responsibilities

React renders the studio. Vite compiles TypeScript and provides development reload. Express runs on Node and optionally persists patches as JSON files. The browser's Web Audio API synthesizes, schedules, routes, analyses, and records sound locally.

```text
React controls / workspace
          │
          ▼
    Project (plain data) ───► autosave → localStorage
          │                      └── manual save → Node API → .data/
          ├────────────────► JSON export / validated import
          ▼
     AudioEngine
          ├── module factories → Web Audio graph
          ├── look-ahead scheduler → oscillator pitch/gate + drum hits
          ├── analyser → live scope and meters
          └── MediaStream destination → MediaRecorder → IndexedDB / download
```

## Source map

| Area                                      | Responsibility                                                      |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `src/config.ts`                           | Shared product defaults, limits, scale tables                       |
| `src/domain/types.ts`                     | Serializable model and catalog interfaces                           |
| `src/domain/module-guides.ts`             | Teaching copy, example wiring, and derived socket compatibility     |
| `src/components/ModuleHelpDialog.tsx`     | Library field-guide modal with related-guide navigation             |
| `src/domain/modules.ts`                   | Declarative module registry                                         |
| `src/domain/project.ts`                   | Starter patch, module creation, connection invariants, pitch math   |
| `src/domain/examples.ts`                  | Five example recipes, catalog copy, and independent copy factories  |
| `src/components/ExamplePatchesDialog.tsx` | First-visit and reusable example patch chooser                      |
| `src/domain/validation.ts`                | Shared Zod validation for every data boundary                       |
| `src/domain/storage.ts`                   | Browser patch library, optional server sync, downloads              |
| `src/domain/preferences.ts`               | Validated browser-only cable appearance preference                  |
| `src/audio/factories.ts`                  | Audio node creation, parameter updates, disposal                    |
| `src/audio/engine.ts`                     | Context lifecycle, graph topology, note scheduling, analysis        |
| `src/domain/samples.ts`                   | Portable PCM conversion and validation                              |
| `src/audio/sample-import.ts`              | Silent browser decoding/downmixing of imported percussion samples   |
| `src/components/DrumKitPanel.tsx`         | Voice selectors, local sample import, and routed audition           |
| `src/audio/drums.ts`                      | Synthesized kit recipes, scheduled one-shot ownership and cleanup   |
| `src/audio/live.ts`                       | Ephemeral keyboard/pad gesture contract                             |
| `src/domain/instruments.ts`               | Drum identities/patterns, shortcuts and chromatic pitch helpers     |
| `src/components/KeyboardPanel.tsx`        | Piano key gestures, focus and note release                          |
| `src/components/XYEffectsPanel.tsx`       | Assignable corner selectors, XY gestures and accessible axes        |
| `src/domain/xy-effects.ts`                | Corner/effect identities and bounded continuous blend weights       |
| `src/audio/xy-effects.ts`                 | Fixed parallel effects graph, crossfaded buses and disposal         |
| `src/components/PadControllerPanel.tsx`   | Live pad layout, keyboard shortcuts and feedback                    |
| `src/components/DrumMachinePanel.tsx`     | Drum pattern switches and voice audition                            |
| `src/audio/recordings.ts`                 | Recording MIME selection and IndexedDB blob storage                 |
| `src/hooks/useStudio.ts`                  | Patch edits, grouped undo/redo, autosave                            |
| `src/hooks/useOffline.ts`                 | Production worker registration, verified readiness, update status   |
| `src/offline/worker.ts`                   | Complete release caching and uninterrupted update lifecycle         |
| `scripts/offline-build.ts`                | Generate release assets and revision from production output         |
| `src/components/OfflineDialog.tsx`        | Readiness, updates, installation guidance, storage protection       |
| `src/components/UpdateNotice.tsx`         | Dismissible update notice and explicit refresh controls             |
| `src/hooks/useAudio.ts`                   | Transport, recording lifecycle, React/audio bridge                  |
| `src/components/StudioHeader.tsx`         | Compact brand beside the transport                                  |
| `src/components/TransportBar.tsx`         | Playback, composition settings, save/export, navigation menu        |
| `src/components/Workspace.tsx`            | Canvas geometry, drag preview, sockets, SVG cables, zoom/pan        |
| `src/components/PatchCable.tsx`           | Classic/braided cable rendering and endpoint-coloured plugs         |
| `src/components/cable-geometry.ts`        | Cable curves and distance-based over/under braid geometry           |
| `src/components/ModuleCard.tsx`           | Registry-driven panel and special instrument controls               |
| `src/components/SequencerStep.tsx`        | Tap-to-cycle notes, vertical note gestures and keyboard adjustment  |
| `src/components/MixerPanel.tsx`           | Vertical channel faders using the existing mixer gain parameters    |
| `src/components/MergerPanel.tsx`          | Four-input cable-occupancy diagram for the summing module           |
| `src/components/module-finishes.css`      | Individual enclosure palettes, materials, knob finishes, and faders |
| `src/components/Knob.tsx`                 | Logarithmic/linear parameter editing and keyboard controls          |
| `src/components/Scope.tsx`                | Animation-frame waveform and RMS display                            |
| `server/app.ts`                           | Local Express API and production static serving                     |
| `server/repository.ts`                    | Validated atomic filesystem persistence                             |

## App versioning

`scripts/app-version.ts` reads the release series from `package.json` and derives a SemVer build identity from Git: `0.1.0+20.gabcdef0`, with `.dirty` for tracked/staged edits or untracked files. The commit count advances on every commit; the hash distinguishes branches with equal counts. Detached HEAD and linked worktrees are supported. Ignored dependencies/build output do not mark a checkout dirty. Shallow histories are rejected because their counts are incomplete; source archives without Git receive an explicit `+source` identity. No timestamp, network request, generated source file, or Git hook is required.

The Vite plugin supplies one snapshot to the typed `virtual:app-version` module and emitted `version.json`. `AppVersion` displays a compact `v0.1.0+20` badge in the bottom-right footer, including on phones, with `*` for local edits and the full identity in its title/accessibility label. Development watches source changes and Git's HEAD/index/branch refs (including atomic replacement) to refresh the module after commits or checkouts. Production metadata is fixed at build time, so cached/offline sessions identify the code actually running rather than the latest code on a server. The existing offline build includes the manifest and versioned bundle in the content digest, creating a distinct atomic release even for an otherwise empty commit. This identity is independent of `Project.version`, which remains the v1 patch schema.

## Link sharing

`index.html` declares the canonical production URL, Open Graph website metadata, and Twitter/X `summary_large_image` metadata directly in the HTML head. Crawlers do not need React, JavaScript, the Node API, or a saved patch. Both card formats reference the same absolute HTTPS URL for a locally bundled 1200×630 JPEG showing the real studio, with matching image descriptions and Open Graph dimensions/type. The production build copies `public/social/` unchanged and includes it in the atomic offline release. Replace the versioned filename and metadata together when refreshing the artwork; see [sharing previews](SOCIAL_PREVIEWS.md).

## Module field guides

Each library item has an accessible question-mark button alongside Add. `domain/module-guides.ts` stores a required guide for every module type: overview, setup steps, numeric control descriptions, special controls, a tip, and a worked example with actual module/port endpoints. `compatiblePorts()` derives possible partners directly from registry socket directions and signal types, excluding the same module type. These are capability matches; the normal workspace rules still reject occupied inputs and feedback loops.

`ModuleHelpDialog` groups equivalent sockets (such as Mixer IN A/IN B), displays compatible modules, and lets the user explore their guides in the same native dialog with a local Back stack. Reading or navigating help does not edit the patch, add modules, change playback, or enter undo history. The shared Modal uses an accessible title, native focus trapping and Escape/backdrop dismissal. Related-guide navigation resets scroll/focus within the modal, and closing returns focus to the original library button. The mobile library stays open behind the guide so it is available on dismissal.

The guide layout lives in `components/module-help.css`. Instructions and connections are text/semantic HTML rather than an audio preview. Tests validate guide control coverage, signal-specific compatibility, and every worked example against the real patch validator.

## Patch format and validation

`Project.version` is currently `1`. A patch contains its UUID, title, update time, tempo, root/scale, time signature, master volume, positioned modules, and directed cables. A module stores its registry type, UUID, position, parameters, optional eight scale degrees, an optional `drumPattern` map, and optional Drum kit `samples`. These fields are additive v1 extensions: old patches do not need migration. Drum machines must contain exactly the four named lanes of sixteen booleans; other module types cannot store a drum pattern. `-1` is a rest. Degrees `0…13` span two octaves of a seven-note scale; pentatonic degrees use its five-note table.

No AudioContext, AudioNode, React state, object URL, or recording blob is serialized into a patch. `parseProject` checks UUIDs, bounds, module types, parameter ranges/enums, unique IDs, known sockets, signal compatibility, input occupancy, instance limits, and acyclic routing. Unknown top-level/module/cable fields and unknown parameters are rejected. Imported patches receive a fresh project ID to preserve existing saved work.

Sequencer buttons retain native tap/Enter/Space activation to cycle forward and wrap. `SequencerStep` captures a single pointer and adjusts scale degrees from the initial press position: up raises, down lowers, with a rest below the lowest note and no wrapping during a swipe. Arrow keys adjust the same range. The range is shared with validation through `SEQUENCER_DEGREES` in the module registry; gesture thresholds and normal/Shift sensitivity live in `CONFIG.sequencerGesture`. Pointer state and click suppression remain local to the button; only degree changes enter the ordinary patch/history/autosave path, grouped per swipe. Pointer cancellation or lost capture clears the gesture. Workspace pinch cancellation uses that same path, so the remaining finger cannot resume note editing or cycle a note on release. Panel dimensions, playback scheduling, and the v1 saved shape are unchanged.

The current model allows fan-out from an output, one cable per input, and at most one Output module. Mixer has separate A/B inputs. Empty patches may contain no output and therefore produce no audible signal. Removing a module removes its cables in the same edit.

Merger adds four independent audio inputs (`in1`–`in4`) and one audio output (`out`) using the ordinary v1 module/parameter shape. It can receive instruments, effect returns, or other mergers; normal input-occupancy and cycle rules still apply. It cannot accept pitch, trigger, or modulation cables. The original Mixer remains a separate two-channel module with independent gain controls, preserving all existing saves.

## Audio lifecycle

`useAudio` owns exactly one `AudioEngine`. A user Play/Record or live instrument gesture creates and resumes the context. Stop suspends it. Live gestures can resume the audio device without starting the transport; after the final held key or hit, an idle timer allows a configured three-second effect tail, then suspends it. The UI distinguishes transport playback from an active audio device. Unmount stops recording, disconnects owned nodes, and closes the context. Engine disposal detaches references and resets graph identity synchronously before closing the old context asynchronously, allowing safe reuse during development Fast Refresh. Hook transport state is reconciled when effects restart. StrictMode double mounting is intentionally not used around live context ownership.

Topology is identified by module IDs/types and cables. Moving panels and editing parameters does **not** recreate the graph. A topology edit disposes the previous runtime graph and creates a new one. This simple first implementation can produce a transient on rewiring; future versions may crossfade graph replacements.

Each factory returns named input/output endpoints, an `update` function, a `dispose` function, and optionally a pitched voice. Audio/control cables connect native AudioNode or AudioParam endpoints. Pitch cables are event routes from sequencers or live keyboards to oscillator voices. Trigger cables route pad sound/velocity events to drum runtimes; neither event type becomes a native AudioNode connection. An unsequenced oscillator sustains the patch root note; a sequenced oscillator follows its pitch cable and gate envelope.

The Merger factory derives its inputs from the registry. Each socket owns a separate unity-gain node feeding a shared sum gain, whose `level` is smoothed and defaults to 0.5. Separate nodes preserve independent paths even when the same source is patched to multiple inputs; Web Audio would collapse duplicate connections to a shared endpoint. Levels are summed without automatic normalization, so attaching a cable does not rebalance existing sources. Disposal disconnects every input and the sum. The routing plate indicates cable occupancy, not audio metering; the Output module shows the real signal. Merger styling is in `module-finishes.css` and its footprint remains registry-driven.

The scheduler wakes every 25 ms and queues notes/hits 120 ms ahead using `AudioContext.currentTime`. Its shared tick is now one sixteenth-note. Drum machines advance every tick; melodic sequencers advance every second tick, preserving their original eighth-note timing. Visual step updates use separate timers aligned to the audio clock. Both pattern lengths repeat independently of the displayed time signature; 3/4 and 6/8 currently share three quarter-note beat groups. Tempo edits affect the next scheduling window, so a short already-queued segment may retain the old tempo.

Signal chain: Output module gain → dynamics compressor → master gain → analyser → speakers and recording destination. Filter/resonance and delay feedback have bounded parameters. The compressor softens peaks; this is not a mastering limiter. Reverb builds a local random decaying impulse, so recreating the graph produces a slightly different ambience. Noise is also generated locally.

## Performance instruments

App-wide `user-select` and WebKit's prefixed selection/callout rules prevent touch gestures from selecting printed labels, toolbar text, and guides. Inputs, textareas, and editable fields explicitly retain native text selection and paste. Browser zoom and focus/keyboard access remain available.

Keyboard pointers capture on their stable keybed, independently by pointer ID. Moves hit-test visible keys in viewport coordinates, respecting raised black keys and canvas transforms. A swipe changes its existing token's note, sends the new note-on before the old note-off, and releases the old pitch only when no other token holds it. Leaving the bed releases the note while retaining the pointer for re-entry. Pointer-up, cancellation, lost capture, blur, hidden documents, and unmount clear ownership. Workspace pinch cancellation uses the same path. Held tokens and their readout stay ephemeral.

`LiveControls` sends note-on/off and drum/pad hits without mutating serializable project data. Held keys, lit pads, AudioNodes, and live velocity events never enter undo history or autosave. The hook guards asynchronous audio activation: releasing a key before `resume()` completes cancels the pending note, and Stop invalidates pending live gestures.

Keyboard holds have last-note priority per oscillator. Releasing the last note silences the gain envelope; releasing a newer note restores a previously held one. Pointer cancellation, focus loss, visibility changes, window blur, Stop, topology changes, and unmount provide cleanup paths. The keyboard octave and the oscillator octave add together; oscillator detune still applies. Physical MIDI and polyphonic oscillator voices are not implemented.

`audio/drums.ts` builds sixteen kit sounds from short oscillators and filtered noise using editable recipes. Each triggered hit owns its nodes until all its sources end. Stop/disposal disconnects and stops outstanding sources, including scheduled hits. A closed hat chokes a ringing open hat; a configurable overlap limit bounds rapid triggering. Drum level/tone/decay affect sequenced and live hits. The four pattern lanes remain editable independently of the sixteen pad sound mappings; disabling Pattern stops scheduled hits but accepts live triggers.

The _Pocket rhythm_ example connects Keyboard → Oscillator, Pad controller → Drum machine, Drum kit → Drum machine, Drum machine/Oscillator → Mixer → Output. It is available through the example collection alongside the other starting points.

## XY Effects

XY Effects uses the ordinary v1 parameter map: registry-bounded `x`/`y` (−1…1, positive Y upwards), `mix` (0…1), and four validated effect IDs (`topLeft`, `topRight`, `bottomLeft`, `bottomRight`). Existing patches need no migration. Corner/effect identities and `xyBlend()` live in `domain/xy-effects.ts`; the registry owns dimensions and defaults. Compatibility derives from its audio input/output sockets.

The pad updates both coordinates atomically through the standard patch/history/autosave path, with a per-gesture group. It retains position on release, bounds out-of-pad drags, and cancels on lost capture, focus/window loss, hidden documents, and workspace pinch. Arrow keys, fine Shift arrows, Home/Centre, and labelled native axis sliders provide keyboard and assistive access. Corner selectors are native selects. The field guide never starts sound.

The audio runtime keeps a fixed parallel graph: low-pass Filter, a bounded feedback Echo, oversampled soft-clipping Grit, locally generated stereo Space reverb, high-pass Thin, and Clean. Static effect settings are centralized in `CONFIG.audio.xyEffects`. Bilinear corner weights are multiplied by maximum axis distance from centre and Mix; the remainder is dry. Weights are nonnegative and sum to one. Selecting an effect more than once adds its weights to one bus rather than duplicating nodes. Every bus gain ramps using the shared smoothing time, so movement and reassignment avoid topology changes. Effect inputs run continuously, allowing existing echo/reverb tails to be heard when blending towards them. Disposal disconnects every node and the feedback loop and releases impulse/curve buffers. No downloads, microphone permissions, or additional audio sources are required.

## Drum kit voice assignment

Drum kit adds a distinct `kit` signal: KIT OUT → Drum machine KIT IN. The existing v1 drum pattern keys (`kick`, `snare`, `clap`, `closed-hat`) remain stable lane identities, displayed as voices 01–04. Kit parameters use those same IDs to select a built-in recipe, `sample`, or `input`; defaults remain in the registry. Both sequenced hits and live audition/first-four-pad triggers resolve an assignment exactly once. The remaining twelve pads retain their literal sound identity. Unlinked drum machines use the original sounds. Fresh Pocket rhythm examples include a connected kit without changing the original rhythm or sound.

Kit runtimes own four independent passthrough buses. KIT links explicitly connect those buses to private per-lane drum-runtime inputs; they are not ordinary public audio sockets. Each receiving drum machine owns its envelopes, sample buffers, and one-shot sources, so fan-out remains independent. External audio is gated on each hit with Input decay multiplied by drum Decay; no audio is recorded, buffered, or pitch shifted. A silent looping source supplies audio-clock `onended` cleanup for each input envelope, including scheduled hits. Cleanup detaches only that hit’s connection, is idempotent across Stop/late callbacks, and uses the existing overlap bound. Topology replacement/removal disposes buses, buffers, sources, and connections. Parameter/assignment edits leave existing hits to finish and affect the next scheduling window.

Drum kit modules alone may contain `samples`, a map of known lane IDs to `{ name, pcm }`. PCM is base64 little-endian signed 16-bit mono at `CONFIG.samples.sampleRate` (24 kHz). This additive optional v1 field needs no migration; old project shapes/defaults still validate. Browser OfflineAudioContexts silently decode supported files, reject oversized/overlong clips, then downmix/resample before encoding. Four seconds and 20 MB are the per-file limits; decoded sample data is bounded independently, including at import/storage/API boundaries. The total encoded sample budget is 1,024,000 characters per patch (about sixteen seconds), and JSON import/API requests share a 2 MiB limit. Samples stay inside the patch rather than relying on URLs, IndexedDB IDs, or external services. Browser library quota can still be exhausted by multiple sample-heavy patches; the existing visible save failure/export path applies.

`configureKit` synchronously reconstructs AudioBuffers from validated PCM only when the data changes, avoiding asynchronous loading during playback. Sample playback starts at the scheduled hit time and follows drum Tone/Decay/Level. Empty sample/input modes are silent. `drumLiveTailMs` adds the possible sample/input duration to the normal idle effect tail so tuned samples are not cut short by live-audio suspension. Sample import checks module lifetime and commits data plus its selection atomically through validation/history/autosave; a removed module or switched project cannot receive a late import. Browsing the guide and importing samples never starts studio audio.

## Example patches

`domain/examples.ts` owns the five-item catalog, descriptions, starter tips, artwork colours, and sound factories. It reuses the original Sunday circuits and Pocket rhythm factories, and adds Warehouse pulse (drums and sequenced bass), Coastal static (noise/filter/LFO/reverb), and Tiny arcade (two independent sequenced voices). Each factory returns fresh UUIDs and independent parameters/pattern arrays. Examples are ordinary editable v1 projects; no template markers or UI data enter saved files.

`useStudio` records whether initialization found a valid saved active project. App opens `ExamplePatchesDialog` only on a first visit; returning visits restore the saved patch. Examples remain accessible through More → Example patches. Browsing is silent and does not change the project. Selecting one uses the existing project-switch path: stop audio/finish recording, flush the current patch to browser storage, clear undo history, and open the new copy with playback stopped. The chooser guards repeated selection while opening. Dismissal leaves the current patch intact.

`components/examples.css` provides responsive paper cards with CSS/SVG artwork and no external media. Tests verify five distinct routing arrangements, full output connectivity, validation/JSON round trips, non-overlapping in-bounds layouts, fresh IDs, and copy independence after edits. Keep all of these properties when replacing or adding recipes.

## Recording and persistence

MediaRecorder receives the engine's MediaStreamAudioDestinationNode stream, so no microphone/device permission is needed. MIME format is negotiated per browser. Chunks are assembled into a Blob and saved in IndexedDB after Stop recording. If storage fails, a direct download is offered automatically. Object URLs used for previews/downloads are revoked. Ten minutes is the configurable take limit. Downloads retain the supported native recording format; WAV export is future work.

Patches autosave to browser localStorage after 650 ms and flush on pagehide or hidden visibility (including mobile suspension). A manual Save optionally calls the Node API only when online on a known loopback hostname and after a Patchwork health response; the confirmation distinguishes successful server saving from browser-only saving. Public/static installs never attempt API calls. The library merges local and eligible server copies by ID/update time. Browser quota failure remains visible. Recordings and patches are origin-specific and are not synchronized between local/hosted previews or necessarily between Safari and a home-screen installation.

## Offline application lifecycle

Production builds include a standalone manifest, device icons, and a generated service worker. Its asset list and content revision derive from the complete Vite output. Atomic installation caches one complete release; cache-first requests cover only enumerated GET assets and root navigations. All resources are bundled locally. API calls and recording data never enter the app-shell cache. Patch saving, synthesis, and IndexedDB recording work independently of connectivity.

`useOffline` registers only in production on secure origins, checks readiness through the active worker, and exposes status in the footer and installation dialog. Updates wait for all old clients to close by default. The update notice and offline dialog offer a deliberate Refresh now action; it is disabled during audio startup/playing/live sound or while a recording is being made/stored. `useAudio.recordingPending` spans recording startup through final IndexedDB completion (or download fallback). `useStudio.flush` saves the latest snapshot synchronously, preventing a reload inside the autosave debounce window; a storage failure leaves the session open with export guidance.

`useOffline` checks on launch, reconnect, foreground return, and a configurable visible interval. It reports check errors separately from offline readiness. Dismissing the notice leaves the waiting update accessible in the offline dialog. On Refresh now, the waiting worker verifies the complete cache and a single requesting window before using `skipWaiting`. No other client can be switched during its unknown audio state. Controls become inert during activation; only an explicitly requesting page reloads on controller change, with timeout/error recovery. First installation and other controller changes never reload the page. Existing older clients acquire this UI through the original close-all-windows update path. Activation removes only outdated Patchwork app-shell caches. The dialog can request persistent storage without promising browser approval. Safe-area padding and bounded viewport height support installed tablet/phone windows. See [offline design](OFFLINE.md) for installation, limitations, and device QA.

`wrangler.jsonc` configures the assets-only **patchwork-studio** Cloudflare Worker at **https://patchwork.jameslane.dev**, excluding the local Node API. There is no application Worker script, hosted database, or cloud sync dependency. The Custom Domain configuration manages DNS/HTTPS through Cloudflare; `workers.dev` and preview URLs are disabled. Missing assets return 404 rather than falling back to HTML. `npm run deploy` rebuilds and publishes the studio using the project-local Wrangler dependency; deployments are manual and independent of GitHub pushes. Deployment credentials and local Wrangler state are never committed.

Node persists each validated UUID to `.data/<id>.json` using a unique temporary file and atomic rename. A corrupt stored patch is skipped during listing. This is a single-user local adapter, not a database or multi-user synchronization system. Request JSON is bounded to 256 KB. The service listens on `127.0.0.1`; it is not ready for unauthenticated public access.

## Canvas and styling invariants

The studio has one 56px toolbar (54px on phones), a 46px workspace heading, and a 26px status strip. The module catalog is a dismissible overlay opened with Add modules at every width; it retains search/category while browsing guides, focuses its close button on opening, and returns focus to Add modules on closing. Compact category chips and a small footer reserve most drawer height for the scrolling instrument list. Search is revealed and focused only by an explicit search-button action, keeping the iPad keyboard closed while browsing. More contains patch/recording libraries, examples, help, and settings. Workspace focus hides the toolbar and status strip without unmounting audio or changing the patch. Layout/drawer/zoom state is ephemeral, outside patch files and undo history.

The root document cannot scroll or overscroll; a fixed, opaque, safe-area-padded shell owns the viewport, and only internal rack, drawer, menu, and dialog surfaces scroll. This keeps scrolling content below the iPad status area. It does not claim to disable native iPadOS compositing effects; the reported home-screen top fade still requires an on-device check.

Modules use registry dimensions in an 1800×1200 stage. Zoom scales the stage and a matching scroll spacer. `useWorkspaceGestures` owns touch navigation with `touch-action: none` scoped to the rack, leaving browser magnification available elsewhere. A two-touch gesture applies distance-based zoom and midpoint translation around a fixed rack point; scroll offsets apply after React updates stage dimensions. Zoom limits and trackpad wheel sensitivity live in CONFIG. One finger on empty rack space pans; controls retain their own single-pointer gestures. Pinching cancels an in-progress module preview/control pointer before taking capture, suppresses incidental clicks, and waits for all fingers to lift before normal editing resumes. Multiple touches confined to keys/pads remain performance gestures. Pointer cancellation, window blur, visibility changes, listener cleanup, and partial finger release have explicit handling. Geometry is isolated in `components/workspace-geometry.ts`; no gesture mutates patch data. Dragging previews local coordinates and commits one history entry on release. Drop positions snap to a configurable grid and stay within bounds. Cabling uses registry socket positions and a CSS footer inset; update `socketPosition()` if socket geometry changes.

Library placement uses captured pointer events rather than relying on native HTML drag-and-drop, which is inconsistent on touch devices. `useModuleLibraryDrag` owns the movement threshold, click suppression, cancellation, and release coordinates; mouse users can drag the row, while touch/pen users drag the grip so the list can still scroll normally. App keeps the transient drag outside patch/history state and disables the dismissal backdrop’s hit testing during placement. Workspace hit-tests the visible rack, shows a registry-sized preview, converts screen coordinates through its current zoom/scroll, snaps/bounds the position, enforces instance limits, and commits once on release. Successful drops close the library and retain the rack scroll position; + additions still scroll into view. Releasing over the library/toolbar or cancelling via Escape, pointer cancellation, lost capture, window blur, or page hiding adds nothing.

**More → Studio settings** includes a browser-wide cable style choice. Classic preserves the existing signal/source colours. Braided uses both endpoint modules' enclosure colours for two interwoven strands. The `--enclosure-*` CSS tokens in `module-finishes.css` supply both panel faces and braid strands, keeping the weave aligned with the physical finishes (cream sequencer, ochre oscillator, forest-green filter, etc.). Registry accents continue to colour plugs independently. `cable-geometry.ts` samples the existing cubic curve and alternates strand depth at crossings; distance-based phase keeps the weave density consistent on horizontal, vertical, and long cables. Geometry is memoized by endpoint coordinates/style, so playback and unrelated parameter edits do not regenerate it. Cable hit areas and socket geometry are unchanged; the pending cable stays neutral until both endpoints are known. The weave is static and adds no animation.

`domain/preferences.ts` validates the stored cable style and falls back to Classic for missing, unknown, or inaccessible browser storage. The separate localStorage key and default live in `CONFIG.appearance`. Saving failure retains the choice for the current visit and shows a notice. Appearance is not part of Project v1, patch exports, undo history, or audio graph identity; opening/importing another patch preserves the browser preference.

The visual direction is a collection of distinct physical instruments, as explicitly requested by the user. Surfaces may differ in colour, material, size, silhouette, and controls. Enclosures include walnut-trimmed charcoal, violet polymer, ochre/green/blue/plum enamel, graphite, aged cream, and brushed aluminium. Instrument surfaces use CSS gradients, layered borders/shadows, fixed tick rings, rotating knob markers, metallic socket rings, and panel screws. SVG traces and cables avoid image assets. Actual waveform/level displays read the analyser. Performance layouts live in `components/instruments.css`; module finish palettes and material details live in `components/module-finishes.css`. Shared panel/knob mechanics read inheritable CSS custom properties declared on `.module-panel` in `styles.css`. The mixer has real vertical native range inputs, with channel values and persistence identical to the original knobs. Selected utility/effect widths are smaller, so old saved positions remain valid. Painted rails and decorative wood cheeks do not change the structural border box; cable math remains unchanged. Wide performance modules use registry dimensions like every other module. New modules added from the library are scrolled into view. Keep the hardware feel for modules; keep application chrome restrained.
