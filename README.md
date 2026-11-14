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

- A searchable module library with nine working modules: step sequencer, oscillator, noise, LFO, filter, delay, reverb, mixer, and output.
- Drag modules from the library, or add them using the **+** buttons. Move panels by dragging their headers.
- Click an output socket, then a matching input socket to connect them. Audio, pitch, and modulation are separate signal types. Click a connected input to reroute its cable; double-click a cable to unplug it.
- Hardware-style knobs respond to vertical dragging, arrow keys, Home/End, and double-click reset. Hold Shift for finer dragging.
- Eight editable sequencer steps. Click to advance the scale degree, right-click to insert a rest.
- Tempo, root note, scale, time signature, master volume, mute, live waveform, and level meters. The **More → Composition settings** panel keeps all settings available on narrow screens.
- Zoom, pan, fit-to-view, undo, redo, and a responsive module drawer on small screens.
- Automatic browser patch saving, manual Node file saving, a patch library, and validated JSON import/export.
- Record live output, play back saved takes, and download audio files. Recording captures the studio output, **not the microphone**.

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
- `src/domain/modules.ts`: module catalog, defaults, parameter limits, ports, dimensions, and accent colors.
- `src/styles.css`: theme tokens and tactile instrument styling.
- `server/index.ts`: listener; `PORT` and `PATCHWORK_DATA_DIR` environment variables configure the server. See `.env.example`. Set these in your shell; `.env` is documentation only and is not automatically loaded.
- `.openai/hosting.json`: reserved private Sites preview configuration; no hosted version has been published. It does not affect local development.

Start with [the architecture](docs/ARCHITECTURE.md), [the module guide](docs/ADDING_MODULES.md), and [the project status](docs/PROJECT_STATUS.md). Future agent sessions should read [AGENTS.md](AGENTS.md) before editing.

## Deliberate first-version boundaries

This is a local-first creative tool. There is no account system, cloud patch database, collaboration, MIDI, sample upload, offline render, or third-party plugin loading yet. The sequencer always has eight steps; the time signature changes beat grouping, while its eight-step pattern continues independently. Cable feedback cycles are rejected; Delay owns a bounded internal feedback loop. Audio is scheduled on the Web Audio clock, but background browser throttling can interrupt playback.

The Node API has no authentication and should remain on loopback. Add identity, ownership, request protection, and a deployment storage adapter before exposing it publicly. Recording/export avoids needing a server-side audio encoder.
