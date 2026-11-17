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

- A searchable module library with twenty-one working modules: drum machine, drum kit, keyboard, pad controller, step sequencer, oscillator, noise, Mic sampler, LFO, Envelope, Mod sequencer, Sample & Hold, XY controller, filter, delay, reverb, XY Effects, mixer, merger, Switch, and output.
- Nine contrasting example patches under **More → Example patches**. The chooser opens on a first visit. Each example opens a temporary editable copy. Choose Save patch to keep it; your saved work stays in My patches.
- Each module in the library has a **?** help button. Its guide explains setup and controls, shows compatible sockets/modules, and provides a worked patch example. Select a compatible module to explore its guide, then use Back to return. **Load demo patch** opens a fresh, ready-wired demonstration of the module currently shown, preserving saved work in My patches. Demos include any needed local sample and wait for Play or live keys/pads; browsing stays silent.
- Open **Add modules** for an alphabetical module list with category filters and search. The drawer stays open while you pan or zoom the exposed workspace; close it with its X, **Add modules**, or Escape. The Pan/zoom buttons stay reachable beside the drawer, or in a clear strip below it on phones. Tap the search icon when you want to type; opening the drawer leaves the iPad keyboard closed. Drag a row with a mouse, or drag its grip on a touch screen, then release over the placement preview. The **+** buttons add modules without dragging. Move placed panels by dragging their headers. Releasing over the toolbar or beyond the workspace keeps the move; press Escape during a drag to cancel it.
- All patch sockets sit along the bottom of their module. Click an output socket, then a matching input socket to connect them. Audio, pitch, modulation, trigger, and kit are separate signal types. Click a connected input to reroute its cable; double-click a cable to unplug it.
- **More → Studio settings → Theme** offers **System** (the default), **Light**, and **Dark**. System follows your device setting as it changes; overrides are remembered in this browser across patches and reloads. The main UI and dotted workspace adapt while instruments retain their colours and materials.
- Choose **More → Studio settings → Patch cable style → Braided module colours** to weave together both connected modules' enclosure colours: for example, cream and ochre from the sequencer and oscillator. Plug colours retain their socket accents. **Classic colours** remains the default. The choice is remembered in this browser across patches and reloads.
- **More → Studio settings → Patch cable opacity** fades connected cables and plugs from **100%** (the default) to **0%** (hidden), in either cable style. New cables remain visible while connecting. This browser remembers the opacity across patches and reloads; sound and saved patch files are unaffected.
- Individual hardware finishes: walnut keyboard cheeks, a violet rubber-pad controller, coloured effects enclosures, ivory/chrome knobs, and a compact silver mixer with vertical faders. Module dimensions vary to suit the instrument.
- Keyboard offers **25, 37, 49 or 61 keys** in its Keys selector. Extra octaves widen the walnut-sided enclosure while keeping comfortable key spacing. Existing patches stay at 25 keys. Resizing releases held notes, retains the pitch cable, and moves only the keyboard if it needs room; Undo restores its size and position together. Swiping lights only the keys actually held, and a finger can keep its last note playing outside the keybed or while you work another instrument, until you lift it.
- Hardware-style knobs respond to vertical dragging, arrow keys, Home/End, and double-click reset. Hold Shift for finer dragging. Knobs, Mixer faders, sequencer steps and XY pads keep following a drag beyond their visible edges until release; XY positions and levels stay within their normal bounds.
- Eight editable sequencer steps with an independent **Step rate** selector: **1/4**, **1/8** (default), or **1/16**, synced to the project tempo. **Gate** sets how much of each step sounds. Tap to cycle through notes, or press and drag/swipe up to raise a note and down to lower it (including a rest at the bottom). Hold Shift for finer dragging. Arrow keys adjust a focused step; right-click inserts a rest.
- Tempo, root note, scale, time signature, master volume, mute, live waveform, and level meters. The **More → Studio settings** panel keeps all settings available on narrow screens.
- A compact, single-row toolbar and an on-demand module drawer leave the workspace at full width. The canvas stays clear of decorative slogans. **More** holds My patches, Recordings, examples and settings. Help lives at the bottom left, and offline/install information opens from the bottom-right status. Save and Export appear once: in the toolbar on wide screens, or in More when the toolbar buttons are hidden. The **Focus on workspace** button beside Undo hides the toolbar/footer; use it again to return.
- An effectively infinite workspace extends in every direction: move modules beyond the old rack edges, including left/up from the starting point. Hold a dragged module near a screen edge to keep travelling. **Arrow / Play / edit** lets you use several keys, knobs or other module controls together without triggering zoom. Pinch empty workspace to zoom around your fingers; drag empty workspace with one finger to pan. Choose **Hand / Pan / zoom** at the bottom left to drag or pinch anywhere, including over instruments, without changing their controls. Switching tools releases held touch controls. Trackpad/wheel scrolling and the Pan tool move the view; use Fit modules to view to find your patch again. With the workspace focused, arrow keys pan (Shift moves farther) and Home fits the patch. The zoom buttons, trackpad pinch, undo, and redo remain available. Pinch and trackpad zoom change only the workspace; gestures over the toolbar, drawer or dialogs keep the app controls at their normal size. Lists and dialogs still scroll normally. Keys and pads support multiple fingers without the long-press magnifier.
- Large-patch navigation moves instruments and cables together, while playback lights update independently. Small animated display and pattern regions use separate graphics layers during audio activity to reduce Safari’s full-rack compositing cost. The complete 38-module Neon chorus remains the performance reference; see [current performance work](docs/PROJECT_STATUS.md) for measured improvements and device checks.
- App labels resist text selection and touch callouts, including double taps and long presses on iPad/iPhone. Patch names and search fields retain normal text editing, selection, and paste.
- Undo and redo patch changes with the two arrow buttons beside workspace focus. **⌘/Ctrl Z** undoes; **⌘/Ctrl Shift Z** or **Ctrl Y** redoes. Drags and held adjustment keys undo in one step, including slow gestures. Unchanged controls leave history intact. History holds the latest 60 edits for the open patch; opening another patch or reloading starts fresh. Text fields retain normal text undo. Camera movement, live playing, recordings, and cable appearance stay outside patch history.
- Automatic browser saving for your own patches, temporary examples/demos until Save patch, optional Node file saving, a patch library with deletion, and validated JSON import/export.
- Record live output, play back saved takes, and download **WAV**, **MP3**, or the **original recording**. Recording captures the studio output, **not the microphone**.
- Install on an iPad/iPhone home screen, Android, or desktop and use the complete studio offline after its first download. The **offline status at the bottom right** shows readiness and installation steps.

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

Connected visits, returning to the app, and periodic checks while visible look for updates. When a complete release is downloaded, **Patchwork has an update** offers **Refresh now** or **Later**. Refresh works inside a home-screen app, saves your latest patch, and waits until playback is stopped and any recording has finished saving. Close other Patchwork windows before refreshing. **Later** keeps the current session; the **offline status at the bottom right** retains **Refresh now** and **Check for updates**. You can also close every Patchwork window and reopen to apply an update. The app never reloads a performance automatically.

Existing installs from before the refresh prompt need one full close-and-reopen cycle while connected to receive this feature. On iPad, close Patchwork from the app switcher and close any Safari tabs of the studio, then launch the home-screen icon again. Keep the studio in the foreground while performing: mobile operating systems can suspend background audio. Device storage can be cleared or evicted, so keep patch exports and recording downloads as backups. **bottom-right offline status → Protect device storage** requests additional protection where supported.

See [offline design and deployment](docs/OFFLINE.md) for lifecycle details, device testing, and Cloudflare hosting.

## Choose a starting point

Open **More → Example patches**, choose a patch, then press **Play**. Each card describes the sound and suggests something to change first. Opening an example stops playback; it never starts sound automatically. Examples, module demos and the first-visit starter stay temporary, even after editing or recording. The Demo label marks them. Choose **Save patch** (or **⌘/Ctrl S**) to keep the current version and enable autosaving for later edits. Leaving or reloading a temporary demo discards its edits and restores your last saved patch. Export still makes a portable copy without adding the demo to My patches.

| Patch            | Sound and approach                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sunday circuits  | Warm C-minor sequenced melody at 108 BPM, with filtering and delay                                                        |
| Pocket rhythm    | Drum groove at 108 BPM with a swappable kit, keyboard, and percussion pads                                                |
| Warehouse pulse  | Driving drums and a clipped F-minor bass line at 128 BPM                                                                  |
| Coastal static   | Ambient noise, slowly swept by an LFO through a filter and reverb                                                         |
| Tiny arcade      | Two independent sequencers playing square/triangle voices in G at 152 BPM                                                 |
| Copper currents  | 94 BPM D-pentatonic dub with a hybrid Drum kit, Merger and hands-on XY Effects                                            |
| Clockwork garden | A 23-module E-minor ensemble at 118 BPM with layered voices and rhythm/effect submixes                                    |
| Moving parts     | A 104 BPM melody and sampled claps demonstrating all four new modulation sources                                          |
| Neon chorus      | Pop in C major at 116 BPM: 38 modules, the original seventeen types, chord progression, hook, sampled claps and live keys |

**Moving parts** demonstrates all four new modulation modules in one playable 13-module patch. Envelope shapes a melodic Filter, Mod sequencer adds a small pitch contour, Sample & Hold changes the sampled-clap Filter, and XY controller opens the claps’ level (X) and changes their speed (Y). A saved original clap is included; no microphone access is required. Open it under **More → Example patches**.

**Neon chorus** is the largest example: 38 modules across five rows (rhythm, bass, chords, hook, live performance), using the original seventeen module types. Five quarter-note sequencers play a two-bar C–G–Am–F progression, bass and a layered hook. Two drum machines combine a kick/snare beat with percussion, noise hats and a Mic sampler preloaded with an original synthesized clap. Everything is included locally; no microphone recording or permission is needed. The burgundy **Switch** selects **1** echoed hook, **2** live Keyboard, **3** dry hook, or **4** hook/keyboard duet, while the backing keeps playing. Choose 2 or 4 to play the keys; use the Pad controller for fills. Fit to see the whole studio, then zoom into a row.

**Switch** is also available under **Add modules → Utility**. Connect up to four audio sources to IN 1–4 and route AUDIO OUT onward. Press a numbered ivory key to select one source, with a brief smooth changeover. An unpatched selection is silent. Tab and Enter/Space work on the keys; selection supports Undo/Redo and saves with the patch.

**Clockwork garden** is another large worked patch: two drum machines share a rhythm Mixer, three sequencers drive bass, lead, and answering bells, and one lead sequence fans out to two detuned oscillators. A second Mixer blends that pair; separate filters, LFOs, and eighth/dotted-eighth Delays shape the voices. One Merger gathers the melodies through Reverb, and another combines that bus with the dry rhythm. The four rows run top to bottom: rhythm, bass, layered lead, bells. Use Fit to see the whole patch, then zoom into a row. Try muting either lead Mixer fader to hear what each oscillator adds.

Coastal static is free-running: its LFO Rate controls the wash rather than the composition tempo. The other patches use the transport clock. Choose the same example again for a fresh original; copies you explicitly saved remain available in **More → My patches**. Returning visits restore the active saved patch without reopening the chooser.

## Play drums and keys

Use **More → Example patches → Pocket rhythm** for the connected performance example. Your saved patch stays in My patches. The instruments and Drum kit are also available separately in the module library.

- **Drum machine:** a 16-step, four-voice sequencer defaulting to kick, snare, clap, and closed hat. Connect a Drum kit to assign different sounds; the numbered voice labels follow your choices. Click switches to edit the rhythm; click a voice name to audition it. **Pattern on/off** mutes the sequencer without disabling live pad hits. Level, tone, and decay are configurable. Press Play to start the pattern at the composition tempo.
- **Keyboard:** 25, 37, 49 or 61 chromatic piano keys with octave and velocity controls. Wire **PITCH / GATE → Oscillator PITCH**, then route the oscillator's audio to an output (directly or through effects/mixer). Tap/hold keys or slide across them with a finger, mouse, or pen. Each finger follows its own key; moving outside the keybed holds that finger's last note until you lift, and moving back lets you change notes again. Focus the keys and use **A W S E D F T G Y H U J K O L P ;**. Enter/Space on a focused key plays a short note. Oscillator voices are monophonic: the last held note wins and releasing it returns to the previous held note. Keyboard notes are chromatic, independently of the sequencer's scale.
- **Pad controller:** choose **4, 8 or 16** rubber-style pads. Each numbered **PAD** socket fires only its matching pad, so you can connect different pads to different samplers, drums, Envelopes or Sample & Hold inputs. **ALL** sends every hit and preserves existing shared trigger cables. Route the receiving instruments’ audio to Output. The enclosure and bottom sockets resize together; if more room is needed, only the controller moves. Reducing the count unplugs removed outputs; one Undo restores the count, position and cables. Focus the grid to use the shortcuts printed on visible pads. The guide demo connects pad 1 to a kick and pad 2 to a separate bundled clap.

- **Drum kit:** a terracotta sound cartridge, included in fresh Pocket rhythm examples. Connect **KIT OUT → Drum machine KIT IN**. For each of voices **1–4**, choose any built-in percussion sound, **Imported sample**, or **Audio input**. The rhythm stays on the drum machine. Its first four pad triggers follow these assignments; the other twelve pads retain their printed sounds. Unplug KIT IN to restore the internal kit.
  - **Samples:** choose Imported sample, then Load audio. WAV, MP3, M4A/AAC, Ogg, WebM, and FLAC can be imported where the browser supports their codecs, up to **four seconds / 20 MB per file**. Imports decode in small chunks with duration and memory limits; unsupported codecs show a request to convert to PCM WAV. Files are limited to eight channels, 192 kHz, and 16 MiB of decoded float audio; convert unusually large multichannel clips to mono first. Samples become compact mono audio at 24 kHz and are embedded in the patch, so saves, exports, and offline playback include them. The patch sample budget is roughly sixteen seconds in total. Replace loads a different sound; × removes it. Switching sound modes keeps the sample for later.
  - **Other modules:** connect an audio output, such as Noise or Oscillator, to the matching **IN 1–IN 4**, then choose that numbered Audio input. For a **Mic sampler** connected directly or through Filter, Delay, Reverb, or XY Effects, each hit starts an independent playback of its saved, trimmed snippet—there is no need to press Play snippet or time it. Repeated hits overlap and each plays the full selected length. Sampler Speed/Level and Drum machine Tone/Level apply. Drum machine Decay fades the sample tail: **1× or higher** keeps its natural length; lower settings fade the tail earlier without cutting off its source. Changes affect new hits. Other sources such as Noise/Oscillator remain live inputs: each hit gates their current sound, with **Input decay × Drum machine Decay** setting the envelope length. Serial effect chains before the Drum kit process each triggered clip, retaining overlapping hits and effect tails. Mixer, Merger, and Switch inputs remain live audio. Empty inputs/samplers and unloaded sample slots are silent.
  - Click a numbered cartridge button to audition through its connected drum machine. Drum machine Level applies to every source; Decay shapes built-in/live envelopes and sampled tails. Tone tunes built-in sounds and recorded/imported samples, while ordinary live audio inputs retain their incoming pitch. One kit can feed several machines. Importing and reading the guide are silent.

Keys, pads, and drum audition work with the transport stopped. They wake the audio device for live playing and suspend it after a short tail when idle. Stop silences the instruments. Recording captures their routed audio along with the sequencer. Play/Record starts the transport; turn Pattern off to record only live playing.

Drum patterns repeat every sixteen sixteenth-notes (one 4/4 bar); melodic patterns repeat every eight steps at their selected rate. Each sequencer can run at a different rate. Live rate changes join the shared transport grid without restarting; a short already-queued segment may retain the previous timing. Older patches open at 1/8, preserving their sound. Both pattern types repeat independently of the time-signature display. No physical MIDI device support is included yet.

## Delete saved patches

Open **More → My patches**, choose **Delete** beside a patch, then confirm **Delete patch**. **Cancel** keeps it. The full patch name appears in the confirmation, and the open patch is labelled **Open now**.

Deleting the open patch stops playback, microphone capture and recording, then opens a fresh empty patch. A recording in progress finishes saving; saved takes and downloaded exports are kept. Deleting another patch leaves the current performance running. Patch deletion clears that patch’s undo history when it is open; export a backup first if you want to keep a copy.

Deletion works offline and survives reloads. Deleted IDs cannot be restored by a pending autosave or a stale server list. When using the optional local Node server, its matching file is also removed when the verified server is reachable; offline cleanup is retried on a later library visit. Public installs make no server requests. Example and module-demo templates remain available and open fresh copies.

## Understand the ports

**Help** at the bottom left explains every cable type with example connections. **OUT sends** and **IN receives**; the types must match.

| Port         | What it carries                                                | Example                                             |
| ------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| AUDIO        | The actual sound you hear and record                           | Oscillator → Filter → Output                        |
| PITCH / GATE | A note and its held/released state                             | Keyboard → Oscillator PITCH or Envelope NOTE / GATE |
| MOD          | Movement of a setting, rather than audible sound               | LFO MOD OUT → Filter MOD                            |
| TRIGGER      | A brief hit/restart event, including pad identity and velocity | Pad controller → Drum machine or Mic sampler        |
| KIT          | Four drum voice assignments and external input buses           | Drum kit → Drum machine KIT IN                      |

Each input takes one cable; an output can feed several inputs. Route audio to Output to hear it. For a focused lesson, open a module’s **?** guide and choose **Load demo patch**. Keyboard/Envelope/Reverb demos use live keys; the Mic sampler demo includes a clap played from pads. Other demos explain whether to press Play or use pads. No demo requests microphone access automatically.

## Read the instrument displays

Displays serve a specific purpose rather than appearing on every module. **LFO** previews Rate/Depth while stopped and shows measured modulation during playback. **Filter** shows a response curve that follows Cutoff, Resonance and mode, plus its MOD input while playing. You can adjust either while stopped without starting audio. **Delay** previews echo spacing, feedback and mix alongside its millisecond readout. **Noise** and **Reverb** are compact single-dial boxes with no screen or blank display-shaped inset.

## Modulate a sound

The LFO is joined by four control instruments, each with a guide and a live screen showing measured MOD output:

- **Envelope:** Attack/hold/Release sweeps. Keyboard or Step sequencer **PITCH → NOTE / GATE** holds the peak until note release. Pad controller **PAD 1 (or ALL) → TRIGGER IN** or **Trigger envelope** makes a one-shot sweep. Velocity sets the peak.
- **Mod sequencer:** eight signed fader values repeat at **1/4**, **1/8**, or **1/16** on the project tempo. **Depth** sets amount; **Glide** smooths transitions. It sends control values rather than notes, leaving Step sequencer behaviour unchanged.
- **Sample & Hold:** random held values at the selected step rate. A patched **TRIGGER IN** replaces its transport clock with pad hits; **New random value** also works while stopped. This is control randomness, not recorded audio.
- **XY controller:** independent **X MOD** and **Y MOD** outputs, with shared Depth. Drag the pad, use arrow keys (Shift for fine), or use the axis sliders. **Centre/Home** resets both axes; positions save with the patch. It sends control signals, while the separate **XY Effects** module still processes audio.

All five sources can drive **Filter MOD**, **Oscillator PITCH MOD**, or **Mic sampler SPEED MOD / LEVEL MOD**. New source Depth at 100% spans ±1500 Hz at Filter, or up to ±one octave at pitch/speed inputs. Existing LFO Depth retains its original Hz scale and existing filter patches retain their sound. Use small depths for vibrato. Pitch/speed receivers clamp their range even if a control signal is too large.

**LEVEL MOD** opens 0–100% of the sampler’s Level; zero or negative signals mute it, so an Envelope can open from silence. With no cable, Level works as before. **SPEED MOD** changes pitch and duration while the selected frames play, bounded to half/double the selected base speed. Both signals also reach independent Drum kit sample hits, including through serial effects; dry **Play snippet** preview continues to bypass patch routing and MOD cables. With live speed modulation the player ends at the selected frame boundary and reserves the slowest possible duration for its fade/idle safety limit.

Control cables cannot enter audio, note, or trigger sockets. Fan-out is supported; each input still accepts one cable and feedback loops remain rejected. Live screens read the audio engine and never set its timing. Reduced-motion mode uses a stationary signal trace, and idle screens stop refreshing.

## Record a sound from your microphone

Add **Mic sampler** from **Sources**. Press **Record mic**, allow microphone access, and speak, clap, or capture a found sound. Press **Finish** to keep it, or let the four-second limit finish automatically. **Cancel capture** discards the attempt. A replacement keeps the previous snippet until the new recording succeeds. Microphone access needs HTTPS or localhost and browser permission; no permission is requested by adding a module, opening a guide, or recording the studio output. The mic is never monitored through the speakers.

Press **Play snippet** to hear the selected recording directly on every press, with studio playback stopped or running—even without cables or with Output muted. Previewing leaves the main Play button unchanged, so you can start the project while listening. This dry preview uses the sampler’s trim, Speed, and Level, bypasses effects and master volume, and stays out of studio recordings. To play the snippet through your patch, connect **AUDIO OUT** to an effect, Mixer, Merger, or Output and connect Pad controller **ALL → TRIGGER IN**: every pad restarts the same snippet, or use a numbered **PAD** output to play it from just one pad, with pad velocity controlling the hit volume. **Level** controls volume; **Speed** changes pitch and length together on the next hit (0.5× is an octave lower, 2× an octave higher). Top-bar Play does not automatically trigger snippets.

**Start** and **End** trim sliders choose the part to keep; the waveform dims the discarded ends and shows the selected duration. Use touch/mouse or arrow keys, Home, and End. Changes apply on the next button/pad hit. The original recording stays in the patch; **Reset trim** restores it, and Undo/Redo works for trim edits. A successful replacement resets the trim; failed or cancelled recordings keep the previous sound and selection.

To sequence a snippet, connect **Mic sampler AUDIO OUT → Drum kit IN 1–IN 4**, select the corresponding **Audio input** voice, then connect **KIT OUT → Drum machine KIT IN**. You can insert Filter, Delay, Reverb, or XY Effects between the sampler and kit, including a chain of effects. Each drum hit plays the saved selection independently, with overlapping tails. You do not need to press Play snippet or download/reimport a WAV.

**Download WAV** saves only the selected section at its original speed and level for use elsewhere, including **Drum kit → Imported sample → Load audio** for sequenced playback. **Clear** removes the clip; Undo restores it. Capture ends and releases the microphone on Finish, Cancel, Stop, module removal, patch switching, or hiding the app. Refresh waits for capture and processing to finish. Headphones keep a playing backing track out of the recording.

Snippets use the same compact mono 24 kHz PCM format and shared patch sample budget as Drum kit samples (about sixteen seconds in total). They are embedded in browser saves and patch exports, and play offline without microphone access. New capture works offline where device/browser permissions permit it. No audio is uploaded to a service; the optional local Node save includes it in the patch just like imported samples.

## Merge several sounds

Add **Merger** from **Utility** in the module library. Connect up to four instrument or effect audio outputs to **IN 1–IN 4**, then connect **SUM OUT → Output AUDIO IN** (or another effect). Each **Input 1–4** knob independently controls its sound from silent to 100%; **Sum level** controls the combined volume and starts at 50%. Input levels start at 100%, including when opening older patches, so existing mixes keep their sound. Empty inputs are silent; the amber indicators show attached cables. Each knob sits directly above its matching socket, including Sum level above SUM OUT. The compact teal metal enclosure, ivory input dials and copper Sum dial give it its own hardware identity.

For more than four sources, connect one Merger's SUM OUT to another Merger input. Adding sources adds their levels, so balance them with the individual input knobs and lower Sum level if needed; use **Mixer** for **2–8 inputs** when you prefer faders. Choose its input count before connecting extra sources. Reducing the count unplugs removed input cables; Undo restores them, and the fader settings are kept. Pitch, modulation, and trigger signals retain their existing socket types: route a Keyboard through an Oscillator, or pads through a Drum machine, before merging their audio. The Merger's **?** guide includes a four-input example with an echo return.

## Switch between parts

Connect up to four sound paths to **Switch IN 1–4**, then send its **AUDIO OUT** to Output. **Schedule…** lets you choose which input takes over at the start of specific bars: for example, input 1 at bar 1 and input 2 at bar 5. Keep **Repeat schedule** on and choose 8 bars to alternate those four-bar parts. With Repeat off, the final input stays selected. Schedules support up to 16 cues at bars 1–128, including a bar 1 cue for the starting sound.

**Use schedule** enables Auto without starting playback. Press Play to run it; Stop clears queued changes, and the next Play starts at bar 1. The lights follow the routed input. Tap a numbered key to take manual control; **Auto** rejoins the schedule at the current bar. Cue edits and manual choices support Undo/Redo, while automatic changes leave the saved manual selection and history alone. Switching follows project tempo and time signature and keeps upstream instruments/loops running. Existing patches stay in Manual mode. The guide demo alternates a bar of drums and a bar of melody.

## Blend effects with a touch

Add **XY Effects** from **Effects**. Connect an instrument's AUDIO OUT → XY Effects AUDIO IN, then XY Effects AUDIO OUT → Output AUDIO IN. Tap or drag the point around the four-quadrant pad. The centre is clean; moving towards an edge brings in the surrounding corners, and a corner isolates its effect. Release to keep the position. **Mix** sets the maximum processed amount; **Centre** restores clean audio.

The defaults are **Filter** (top left), **Echo** (top right), **Grit** (bottom left), and **Space** (bottom right). Each corner's selector can choose any of those, **Thin** (high-pass), or **Clean**. Repeated choices are allowed. Filter softens the source, Echo repeats it, Grit adds soft distortion, and Space adds reverb. Corner reassignment and movement crossfade smoothly while playing. All choices, X/Y position, and Mix save/export with the patch and work offline.

Focus the pad and use arrow keys to move; hold Shift for fine adjustments, or press Home to centre. The labelled X and Y sliders offer separate axis controls. Reading its **?** field guide is silent. The copper enclosure and recessed glass pad give it its own hardware identity.

## Saving and privacy

Temporary demos never write the browser library or replace its active saved-patch pointer during autosave, patch switches, backgrounding or page close. Save patch makes the open demo a regular saved patch; imports and New empty patch also use normal autosaving. Existing saved demo copies are kept. Recording takes stay independent of this choice. An in-app update refresh asks you to save the temporary demo or open a saved patch first.

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

Production releases use **Cloudflare Workers Builds** connected to `james-lane/modular-music-maker`, with `main` as the production branch. Once that one-time connection is enabled, each commit pushed to `main` is checked, built and deployed automatically. A local commit alone does not trigger Cloudflare; push reviewed work with `git push origin main`. Review branches can publish separate public test links through `npx wrangler preview`, after the same `npm run build:ci` validation; they do not publish production releases.

The build command is `npm run build:ci`; the deploy command is `npx wrangler deploy`, from the repository root. The CI build restores full Git history if the clone is shallow, requires a clean checkout, then runs formatting, strict types, all tests and the production build. Failed checks prevent publication. `.node-version` selects Node 22. See [setup and verification](docs/OFFLINE.md#automatic-deployment) for the one-time GitHub connection and build settings.

For an explicit manual recovery deployment, use `npm ci`, `npx wrangler login` if needed, `npm run check`, `npm run format:check`, then `npm run deploy`. That command rebuilds before uploading; `npx wrangler deploy --dry-run` validates a build without publishing. Credentials stay outside the repository. Existing open sessions retain their cached release until the user chooses **Refresh now** from an idle, sole window, or closes all Patchwork windows and reopens.

## Commands

| Command                | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Frontend and Node server with automatic reload      |
| `npm run build`        | TypeScript check and production frontend build      |
| `npm run build:ci`     | Restore full Git history, validate and build for CI |
| `npm run preview`      | Serve the production/offline app at port 4173       |
| `npm run deploy`       | Build and publish to patchwork.jameslane.dev        |
| `npm start`            | Serve `dist/` and the local file API                |
| `npm test`             | Domain validation and real HTTP/persistence tests   |
| `npm run typecheck`    | Strict TypeScript checking                          |
| `npm run check`        | TypeScript, tests, and production build             |
| `npm run format`       | Format tracked source and documentation             |
| `npm run format:check` | Check formatting without editing                    |

## Configuration and architecture

- The bottom-right badge shows the package version plus Git commit number, such as **v0.1.0+20**. Its accessible label/hover text includes the commit hash; **\*** marks uncommitted changes. Every commit (including documentation-only or empty commits) automatically gets a distinct full version on the next build, without version-bump commits or local Git hooks. A running development server also refreshes the badge after commits and checkouts. `package.json` owns the release series; `dist/version.json` records the exact build identity and is cached with the offline app. Every `npm run build` first restores full Git history if the checkout is shallow, retaining the requested branch/commit. If history cannot be fetched, the build fails with recovery guidance; source archives are explicitly labelled `+source`. Workers Builds restores shallow checkout history before validating and publishing; installed sessions show their own running release until updated.
- `index.html`: canonical production address, Open Graph, and Twitter/X large-image sharing cards. The locally bundled 1200×630 preview in `public/social/` shows the real studio interface. See [sharing previews](docs/SOCIAL_PREVIEWS.md) for refresh and verification steps.
- `src/config.ts`: application limits, tempo range, workspace navigation, autosave, scheduler timing, scales, and root notes.
- `src/domain/modules.ts`: module catalog, defaults, parameter limits, ports, dimensions, and accent colors. `src/domain/module-guides.ts` contains the guides and derives compatibility from the catalog sockets.
- `src/domain/examples.ts`: example patch catalog, sound recipes, artwork colours, and starter tips. Recipes use the ordinary module defaults and override only the settings that define each sound.
- `src/styles.css`: shared theme tokens, panel mechanics, knobs, and sockets. `src/components/module-finishes.css` defines individual materials, colours, knob finishes, and enclosure details; `instruments.css` defines specialized performance layouts.
- `server/index.ts`: listener; `PORT` and `PATCHWORK_DATA_DIR` environment variables configure the server. See `.env.example`. Set these in your shell; `.env` is documentation only and is not automatically loaded.
- `.openai/hosting.json`: reserved private Sites preview configuration; no Sites version has been published. It does not affect local development or the Cloudflare deployment.

Start with [the architecture](docs/ARCHITECTURE.md), [the module guide](docs/ADDING_MODULES.md), and [the project status](docs/PROJECT_STATUS.md). The 21 guide demos are also development fixtures: `createModuleDemo` in `src/domain/module-demos.ts` is used by the UI and `tests/module-demos.test.ts`. Reuse these factories for browser/audio checks, including the declared live gesture, instead of inventing parallel test patches. See [adding modules](docs/ADDING_MODULES.md) for the demo checklist. Future agent sessions should read [AGENTS.md](AGENTS.md) before editing.

## Deliberate first-version boundaries

This is a local-first creative tool. There is no account system, cloud patch database, collaboration, MIDI, sample upload, offline render, or third-party plugin loading yet. The sequencer always has eight steps; the time signature changes beat grouping, while its eight-step pattern continues independently. Cable feedback cycles are rejected; Delay owns a bounded internal feedback loop. Audio is scheduled on the Web Audio clock, but background browser throttling can interrupt playback.

The Node API has no authentication and should remain on loopback. Add identity, ownership, request protection, and a deployment storage adapter before exposing it publicly. Recording/export avoids needing a server-side audio encoder.
