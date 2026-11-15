# Patchwork

A modular music studio for the browser, built with TypeScript, React, Vite, and a Node.js/Express server. Inspired by a physical modular synthesizer: add instruments, turn knobs, and connect sockets with patch cables.

**Open the studio: [patchwork.jameslane.dev](https://patchwork.jameslane.dev)**. Choose **More → Example patches** and press **Play**. Patches and recordings stay in your browser; wait for **Offline ready** to use the studio without a connection.

## Run the studio

Requires **Node.js 22.12 or newer** and npm.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The development command starts both Vite (5173) and the local Node API (3001). Press **Play** to hear the connected starter patch. Audio starts only after a user gesture.

For a production build served by Node:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. The server binds to loopback and rejects unexpected hostnames and foreign browser origins. Open it through `localhost` or `127.0.0.1`; the development proxy remains supported. No accounts or external services are needed to make music.

## What works

- A searchable module library with sixteen working modules: drum machine, drum kit, keyboard, pad controller, step sequencer, oscillator, noise, Mic sampler, LFO, filter, delay, reverb, XY Effects, mixer, merger, and output.
- Seven contrasting example patches under **More → Example patches**. The chooser opens on a first visit. Each example opens an editable copy and keeps your current work in My patches.
- Each module in the library has a **?** help button. Its guide explains setup and controls, shows compatible sockets/modules, and provides a worked patch example. Select a compatible module to explore its guide, then use Back to return.
- Open **Add modules** for a compact module list with category filters. Tap the search icon when you want to type; opening the drawer leaves the iPad keyboard closed. Drag a row with a mouse, or drag its grip on a touch screen, then release over the placement preview. The **+** buttons add modules without dragging. Move placed panels by dragging their headers.
- Click an output socket, then a matching input socket to connect them. Audio, pitch, modulation, trigger, and kit are separate signal types. Click a connected input to reroute its cable; double-click a cable to unplug it.
- **More → Studio settings → Theme** offers **System** (the default), **Light**, and **Dark**. System follows your device setting as it changes; overrides are remembered in this browser across patches and reloads. The main UI and dotted workspace adapt while instruments retain their colours and materials.
- Choose **More → Studio settings → Patch cable style → Braided module colours** to weave together both connected modules' enclosure colours: for example, cream and ochre from the sequencer and oscillator. Plug colours retain their socket accents. **Classic colours** remains the default. The choice is remembered in this browser across patches and reloads.
- **More → Studio settings → Patch cable opacity** fades connected cables and plugs from **100%** (the default) to **0%** (hidden), in either cable style. New cables remain visible while connecting. This browser remembers the opacity across patches and reloads; sound and saved patch files are unaffected.
- Individual hardware finishes: walnut keyboard cheeks, a violet rubber-pad controller, coloured effects enclosures, ivory/chrome knobs, and a compact silver mixer with vertical faders. Module dimensions vary to suit the instrument.
- Hardware-style knobs respond to vertical dragging, arrow keys, Home/End, and double-click reset. Hold Shift for finer dragging.
- Eight editable sequencer steps with an independent **Step rate** selector: **1/4**, **1/8** (default), or **1/16**, synced to the project tempo. **Gate** sets how much of each step sounds. Tap to cycle through notes, or press and drag/swipe up to raise a note and down to lower it (including a rest at the bottom). Hold Shift for finer dragging. Arrow keys adjust a focused step; right-click inserts a rest.
- Tempo, root note, scale, time signature, master volume, mute, live waveform, and level meters. The **More → Studio settings** panel keeps all settings available on narrow screens.
- A compact, single-row toolbar and an on-demand module drawer leave the workspace at full width. The canvas stays clear of decorative slogans. **More** holds My patches, Recordings, examples, help, and settings. The **Focus on workspace** button beside Undo hides the toolbar/footer; use it again to return.
- An effectively infinite workspace extends in every direction: move modules beyond the old rack edges, including left/up from the starting point. Hold a dragged module near a screen edge to keep travelling. Pinch to zoom around your fingers; drag empty workspace with one finger to pan. Trackpad/wheel scrolling and the Pan tool move the view; use Fit modules to view to find your patch again. With the workspace focused, arrow keys pan (Shift moves farther) and Home fits the patch. The zoom buttons, trackpad pinch, undo, and redo remain available. Pinching the rack leaves the app controls at their normal size. Keys and pads still support multiple fingers.
- App labels resist text selection and touch callouts, including double taps and long presses on iPad/iPhone. Patch names and search fields retain normal text editing, selection, and paste.
- Undo and redo patch changes with the two arrow buttons beside workspace focus. **⌘/Ctrl Z** undoes; **⌘/Ctrl Shift Z** or **Ctrl Y** redoes. Drags and held adjustment keys undo in one step, including slow gestures. Unchanged controls leave history intact. History holds the latest 60 edits for the open patch; opening another patch or reloading starts fresh. Text fields retain normal text undo. Camera movement, live playing, recordings, and cable appearance stay outside patch history.
- Automatic browser patch saving, manual Node file saving, a patch library, and validated JSON import/export.
- Record live output, play back saved takes, and download **WAV**, **MP3**, or the **original recording**. Recording captures the studio output, **not the microphone**.
- Install on an iPad/iPhone home screen, Android, or desktop and use the complete studio offline after its first download. **More → Use offline / install** shows readiness and installation steps.

## Use offline or install on iPad

The installed app name is **Patchwork** on desktop and mobile. The browser title and installation metadata use this short name; sharing previews retain the “a playground for sound” tagline.

Open the production app while connected and wait for **Offline ready** in the bottom bar. The app saves all its code, styles, icons, examples, and guides on the device. Instruments synthesize sound locally, so playback, live keys/pads, editing, saving, recording, and import/export remain available without a connection.

On iPad or iPhone, open the hosted HTTPS address in **Safari → Share → Add to Home Screen → Add**. Leave **Open as Web App** enabled if shown. Launch the new home-screen icon once while online and wait for **Offline ready** there before switching to Airplane Mode. Installation may use a separate library from the browser tab; export/import patches to transfer existing work. Desktop/Android users can use their browser's Install app, Add to Home Screen, or Add to Dock option. Installation is optional for offline browser-tab use.

The first download needs HTTPS (or localhost for testing). The Vite development server does not install an offline copy. Test the built app locally with:

```sh
npm run build
npm run preview
```

Open **http://127.0.0.1:4173**, wait for readiness, then disconnect and reload. On an iPad, `127.0.0.1` refers to the iPad itself; use a hosted HTTPS address for installation. A plain HTTP LAN address is insufficient for offline installation.

Connected visits, returning to the app, and periodic checks while visible look for updates. When a complete release is downloaded, **Patchwork has an update** offers **Refresh now** or **Later**. Refresh works inside a home-screen app, saves your latest patch, and waits until playback is stopped and any recording has finished saving. Close other Patchwork windows before refreshing. **Later** keeps the current session; **More → Use offline / install** retains **Refresh now** and **Check for updates**. You can also close every Patchwork window and reopen to apply an update. The app never reloads a performance automatically.

Existing installs from before the refresh prompt need one full close-and-reopen cycle while connected to receive this feature. On iPad, close Patchwork from the app switcher and close any Safari tabs of the studio, then launch the home-screen icon again. Keep the studio in the foreground while performing: mobile operating systems can suspend background audio. Device storage can be cleared or evicted, so keep patch exports and recording downloads as backups. **Use offline / install → Protect device storage** requests additional protection where supported.

See [offline design and deployment](docs/OFFLINE.md) for lifecycle details, device testing, and Cloudflare hosting.

## Choose a starting point

Open **More → Example patches**, choose a patch, then press **Play**. Each card describes the sound and suggests something to change first. Opening an example stops playback; it never starts sound automatically.

| Patch            | Sound and approach                                                                     |
| ---------------- | -------------------------------------------------------------------------------------- |
| Sunday circuits  | Warm C-minor sequenced melody at 108 BPM, with filtering and delay                     |
| Pocket rhythm    | Drum groove at 108 BPM with a swappable kit, keyboard, and percussion pads             |
| Warehouse pulse  | Driving drums and a clipped F-minor bass line at 128 BPM                               |
| Coastal static   | Ambient noise, slowly swept by an LFO through a filter and reverb                      |
| Tiny arcade      | Two independent sequencers playing square/triangle voices in G at 152 BPM              |
| Copper currents  | 94 BPM D-pentatonic dub with a hybrid Drum kit, Merger and hands-on XY Effects         |
| Clockwork garden | A 23-module E-minor ensemble at 118 BPM with layered voices and rhythm/effect submixes |

**Clockwork garden** is the larger worked patch: two drum machines share a rhythm Mixer, three sequencers drive bass, lead, and answering bells, and one lead sequence fans out to two detuned oscillators. A second Mixer blends that pair; separate filters, LFOs, and eighth/dotted-eighth Delays shape the voices. One Merger gathers the melodies through Reverb, and another combines that bus with the dry rhythm. The four rows run top to bottom: rhythm, bass, layered lead, bells. Use Fit to see the whole patch, then zoom into a row. Try muting either lead Mixer fader to hear what each oscillator adds.

Coastal static is free-running: its LFO Rate controls the wash rather than the composition tempo. The other patches use the transport clock. Choose the same example again for a fresh original; your edited copies remain available in **More → My patches**. Returning visits restore the active saved patch without reopening the chooser.

## Play drums and keys

Use **More → Example patches → Pocket rhythm** for the connected performance example. Your current patch stays in My patches. The instruments and Drum kit are also available separately in the module library.

- **Drum machine:** a 16-step, four-voice sequencer defaulting to kick, snare, clap, and closed hat. Connect a Drum kit to assign different sounds; the numbered voice labels follow your choices. Click switches to edit the rhythm; click a voice name to audition it. **Pattern on/off** mutes the sequencer without disabling live pad hits. Level, tone, and decay are configurable. Press Play to start the pattern at the composition tempo.
- **Keyboard:** 25 chromatic piano keys with octave and velocity controls. Wire **PITCH / GATE → Oscillator PITCH**, then route the oscillator's audio to an output (directly or through effects/mixer). Tap/hold keys or slide across them with a finger, mouse, or pen. Each finger follows its own key; moving outside the keybed releases that finger's note and moving back plays again. Focus the keys and use **A W S E D F T G Y H U J K O L P ;**. Enter/Space on a focused key plays a short note. Oscillator voices are monophonic: the last held note wins and releasing it returns to the previous held note. Keyboard notes are chromatic, independently of the sequencer's scale.
- **Pad controller:** sixteen rubber-style pads mapped to kick, snare, clap, hats, toms, rim shot, shaker, crash, ride, cowbell, tambourine, claves, and congas. Wire **TRIGGER OUT → Drum machine TRIGGER IN**, then route the drum machine's **AUDIO OUT**. Focus the pads to use **1 2 3 4 / Q W E R / A S D F / Z X C V**.

- **Drum kit:** a terracotta sound cartridge, included in fresh Pocket rhythm examples. Connect **KIT OUT → Drum machine KIT IN**. For each of voices **1–4**, choose any built-in percussion sound, **Imported sample**, or **Audio input**. The rhythm stays on the drum machine. Its first four pad triggers follow these assignments; the other twelve pads retain their printed sounds. Unplug KIT IN to restore the internal kit.
  - **Samples:** choose Imported sample, then Load audio. WAV, MP3, M4A/AAC, Ogg, WebM, and FLAC can be imported where the browser supports their codecs, up to **four seconds / 20 MB per file**. Imports decode in small chunks with duration and memory limits; unsupported codecs show a request to convert to PCM WAV. Files are limited to eight channels, 192 kHz, and 16 MiB of decoded float audio; convert unusually large multichannel clips to mono first. Samples become compact mono audio at 24 kHz and are embedded in the patch, so saves, exports, and offline playback include them. The patch sample budget is roughly sixteen seconds in total. Replace loads a different sound; × removes it. Switching sound modes keeps the sample for later.
  - **Other modules:** connect an audio output, such as Noise or Oscillator, to the matching **IN 1–IN 4**, then choose that numbered Audio input. For a directly connected **Mic sampler**, each hit starts an independent playback of its saved, trimmed snippet—there is no need to press Play snippet or time it. Repeated hits overlap and each plays the full selected length. Sampler Speed/Level and Drum machine Tone/Level apply. Drum machine Decay fades the sample tail: **1× or higher** keeps its natural length; lower settings fade the tail earlier without cutting off its source. Changes affect new hits. Other sources such as Noise/Oscillator remain live inputs: each hit gates their current sound, with **Input decay × Drum machine Decay** setting the envelope length. A sampler routed through an effect first is a live input; put effects after the Drum machine for independently triggered samples. Empty inputs/samplers and unloaded sample slots are silent.
  - Click a numbered cartridge button to audition through its connected drum machine. Drum machine Level applies to every source; Decay shapes built-in/live envelopes and sampled tails. Tone tunes built-in sounds and recorded/imported samples, while ordinary live audio inputs retain their incoming pitch. One kit can feed several machines. Importing and reading the guide are silent.

Keys, pads, and drum audition work with the transport stopped. They wake the audio device for live playing and suspend it after a short tail when idle. Stop silences the instruments. Recording captures their routed audio along with the sequencer. Play/Record starts the transport; turn Pattern off to record only live playing.

Drum patterns repeat every sixteen sixteenth-notes (one 4/4 bar); melodic patterns repeat every eight steps at their selected rate. Each sequencer can run at a different rate. Live rate changes join the shared transport grid without restarting; a short already-queued segment may retain the previous timing. Older patches open at 1/8, preserving their sound. Both pattern types repeat independently of the time-signature display. No physical MIDI device support is included yet.

## Record a sound from your microphone

Add **Mic sampler** from **Sources**. Press **Record mic**, allow microphone access, and speak, clap, or capture a found sound. Press **Finish** to keep it, or let the four-second limit finish automatically. **Cancel capture** discards the attempt. A replacement keeps the previous snippet until the new recording succeeds. Microphone access needs HTTPS or localhost and browser permission; no permission is requested by adding a module, opening a guide, or recording the studio output. The mic is never monitored through the speakers.

Connect **AUDIO OUT** to an effect, Mixer, Merger, or Output. Press **Play snippet** to play it once, even with the transport stopped. Or connect Pad controller **TRIGGER OUT → TRIGGER IN**: every pad restarts the same snippet, with pad velocity controlling the hit volume. **Level** controls volume; **Speed** changes pitch and length together on the next hit (0.5× is an octave lower, 2× an octave higher). Top-bar Play does not automatically trigger snippets.

**Start** and **End** trim sliders choose the part to keep; the waveform dims the discarded ends and shows the selected duration. Use touch/mouse or arrow keys, Home, and End. Changes apply on the next button/pad hit. The original recording stays in the patch; **Reset trim** restores it, and Undo/Redo works for trim edits. A successful replacement resets the trim; failed or cancelled recordings keep the previous sound and selection.

To sequence a snippet directly, connect **Mic sampler AUDIO OUT → Drum kit IN 1–IN 4**, select the corresponding **Audio input** voice, then connect **KIT OUT → Drum machine KIT IN**. Each drum hit plays the saved selection independently, with overlapping tails. You do not need to press Play snippet or download/reimport a WAV.

**Download WAV** saves only the selected section at its original speed and level for use elsewhere, including **Drum kit → Imported sample → Load audio** for sequenced playback. **Clear** removes the clip; Undo restores it. Capture ends and releases the microphone on Finish, Cancel, Stop, module removal, patch switching, or hiding the app. Refresh waits for capture and processing to finish. Headphones keep a playing backing track out of the recording.

Snippets use the same compact mono 24 kHz PCM format and shared patch sample budget as Drum kit samples (about sixteen seconds in total). They are embedded in browser saves and patch exports, and play offline without microphone access. New capture works offline where device/browser permissions permit it. No audio is uploaded to a service; the optional local Node save includes it in the patch just like imported samples.

## Merge several sounds

Add **Merger** from **Utility** in the module library. Connect up to four instrument or effect audio outputs to **IN 1–IN 4**, then connect **SUM OUT → Output AUDIO IN** (or another effect). Each **Input 1–4** knob independently controls its sound from silent to 100%; **Sum level** controls the combined volume and starts at 50%. Input levels start at 100%, including when opening older patches, so existing mixes keep their sound. Empty inputs are silent; the amber indicators show attached cables. The teal metal enclosure and ivory dials give it its own hardware identity.

For more than four sources, connect one Merger's SUM OUT to another Merger input. Adding sources adds their levels, so balance them with the individual input knobs and lower Sum level if needed; use the two-channel **Mixer** when you prefer faders. Pitch, modulation, and trigger signals retain their existing socket types: route a Keyboard through an Oscillator, or pads through a Drum machine, before merging their audio. The Merger's **?** guide includes a four-input example with an echo return.

## Blend effects with a touch

Add **XY Effects** from **Effects**. Connect an instrument's AUDIO OUT → XY Effects AUDIO IN, then XY Effects AUDIO OUT → Output AUDIO IN. Tap or drag the point around the four-quadrant pad. The centre is clean; moving towards an edge brings in the surrounding corners, and a corner isolates its effect. Release to keep the position. **Mix** sets the maximum processed amount; **Centre** restores clean audio.

The defaults are **Filter** (top left), **Echo** (top right), **Grit** (bottom left), and **Space** (bottom right). Each corner's selector can choose any of those, **Thin** (high-pass), or **Clean**. Repeated choices are allowed. Filter softens the source, Echo repeats it, Grit adds soft distortion, and Space adds reverb. Corner reassignment and movement crossfade smoothly while playing. All choices, X/Y position, and Mix save/export with the patch and work offline.

Focus the pad and use arrow keys to move; hold Shift for fine adjustments, or press Home to centre. The labelled X and Y sliders offer separate axis controls. Reading its **?** field guide is silent. The copper enclosure and recessed glass pad give it its own hardware identity.

## Saving and privacy

New saves and exports use patch format **v2**, which supports signed positions on the open workspace. Existing v1 patches migrate automatically on loading without changing their IDs, sounds, samples, cables, or positions. Older app releases cannot open v2 exports; update the receiving app before importing them.

| Item       | Storage                                                                                                               | Portable backup                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Patches    | Browser localStorage automatically; local Node `.data/*.json` when **Save patch** is pressed and the API is available | **Export** downloads `.patchwork.json` |
| Recordings | Browser IndexedDB                                                                                                     | **More → Recordings → Download**       |

Browser data belongs to the current origin and browser profile. The local preview and a hosted website have separate libraries. Clearing site data removes browser saves. Export patches and download recordings you want to keep.

Open **More → Recordings**, choose **Save as**, then **Download** for each take. **WAV** is 16-bit PCM at 48 kHz for editing; **MP3** is 192 kbps at 48 kHz for smaller sharing files. Both preserve mono/stereo channels. **Original** downloads the unchanged WebM/Opus, Ogg/Opus, or MP4/M4A file captured by your browser. Existing takes have the same choices; conversion leaves the saved original intact. Converting compressed audio to WAV does not restore detail lost during capture. Downloads are prepared silently on this device, work offline, and never upload audio. Closing the dialog cancels an unfinished export. If conversion is unavailable, choose Original.

The frontend can also be hosted as static files from `dist/`; it retains browser saving, recording, and offline installation. Public installs make no patch API requests. The optional Node file API is only used on loopback after identifying a running Patchwork server, and is skipped immediately when offline. Static hosting does not run Node. Takes are limited to 10 minutes by a configurable default. MP3 encoding uses the locally bundled [LAME/lamejs encoder](public/licenses/lamejs.txt).

## Cloudflare hosting

The production studio runs at **https://patchwork.jameslane.dev** on the **patchwork-studio** Cloudflare Worker. `wrangler.jsonc` publishes only the built `dist/` assets and declares the custom domain; Cloudflare manages its DNS record and HTTPS certificate. The build has no remote fonts, samples, CDN scripts, account service, or cloud storage dependency. Cloudflare lists static asset requests as free and unlimited, with no additional asset-storage charge; this design does not invoke a Worker script or need a paid plan. See [Cloudflare's current limits and pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). The optional local Node API stays on your computer.

To publish an update from this checkout:

```sh
npm ci
npx wrangler login
npm run check
npm run format:check
npm run deploy
```

Login is only needed when credentials are missing or expired. `npm run deploy` rebuilds the studio before uploading it; `npx wrangler deploy --dry-run` validates an existing build without publishing. Deployments are manual: pushing to GitHub alone does not publish an update. Credentials stay outside the repository. Existing open sessions retain their cached release until the user chooses **Refresh now** from an idle, sole window, or closes all Patchwork windows and reopens.

## Commands

| Command                | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Frontend and Node server with automatic reload    |
| `npm run build`        | TypeScript check and production frontend build    |
| `npm run preview`      | Serve the production/offline app at port 4173     |
| `npm run deploy`       | Build and publish to patchwork.jameslane.dev      |
| `npm start`            | Serve `dist/` and the local file API              |
| `npm test`             | Domain validation and real HTTP/persistence tests |
| `npm run typecheck`    | Strict TypeScript checking                        |
| `npm run check`        | TypeScript, tests, and production build           |
| `npm run format`       | Format tracked source and documentation           |
| `npm run format:check` | Check formatting without editing                  |

## Configuration and architecture

- The bottom-right badge shows the package version plus Git commit number, such as **v0.1.0+20**. Its accessible label/hover text includes the commit hash; **\*** marks uncommitted changes. Every commit (including documentation-only or empty commits) automatically gets a distinct full version on the next build, without version-bump commits or local Git hooks. A running development server also refreshes the badge after commits and checkouts. `package.json` owns the release series; `dist/version.json` records the exact build identity and is cached with the offline app. Use a full Git checkout; shallow builds fail with recovery guidance, and source archives are explicitly labelled `+source`. Publishing still uses the normal manual deployment command, and installed sessions show their own running release until updated.
- `index.html`: canonical production address, Open Graph, and Twitter/X large-image sharing cards. The locally bundled 1200×630 preview in `public/social/` shows the real studio interface. See [sharing previews](docs/SOCIAL_PREVIEWS.md) for refresh and verification steps.
- `src/config.ts`: application limits, tempo range, workspace navigation, autosave, scheduler timing, scales, and root notes.
- `src/domain/modules.ts`: module catalog, defaults, parameter limits, ports, dimensions, and accent colors. `src/domain/module-guides.ts` contains the guides and derives compatibility from the catalog sockets.
- `src/domain/examples.ts`: example patch catalog, sound recipes, artwork colours, and starter tips. Recipes use the ordinary module defaults and override only the settings that define each sound.
- `src/styles.css`: shared theme tokens, panel mechanics, knobs, and sockets. `src/components/module-finishes.css` defines individual materials, colours, knob finishes, and enclosure details; `instruments.css` defines specialized performance layouts.
- `server/index.ts`: listener; `PORT` and `PATCHWORK_DATA_DIR` environment variables configure the server. See `.env.example`. Set these in your shell; `.env` is documentation only and is not automatically loaded.
- `.openai/hosting.json`: reserved private Sites preview configuration; no Sites version has been published. It does not affect local development or the Cloudflare deployment.

Start with [the architecture](docs/ARCHITECTURE.md), [the module guide](docs/ADDING_MODULES.md), and [the project status](docs/PROJECT_STATUS.md). Future agent sessions should read [AGENTS.md](AGENTS.md) before editing.

## Deliberate first-version boundaries

This is a local-first creative tool. There is no account system, cloud patch database, collaboration, MIDI, sample upload, offline render, or third-party plugin loading yet. The sequencer always has eight steps; the time signature changes beat grouping, while its eight-step pattern continues independently. Cable feedback cycles are rejected; Delay owns a bounded internal feedback loop. Audio is scheduled on the Web Audio clock, but background browser throttling can interrupt playback.

The Node API has no authentication and should remain on loopback. Add identity, ownership, request protection, and a deployment storage adapter before exposing it publicly. Recording/export avoids needing a server-side audio encoder.
