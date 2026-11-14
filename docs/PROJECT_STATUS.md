# Project status

Last updated: **14 November 2026**.

## Implemented foundation

Patchwork v0.1 is a TypeScript/React/Vite frontend with an Express/Node local persistence API. It includes nine functioning modules, a connected starter composition, a hardware-inspired panel design, patch cables, drag/drop and movement, composition controls, undo/redo, browser autosave, optional Node saves, JSON backups/import, live recording, recording playback/download, and keyboard-accessible controls.

The initial connected patch is **Step sequencer → Oscillator → Filter → Delay → Output**, named _Sunday circuits_. Eight steps run at 108 BPM in C minor. Sound begins only after Play/Record.

## Validation

- Strict TypeScript checking and a production Vite build.
- Eight automated tests covering starter round trips, all registry defaults, musical pitch conversion, routing invariants, untrusted import data, cycles/dangling cables, atomic file persistence, corrupt neighboring files, and real HTTP API validation.
- Browser verification: live playback/analysis, keyboard knob changes, recording/save/reopen/download, Node saving, library drag-and-drop, module movement, modulation routing, incompatible-socket rejection, undo/redo, composition settings across reload, and desktop/390px phone layouts. The downloaded take was verified as stereo Opus at 48 kHz. See Git history for later validation updates.

## Known boundaries

- The complete project is committed locally. A private Sites project was registered, but source synchronization/publication was blocked by automatic approval review because uploading source to that service was not explicitly authorized. No hosted version has been published. Obtain explicit user authorization before retrying source upload.

- Local-first, single-user storage. No accounts or cloud database; static hosted copies use browser storage. The Node server remains local and unauthenticated.
- Eight-step patterns; time signature controls beat grouping rather than pattern length. 6/8 currently uses three quarter-note groups, not a compound-meter transport.
- Native MediaRecorder audio files (WebM/Ogg/MP4 depending on browser), not WAV/offline export. Recording takes are capped at 10 minutes.
- Entire module graph rebuilds when routing changes, which may make a small transient. Parameter/position edits keep the existing graph.
- Noise and reverb are generated anew for each graph, so their exact texture is not deterministic between sessions.
- Background tab throttling can interrupt browser audio scheduling.
- Responsive canvas scrolls/pans on narrow screens; a full hardware rack remains larger than a phone viewport.

## Suggested next work

1. Separate instrument-specific controls into dedicated components as the catalog grows.
2. Add an ADSR/envelope and VCA module with a clear gate signal contract.
3. Add drum voices, tempo-synced effects, and a configurable sequencer length.
4. Provide deterministic noise/impulse seeds and gradual graph crossfades.
5. Add offline WAV rendering and MIDI input after defining their lifecycle and permissions.
6. Add user accounts and a real persistence adapter only when cloud sync is requested.

Keep these as potential directions, not automatic scope for future sessions.
