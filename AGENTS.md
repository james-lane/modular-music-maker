# Instructions for future sessions

## Project intent

Patchwork is a modular music-making website using **TypeScript on Node.js**. Users add modules to a workspace and wire them together to create sound. They can configure the composition, record output, and save their work. The user explicitly wants **skeuomorphic modules**, clean human-editable code, useful comments, centralized configuration, Git history, and up-to-date documentation.

## Visual direction

The user explicitly wants a collection of different physical instruments. Modules may have different colours, materials, sizes, silhouettes, and control styles. Do not return to one uniform panel with a different accent stripe. Keep the skeuomorphic detail: convincing enclosure depth, material texture, screws, recessed sockets, legible printed labels, and tactile controls.

Current examples include a cream/charcoal drum computer, walnut-sided dark keyboard, violet polymer pad controller, ochre oscillator, forest-green filter, blue echo box, plum reverb, graphite noise generator, a narrow brushed-metal mixer with faders, and a petrol-teal four-input Merger with an ivory level dial. Surface palettes and refinements live in `src/components/module-finishes.css`; shared mechanics remain in `src/styles.css`. Keep dimensions in the module registry and preserve socket geometry.

## Read before changing code

1. `README.md` for setup and user behavior.
2. `docs/ARCHITECTURE.md` for data flow, audio lifecycle, persistence, and constraints.
3. `docs/ADDING_MODULES.md` before implementing an instrument.
4. `docs/PROJECT_STATUS.md` for current capabilities, verification, and future work.

## Engineering conventions

- Keep strict TypeScript enabled. Avoid `any` and unexplained assertions.
- Keep serialized patch data, UI interaction state, and live audio nodes separate.
- New modules need a complete field guide in `src/domain/module-guides.ts`, including control descriptions and a valid worked patch example. Derive compatible modules from registry sockets rather than maintaining a second compatibility list. Guide browsing must not mutate the patch or start audio.
- Starter examples live in `src/domain/examples.ts`. Keep their sound, module combinations, and teaching purpose distinct. Factories must return fresh IDs and independent editable data, with every module contributing to Output and no overlapping panels. Opening an example uses the normal project-switch path to preserve existing work and stop playback; browsing is silent.
- Module defaults, parameter ranges, sockets, dimensions, and accents belong in the module registry. Shared behavioral values belong in `src/config.ts`; theme values belong in CSS custom properties.
- Comment **why**, invariants, lifecycle ownership, and extension points. Keep names descriptive. Format code with Prettier; prefer small components to growing one component indefinitely.
- Validate all imported/stored/request data through `parseProject`. Preserve versioned patch compatibility; add an explicit migration if changing the schema.
- Schedule notes using `AudioContext.currentTime` with look-ahead scheduling. Do not use React rendering or visual timers as the musical clock.
- Every new audio node/source needs a disposal path. Never request microphone permission for recording studio output.
- Use ramped audio parameter changes to reduce clicks. Bound feedback and volume values. Keep incompatible sockets and feedback cycles out of the graph.
- Preserve keyboard access, responsive canvas access, and `prefers-reduced-motion` support.
- Keep the complete studio usable offline after its first production download, including installed iPad home-screen use. Bundle app resources locally; preserve atomic release caching and updates that wait for open sessions to close. Public installs must not depend on the Node API. See `docs/OFFLINE.md`.
- Never commit user patch files, recording blobs, dependencies, build output, secrets, or machine-specific state.
- A private Sites project is registered in `.openai/hosting.json`, but no version is published. Automatic approval review rejected source upload during initial setup. Do not retry that upload without explicit user authorization; local development is unaffected.
- Do not introduce accounts, paid services, or publicly expose the local unauthenticated Node API without an explicit product requirement.

## Validation and documentation

- Run `npm run check` after substantive changes; it runs strict types, domain/persistence/HTTP tests, and a production build.
- Run `npm run format:check` before committing.
- Test browser interactions for changes involving audio, routing, dragging, recording, or layout. Listen/check the live signal and verify persistence, rather than relying only on a successful render.
- Tests open a temporary loopback HTTP server. Restricted execution environments may require permission for local networking.
- Update `README.md`, `docs/PROJECT_STATUS.md`, and affected architecture/module docs in the same change as behavior changes.
- Use Git commits with clear messages describing the actual change. Keep unrelated user edits intact.

## Handy commands

`npm run dev` starts Vite at `127.0.0.1:5173` and Express at `127.0.0.1:3001`. `npm run build && npm start` serves production at port 3001. Port 5173 is strict; stop an existing dev process before starting another.
