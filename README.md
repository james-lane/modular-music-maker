# Patchwork

A modular music studio for the browser, built with TypeScript, React, Vite, and a Node.js/Express server. Inspired by a physical modular synthesizer: add instruments, turn knobs, and connect sockets with patch cables.

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

Open **http://127.0.0.1:3001**. The server binds to loopback by default. No accounts or external services are needed to make music.

## What works

- A searchable module library with thirteen working modules: drum machine, keyboard, pad controller, step sequencer, oscillator, noise, LFO, filter, delay, reverb, mixer, merger, and output.
- Five contrasting example patches in **Examples** (also available under **More → Example patches**). The chooser opens on a first visit. Each example opens an editable copy and keeps your current work in My patches.
- Each module in the library has a **?** help button. Its guide explains setup and controls, shows compatible sockets/modules, and provides a worked patch example. Select a compatible module to explore its guide, then use Back to return.
- Drag modules from the library, or add them using the **+** buttons. Move panels by dragging their headers.
- Click an output socket, then a matching input socket to connect them. Audio, pitch, modulation, and trigger are separate signal types. Click a connected input to reroute its cable; double-click a cable to unplug it.
- Choose **More → Studio settings → Patch cable style → Braided module colours** to weave together both connected modules' accent colours, with matching plugs at each end. **Classic colours** remains the default. The choice is remembered in this browser across patches and reloads.
- Individual hardware finishes: walnut keyboard cheeks, a violet rubber-pad controller, coloured effects enclosures, ivory/chrome knobs, and a compact silver mixer with vertical faders. Module dimensions vary to suit the instrument.
- Hardware-style knobs respond to vertical dragging, arrow keys, Home/End, and double-click reset. Hold Shift for finer dragging.
- Eight editable sequencer steps. Click to advance the scale degree, right-click to insert a rest.
- Tempo, root note, scale, time signature, master volume, mute, live waveform, and level meters. The **More → Studio settings** panel keeps all settings available on narrow screens.
- Zoom, pan, fit-to-view, undo, redo, and a responsive module drawer on small screens.
- Automatic browser patch saving, manual Node file saving, a patch library, and validated JSON import/export.
- Record live output, play back saved takes, and download audio files. Recording captures the studio output, **not the microphone**.

## Choose a starting point

Open **Examples**, choose a patch, then press **Play**. Each card describes the sound and suggests something to change first. Opening an example stops playback; it never starts sound automatically.

| Patch           | Sound and approach                                                        |
| --------------- | ------------------------------------------------------------------------- |
| Sunday circuits | Warm C-minor sequenced melody at 108 BPM, with filtering and delay        |
| Pocket rhythm   | Drum groove at 108 BPM with a live keyboard and sixteen percussion pads   |
| Warehouse pulse | Driving drums and a clipped F-minor bass line at 128 BPM                  |
| Coastal static  | Ambient noise, slowly swept by an LFO through a filter and reverb         |
| Tiny arcade     | Two independent sequencers playing square/triangle voices in G at 152 BPM |

Coastal static is free-running: its LFO Rate controls the wash rather than the composition tempo. The other patches use the transport clock. Choose the same example again for a fresh original; your edited copies remain available in **My patches**. Returning visits restore the active saved patch without reopening the chooser.

## Play drums and keys

Use **Examples → Pocket rhythm** for the connected performance example. Your current patch stays in My patches. The three instruments are also available separately in the module library.

- **Drum machine:** a 16-step, four-lane sequencer for kick, snare, clap, and closed hat. Click switches to edit the rhythm; click a voice name to audition it. **Pattern on/off** mutes the sequencer without disabling live pad hits. Level, tone, and decay are configurable. Press Play to start the pattern at the composition tempo.
- **Keyboard:** 25 chromatic piano keys with octave and velocity controls. Wire **PITCH / GATE → Oscillator PITCH**, then route the oscillator's audio to an output (directly or through effects/mixer). Hold keys with the pointer/touch, or focus the keys and use **A W S E D F T G Y H U J K O L P ;**. Enter/Space on a focused key plays a short note. Oscillator voices are monophonic: the last held note wins and releasing it returns to the previous held note. Keyboard notes are chromatic, independently of the sequencer's scale.
- **Pad controller:** sixteen rubber-style pads mapped to kick, snare, clap, hats, toms, rim shot, shaker, crash, ride, cowbell, tambourine, claves, and congas. Wire **TRIGGER OUT → Drum machine TRIGGER IN**, then route the drum machine's **AUDIO OUT**. Focus the pads to use **1 2 3 4 / Q W E R / A S D F / Z X C V**.

Keys, pads, and drum audition work with the transport stopped. They wake the audio device for live playing and suspend it after a short tail when idle. Stop silences the instruments. Recording captures their routed audio along with the sequencer. Play/Record starts the transport; turn Pattern off to record only live playing.

Drum patterns repeat every sixteen sixteenth-notes (one 4/4 bar); melodic patterns retain their eight eighth-notes. Both repeat independently of the time-signature display. No physical MIDI device support is included yet.

## Merge several sounds

Add **Merger** from **Utility** in the module library. Connect up to four instrument or effect audio outputs to **IN 1–IN 4**, then connect **SUM OUT → Output AUDIO IN** (or another effect). Its **Sum level** knob controls the combined volume and starts at 50%. Empty inputs are silent; the amber indicators show attached cables. The teal metal enclosure and ivory dial give it its own hardware identity.

For more than four sources, connect one Merger's SUM OUT to another Merger input. Adding sources adds their levels, so balance them using their own controls; use the two-channel **Mixer** when you want separate faders. Pitch, modulation, and trigger signals retain their existing socket types: route a Keyboard through an Oscillator, or pads through a Drum machine, before merging their audio. The Merger's **?** guide includes a four-input example with an echo return.

## Saving and privacy

| Item       | Storage                                                                                                               | Portable backup                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Patches    | Browser localStorage automatically; local Node `.data/*.json` when **Save patch** is pressed and the API is available | **Export** downloads `.patchwork.json` |
| Recordings | Browser IndexedDB                                                                                                     | **Recordings → Download**              |

Browser data belongs to the current origin and browser profile. The local preview and a hosted website have separate libraries. Clearing site data removes browser saves. Export patches and download recordings you want to keep.

The frontend can also be hosted as static files from `dist/`; it retains browser saving and recording. The optional Node file API is only available when running the Node server. Static hosting does not run Node. Recording format is selected from the browser's supported WebM/Opus, Ogg/Opus, or MP4 formats. Takes are limited to 10 minutes by a configurable default.

## Commands

| Command                | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Frontend and Node server with automatic reload    |
| `npm run build`        | TypeScript check and production frontend build    |
| `npm start`            | Serve `dist/` and the local file API              |
| `npm test`             | Domain validation and real HTTP/persistence tests |
| `npm run typecheck`    | Strict TypeScript checking                        |
| `npm run check`        | TypeScript, tests, and production build           |
| `npm run format`       | Format tracked source and documentation           |
| `npm run format:check` | Check formatting without editing                  |

## Configuration and architecture

- `src/config.ts`: application limits, tempo range, canvas size, autosave, scheduler timing, scales, and root notes.
- `src/domain/modules.ts`: module catalog, defaults, parameter limits, ports, dimensions, and accent colors. `src/domain/module-guides.ts` contains the guides and derives compatibility from the catalog sockets.
- `src/domain/examples.ts`: example patch catalog, sound recipes, artwork colours, and starter tips. Recipes use the ordinary module defaults and override only the settings that define each sound.
- `src/styles.css`: shared theme tokens, panel mechanics, knobs, and sockets. `src/components/module-finishes.css` defines individual materials, colours, knob finishes, and enclosure details; `instruments.css` defines specialized performance layouts.
- `server/index.ts`: listener; `PORT` and `PATCHWORK_DATA_DIR` environment variables configure the server. See `.env.example`. Set these in your shell; `.env` is documentation only and is not automatically loaded.
- `.openai/hosting.json`: reserved private Sites preview configuration; no hosted version has been published. It does not affect local development.

Start with [the architecture](docs/ARCHITECTURE.md), [the module guide](docs/ADDING_MODULES.md), and [the project status](docs/PROJECT_STATUS.md). Future agent sessions should read [AGENTS.md](AGENTS.md) before editing.

## Deliberate first-version boundaries

This is a local-first creative tool. There is no account system, cloud patch database, collaboration, MIDI, sample upload, offline render, or third-party plugin loading yet. The sequencer always has eight steps; the time signature changes beat grouping, while its eight-step pattern continues independently. Cable feedback cycles are rejected; Delay owns a bounded internal feedback loop. Audio is scheduled on the Web Audio clock, but background browser throttling can interrupt playback.

The Node API has no authentication and should remain on loopback. Add identity, ownership, request protection, and a deployment storage adapter before exposing it publicly. Recording/export avoids needing a server-side audio encoder.
