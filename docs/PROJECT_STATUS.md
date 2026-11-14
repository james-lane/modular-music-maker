# Project status

Last updated: **14 November 2026**.

## Implemented foundation

Patchwork v0.1 is a TypeScript/React/Vite frontend with an Express/Node local persistence API. It includes twelve functioning modules, including a 16-step drum machine, 25-key keyboard, and 16-pad controller, a connected starter composition, a hardware-inspired panel design, patch cables, drag/drop and movement, composition controls, undo/redo, browser autosave, optional Node saves, JSON backups/import, live recording, recording playback/download, and keyboard-accessible controls.

The initial connected patch is **Step sequencer → Oscillator → Filter → Delay → Output**, named _Sunday circuits_. Eight steps run at 108 BPM in C minor. Sound begins after Play/Record or a live instrument gesture. **More → Load rhythm & keys patch** opens _Pocket rhythm_, a separate connected performance example with all three new instruments, an oscillator, mixer, and output.

## Hardware appearance

The user prefers individually designed instruments with different materials, colours, sizes, silhouettes, and controls. The current set includes a cream/charcoal drum computer, walnut-sided keyboard, violet pad enclosure, ochre oscillator, green filter, blue delay, plum reverb, terracotta LFO, graphite noise source, and a compact brushed-aluminium mixer with faders. Output has a cream laboratory enclosure and red master dial. Colours and material details are configurable in `components/module-finishes.css`; dimensions remain registry-driven. Selected modules are narrower, preserving previously valid saved positions. Browser QA verified the contrasting finishes across the catalog, control/socket spacing, live playback, and the mixer faders using both dragging and arrow keys; fader values persisted across saving and reload.

## Validation

- Strict TypeScript checking and a production Vite build.
- Eighteen automated tests covering starter round trips, all registry defaults, musical pitch conversion, routing invariants, untrusted import data, cycles/dangling cables, atomic file persistence, corrupt neighboring files, real HTTP API validation, drum pattern validation/muting, controller event routing, backward-compatible v1 loading, all sixteen drum recipes, source disposal, hat choking, held-note priority/release, octave edits, and rebuilding disposed audio engines during development reload.
- Browser verification: live playback/analysis, keyboard knob changes, recording/save/reopen/download, Node saving, library drag-and-drop, module movement, modulation routing, incompatible-socket rejection, undo/redo, composition settings across reload, and desktop/390px phone layouts. The downloaded take was verified as stereo Opus at 48 kHz. New-instrument browser checks also verified live keyboard/pad audio with the drum pattern muted, note release, recording/reopening the live performance, and drum pattern/keyboard-octave persistence through a page reload. No browser errors occurred in the final verification run. See Git history for later validation updates.

## Known boundaries

- The complete project is committed locally. A private Sites project was registered, but source synchronization/publication was blocked by automatic approval review because uploading source to that service was not explicitly authorized. No hosted version has been published. Obtain explicit user authorization before retrying source upload.

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
