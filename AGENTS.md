# Instructions for future sessions

## Project intent

Patchwork is a modular music-making website using **TypeScript on Node.js**. Users add modules to a workspace and wire them together to create sound. They can configure the composition, record output, and save their work. The user explicitly wants **skeuomorphic modules**, clean human-editable code, useful comments, centralized configuration, Git history, and up-to-date documentation.

## Visual direction

The user explicitly wants a collection of different physical instruments. Modules may have different colours, materials, sizes, silhouettes, and control styles. Do not return to one uniform panel with a different accent stripe. Keep the skeuomorphic detail: convincing enclosure depth, material texture, screws, recessed sockets, legible printed labels, and tactile controls.

Current examples include a cream/charcoal drum computer, walnut-sided dark keyboard, violet polymer pad controller, ochre oscillator, forest-green filter, blue echo box, plum reverb, graphite noise generator, a narrow brushed-metal mixer with faders, and a petrol-teal four-input Merger with an ivory level dial. Surface palettes and refinements live in `src/components/module-finishes.css`; shared mechanics remain in `src/styles.css`. Keep dimensions in the module registry and keep cable geometry aligned with the shared bottom socket row.

## Read before changing code

1. `README.md` for setup and user behavior.
2. `docs/ARCHITECTURE.md` for data flow, audio lifecycle, persistence, and constraints.
3. `docs/ADDING_MODULES.md` before implementing an instrument.
4. `docs/PROJECT_STATUS.md` for current capabilities, verification, and future work.

## Engineering conventions

- Screens are optional, not a default decoration. Add one only for a useful measured signal, parameter response/preview, waveform/sample editor or necessary readout. Retained displays must respond to the controls they illustrate; never present an unchanging decorative trace as a working display, or fill screens with slogans/redundant labels. Passive previews must not start audio or create live audio contexts. Prefer compact single-control enclosures for simple modules (Noise and Reverb have no screens or screen-shaped insets). Keep dimensions in the registry and validate control/footer clearance, cable alignment and saved/example layouts after resizing.

- **All patch ports belong in the shared bottom footer on every module**, including MOD, pitch, trigger, kit and audio sockets. Never place sockets on a screen, among knobs, on the panel face/sides, or with per-module absolute-position/CSS overrides. Registry port order drives both footer layout and cable geometry. Keep existing port IDs for saved-patch compatibility; if more room is needed, adjust registry dimensions deliberately and check examples/saved-layout overlap. Run the catalog-wide port render/geometry tests and inspect actual socket/cable alignment in module demos after changes.

- Keep strict TypeScript enabled. Avoid `any` and unexplained assertions.
- Keep serialized patch data, UI interaction state, and live audio nodes separate.
- New modules need a complete field guide in `src/domain/module-guides.ts`, including control descriptions and a valid worked patch example. Derive compatible modules from registry sockets rather than maintaining a second compatibility list. Guide browsing must not mutate the patch or start audio. Every guide must offer **Load demo patch**, creating a fresh, validated, wired demo through the normal project-switch path (preserve current work, stop audio/capture, close the guide/library, never autoplay).
- Module demos are shared user-facing and development fixtures: `src/domain/module-demos.ts` builds them from each guide’s `example.connections` and optional `example.parameters`, with local media from `src/domain/demo-samples.ts`. Do not maintain a separate testing-only recipe or copy user recordings into demos. Demos need fresh IDs/independent editable data, a valid route from every module to Output, non-overlapping registry-sized panels, selected external kit inputs, any required bundled sample, and an explicit transport/keyboard/pad interaction. Extend `tests/module-demos.test.ts` and use these same demos for real browser/audio regression checks when adding or changing modules.
- Keep Getting started’s plain-language port glossary (`src/components/PortGuide.tsx`) aligned with signal contracts. Explain IN/OUT, AUDIO (sound), PITCH/GATE (notes and hold/release), MOD (setting movement), TRIGGER (one-shot hit/restart), and KIT (drum assignments/external buses), including practical connections.
- Examples, module demos and the first-visit starter stay temporary until explicit Save patch, even after edits, Undo/Redo or recording. Gate every automatic persistence path (debounce, project switch, pagehide/hidden visibility and flush); keep the prior saved active pointer and exclude temporary projects from My patches. A successful explicit Save promotes the same project to normal autosaving; failed saves leave it temporary. Keep this policy out of serialized patches and leave existing saved copies/recordings intact. In-app refresh must require explicit saving or opening an owned patch first.
- Starter examples live in `src/domain/examples.ts`. Keep their sound, module combinations, and teaching purpose distinct. Factories must return fresh IDs and independent editable data, with every module contributing to Output and no overlapping panels. Opening an example uses the normal project-switch path to preserve existing work and stop playback; browsing is silent.
- Module defaults, parameter ranges, sockets, dimensions, and accents belong in the module registry. Shared behavioral values belong in `src/config.ts`; theme values belong in CSS custom properties.
- Resolve configured instance dimensions and active sockets through `moduleDefinition(module)` for rendering, cable geometry, placement, bounds and validation. Count changes must keep removed-port cables and any clearance relocation in one Undo edit; preserve stable remaining IDs and explicitly migrate legacy configurations.
- App versions are derived automatically from `package.json` plus Git history in `scripts/app-version.ts`; keep the footer and emitted `version.json` on this shared source. Do not manually bump a version for each commit or confuse app identity with `Project.version`. Build from full history; installed sessions retain their running version until updated.
- Comment **why**, invariants, lifecycle ownership, and extension points. Keep names descriptive. Format code with Prettier; prefer small components to growing one component indefinitely.
- Validate all imported/stored/request data through `parseProject`. Preserve versioned patch compatibility; add an explicit migration if changing the schema.
- Schedule notes using `AudioContext.currentTime` with look-ahead scheduling. Do not use React rendering or visual timers as the musical clock.
- Every new audio node/source needs a disposal path. Never request microphone permission for recording studio output.
- Use ramped audio parameter changes to reduce clicks. Bound feedback and volume values. Keep incompatible sockets and feedback cycles out of the graph.
- Preserve keyboard access, responsive canvas access, and `prefers-reduced-motion` support.
- Keep the complete studio usable offline after its first production download, including installed iPad home-screen use. Bundle app resources locally; preserve atomic release caching and updates that wait for open sessions to close by default. A user-requested in-app refresh may activate a complete waiting release only after saving the patch, stopping audio/recording, finishing take storage, and checking that no other Patchwork window is open. Public installs must not depend on the Node API. See `docs/OFFLINE.md`.
- Preserve patch deletion invariants: named confirmation in My patches, stopped audio/capture only for active deletion, fresh empty history without re-saving the deleted patch, and independent saved recordings. Keep deleted-ID tombstones, stale-autosave/late-list filtering and verified-loopback-only file cleanup; test reload/offline deletion and storage-write rollback.
- Never commit user patch files, recording blobs, dependencies, build output, secrets, or machine-specific state.
- A private Sites project is registered in `.openai/hosting.json`, but no version is published. Automatic approval review rejected source upload during initial setup. Do not retry that upload without explicit user authorization; local development is unaffected.
- Do not introduce accounts, paid services, or publicly expose the local unauthenticated Node API without an explicit product requirement.

## Validation and documentation

- Run `npm run check` after substantive changes; it runs strict types, domain/persistence/HTTP tests, and a production build.
- Run `npm run format:check` before committing.
- Resolve Cloudflare build ownership from the actual Worker name before changing settings. Production belongs to the parent Worker; each Preview has its own ID and trigger. Configure shared preview defaults on the parent with `npm run build:ci` and `npx wrangler preview`, including existing previews. Never repoint a Preview trigger at main or use it to deploy production.
- Before calling a pull request ready or starting the next issue, wait for every remote check on its latest pushed commit to finish successfully. Inspect failures and repair them first; local checks alone are insufficient. For build/deployment changes, reproduce the actual provider command in a clean shallow checkout, verify the emitted version identifies the requested commit and full history, and confirm the provider uses `npm run build:ci`.
- Test browser interactions for changes involving audio, routing, dragging, recording, or layout. Listen/check the live signal and verify persistence, rather than relying only on a successful render.
- Tests open a temporary loopback HTTP server. Restricted execution environments may require permission for local networking.
- Update `README.md`, `docs/PROJECT_STATUS.md`, and affected architecture/module docs in the same change as behavior changes.
- Use Git commits with clear messages describing the actual change. Keep unrelated user edits intact.

## Handy commands

`npm run dev` starts Vite at `127.0.0.1:5173` and Express at `127.0.0.1:3001`. `npm run build && npm start` serves production at port 3001. Port 5173 is strict; stop an existing dev process before starting another.

`npm run deploy` builds and publishes the static studio to the `patchwork-studio` Cloudflare Worker at `https://patchwork.jameslane.dev`. The custom domain is declared in `wrangler.jsonc`; the Node API stays local. Cloudflare Workers Builds is the production deployment path after the one-time repository connection is enabled: pushes to `main` run `npm run build:ci` and then `npx wrangler deploy`. The CI command restores full Git history and validates formatting, types, tests and build. Use `npm run deploy` only for manual recovery; do not also deploy locally after an automatic build. See `docs/OFFLINE.md` for authentication and deployment checks. Keep Wrangler credentials and `.wrangler/` state out of Git.
