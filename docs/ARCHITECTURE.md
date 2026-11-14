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

| Area                                    | Responsibility                                                      |
| --------------------------------------- | ------------------------------------------------------------------- |
| `src/config.ts`                         | Shared product defaults, limits, scale tables                       |
| `src/domain/types.ts`                   | Serializable model and catalog interfaces                           |
| `src/domain/module-guides.ts`           | Teaching copy, example wiring, and derived socket compatibility     |
| `src/components/ModuleHelpDialog.tsx`   | Library field-guide modal with related-guide navigation             |
| `src/domain/modules.ts`                 | Declarative module registry                                         |
| `src/domain/project.ts`                 | Starter patch, module creation, connection invariants, pitch math   |
| `src/domain/validation.ts`              | Shared Zod validation for every data boundary                       |
| `src/domain/storage.ts`                 | Browser patch library, optional server sync, downloads              |
| `src/audio/factories.ts`                | Audio node creation, parameter updates, disposal                    |
| `src/audio/engine.ts`                   | Context lifecycle, graph topology, note scheduling, analysis        |
| `src/audio/drums.ts`                    | Synthesized kit recipes, scheduled one-shot ownership and cleanup   |
| `src/audio/live.ts`                     | Ephemeral keyboard/pad gesture contract                             |
| `src/domain/instruments.ts`             | Drum identities/patterns, shortcuts and chromatic pitch helpers     |
| `src/components/KeyboardPanel.tsx`      | Piano key gestures, focus and note release                          |
| `src/components/PadControllerPanel.tsx` | Live pad layout, keyboard shortcuts and feedback                    |
| `src/components/DrumMachinePanel.tsx`   | Drum pattern switches and voice audition                            |
| `src/audio/recordings.ts`               | Recording MIME selection and IndexedDB blob storage                 |
| `src/hooks/useStudio.ts`                | Patch edits, grouped undo/redo, autosave                            |
| `src/hooks/useAudio.ts`                 | Transport, recording lifecycle, React/audio bridge                  |
| `src/components/StudioHeader.tsx`       | Studio navigation and dialog entry points                           |
| `src/components/TransportBar.tsx`       | Playback, composition settings, save/export controls                |
| `src/components/Workspace.tsx`          | Canvas geometry, drag preview, sockets, SVG cables, zoom/pan        |
| `src/components/ModuleCard.tsx`         | Registry-driven panel and special instrument controls               |
| `src/components/MixerPanel.tsx`         | Vertical channel faders using the existing mixer gain parameters    |
| `src/components/module-finishes.css`    | Individual enclosure palettes, materials, knob finishes, and faders |
| `src/components/Knob.tsx`               | Logarithmic/linear parameter editing and keyboard controls          |
| `src/components/Scope.tsx`              | Animation-frame waveform and RMS display                            |
| `server/app.ts`                         | Local Express API and production static serving                     |
| `server/repository.ts`                  | Validated atomic filesystem persistence                             |

## Module field guides

Each library item has an accessible question-mark button alongside Add. `domain/module-guides.ts` stores a required guide for every module type: overview, setup steps, numeric control descriptions, special controls, a tip, and a worked example with actual module/port endpoints. `compatiblePorts()` derives possible partners directly from registry socket directions and signal types, excluding the same module type. These are capability matches; the normal workspace rules still reject occupied inputs and feedback loops.

`ModuleHelpDialog` groups equivalent sockets (such as Mixer IN A/IN B), displays compatible modules, and lets the user explore their guides in the same native dialog with a local Back stack. Reading or navigating help does not edit the patch, add modules, change playback, or enter undo history. The shared Modal uses an accessible title, native focus trapping and Escape/backdrop dismissal. Related-guide navigation resets scroll/focus within the modal, and closing returns focus to the original library button. The mobile library stays open behind the guide so it is available on dismissal.

The guide layout lives in `components/module-help.css`. Instructions and connections are text/semantic HTML rather than an audio preview. Tests validate guide control coverage, signal-specific compatibility, and every worked example against the real patch validator.

## Patch format and validation

`Project.version` is currently `1`. A patch contains its UUID, title, update time, tempo, root/scale, time signature, master volume, positioned modules, and directed cables. A module stores its registry type, UUID, position, parameters, optional eight scale degrees, and an optional `drumPattern` map. The new drum field is an additive v1 extension: old patches do not need migration. Drum machines must contain exactly the four named lanes of sixteen booleans; other module types cannot store a drum pattern. `-1` is a rest. Degrees `0…13` span two octaves of a seven-note scale; pentatonic degrees use its five-note table.

No AudioContext, AudioNode, React state, object URL, or recording blob is serialized into a patch. `parseProject` checks UUIDs, bounds, module types, parameter ranges/enums, unique IDs, known sockets, signal compatibility, input occupancy, instance limits, and acyclic routing. Unknown top-level/module/cable fields and unknown parameters are rejected. Imported patches receive a fresh project ID to preserve existing saved work.

The current model allows fan-out from an output, one cable per input, and at most one Output module. Mixer has separate A/B inputs. Empty patches may contain no output and therefore produce no audible signal. Removing a module removes its cables in the same edit.

## Audio lifecycle

`useAudio` owns exactly one `AudioEngine`. A user Play/Record or live instrument gesture creates and resumes the context. Stop suspends it. Live gestures can resume the audio device without starting the transport; after the final held key or hit, an idle timer allows a configured three-second effect tail, then suspends it. The UI distinguishes transport playback from an active audio device. Unmount stops recording, disconnects owned nodes, and closes the context. Engine disposal detaches references and resets graph identity synchronously before closing the old context asynchronously, allowing safe reuse during development Fast Refresh. Hook transport state is reconciled when effects restart. StrictMode double mounting is intentionally not used around live context ownership.

Topology is identified by module IDs/types and cables. Moving panels and editing parameters does **not** recreate the graph. A topology edit disposes the previous runtime graph and creates a new one. This simple first implementation can produce a transient on rewiring; future versions may crossfade graph replacements.

Each factory returns named input/output endpoints, an `update` function, a `dispose` function, and optionally a pitched voice. Audio/control cables connect native AudioNode or AudioParam endpoints. Pitch cables are event routes from sequencers or live keyboards to oscillator voices. Trigger cables route pad sound/velocity events to drum runtimes; neither event type becomes a native AudioNode connection. An unsequenced oscillator sustains the patch root note; a sequenced oscillator follows its pitch cable and gate envelope.

The scheduler wakes every 25 ms and queues notes/hits 120 ms ahead using `AudioContext.currentTime`. Its shared tick is now one sixteenth-note. Drum machines advance every tick; melodic sequencers advance every second tick, preserving their original eighth-note timing. Visual step updates use separate timers aligned to the audio clock. Both pattern lengths repeat independently of the displayed time signature; 3/4 and 6/8 currently share three quarter-note beat groups. Tempo edits affect the next scheduling window, so a short already-queued segment may retain the old tempo.

Signal chain: Output module gain → dynamics compressor → master gain → analyser → speakers and recording destination. Filter/resonance and delay feedback have bounded parameters. The compressor softens peaks; this is not a mastering limiter. Reverb builds a local random decaying impulse, so recreating the graph produces a slightly different ambience. Noise is also generated locally.

## Performance instruments

`LiveControls` sends note-on/off and drum/pad hits without mutating serializable project data. Held keys, lit pads, AudioNodes, and live velocity events never enter undo history or autosave. The hook guards asynchronous audio activation: releasing a key before `resume()` completes cancels the pending note, and Stop invalidates pending live gestures.

Keyboard holds have last-note priority per oscillator. Releasing the last note silences the gain envelope; releasing a newer note restores a previously held one. Pointer cancellation, focus loss, visibility changes, window blur, Stop, topology changes, and unmount provide cleanup paths. The keyboard octave and the oscillator octave add together; oscillator detune still applies. Physical MIDI and polyphonic oscillator voices are not implemented.

`audio/drums.ts` builds sixteen kit sounds from short oscillators and filtered noise using editable recipes. Each triggered hit owns its nodes until all its sources end. Stop/disposal disconnects and stops outstanding sources, including scheduled hits. A closed hat chokes a ringing open hat; a configurable overlap limit bounds rapid triggering. Drum level/tone/decay affect sequenced and live hits. The four pattern lanes remain editable independently of the sixteen pad sound mappings; disabling Pattern stops scheduled hits but accepts live triggers.

The _Pocket rhythm_ preset connects Keyboard → Oscillator, Pad controller → Drum machine, Drum machine/Oscillator → Mixer → Output. Its separate menu action creates a new saved project and leaves the original starter available.

## Recording and persistence

MediaRecorder receives the engine's MediaStreamAudioDestinationNode stream, so no microphone/device permission is needed. MIME format is negotiated per browser. Chunks are assembled into a Blob and saved in IndexedDB after Stop recording. If storage fails, a direct download is offered automatically. Object URLs used for previews/downloads are revoked. Ten minutes is the configurable take limit. Downloads retain the supported native recording format; WAV export is future work.

Patches autosave to browser localStorage after 650 ms and flush on pagehide. A manual Save also calls the Node API; the confirmation distinguishes successful server saving from browser-only saving. The patch library merges local and server copies by ID/update time. Browser quota failure remains visible. Recordings and patches are origin-specific and are not synchronized between local/hosted previews.

Node persists each validated UUID to `.data/<id>.json` using a unique temporary file and atomic rename. A corrupt stored patch is skipped during listing. This is a single-user local adapter, not a database or multi-user synchronization system. Request JSON is bounded to 256 KB. The service listens on `127.0.0.1`; it is not ready for unauthenticated public access.

## Canvas and styling invariants

Modules use registry dimensions in an 1800×1200 stage. Zoom scales the stage and a matching scroll spacer. Dragging previews local coordinates and commits one history entry on release. Drop positions snap to a configurable grid and stay within bounds. Cabling uses registry socket positions and a CSS footer inset; update `socketPosition()` if socket geometry changes.

The visual direction is a collection of distinct physical instruments, as explicitly requested by the user. Surfaces may differ in colour, material, size, silhouette, and controls. Enclosures include walnut-trimmed charcoal, violet polymer, ochre/green/blue/plum enamel, graphite, aged cream, and brushed aluminium. Instrument surfaces use CSS gradients, layered borders/shadows, fixed tick rings, rotating knob markers, metallic socket rings, and panel screws. SVG traces and cables avoid image assets. Actual waveform/level displays read the analyser. Performance layouts live in `components/instruments.css`; module finish palettes and material details live in `components/module-finishes.css`. Shared panel/knob mechanics read inheritable CSS custom properties declared on `.module-panel` in `styles.css`. The mixer has real vertical native range inputs, with channel values and persistence identical to the original knobs. Selected utility/effect widths are smaller, so old saved positions remain valid. Painted rails and decorative wood cheeks do not change the structural border box; cable math remains unchanged. Wide performance modules use registry dimensions like every other module. New modules added from the library are scrolled into view. Keep the hardware feel for modules; keep application chrome restrained.
