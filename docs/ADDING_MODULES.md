# Adding a module

The module registry is the extension point. Keep a new instrument explicit and easy to understand; a dynamic plugin loader is unnecessary at this stage.

## 1. Define the serializable identity

Add the type to `ModuleType` in `src/domain/types.ts`. Only add patch fields if the instrument cannot be represented by parameters, steps, and ports. Changes to persisted shape require compatibility/migration planning.

## 2. Register the instrument

Add a `ModuleDefinition` to `MODULES` in `src/domain/modules.ts`:

- Human name, short description, category, accent color, and panel code.
- Width and height in logical canvas pixels. Leave room for the header, controls, and the 54px socket footer.
- Unique port IDs with `input`/`output` direction and `audio`/`pitch`/`control`/`trigger`/`kit` signal types. **Every port renders in the shared bottom footer.** No panel-face, screen, side or absolute-position socket exceptions are permitted. Registry order determines horizontal spacing and cable endpoints.
- Numeric control definitions with bounds, step size, default, optional unit, and optional logarithmic response.
- Non-numeric defaults only when needed. Validate any new string enum in `validation.ts`.
- Optional maximum instance count.

The library, numeric knobs, initial parameters, socket labels, connection checks, and persistence validation derive from this definition automatically. `defaultParameters()` converts declared control defaults into patch data.

Each module also needs an entry in `MODULE_GUIDES` in `src/domain/module-guides.ts`. Include a plain-language overview, setup steps, explanations keyed by the numeric control IDs, any special controls, a useful tip, and a worked example with explicit module/port endpoints. TypeScript requires a guide for each module type. Tests check that controls remain documented and every example forms a valid patch. Compatible module lists are derived from registry socket directions/signal types; do not maintain a separate hard-coded compatibility list.

Every guide’s **Load demo patch** uses `createModuleDemo` in `domain/module-demos.ts`: its worked connections are the canonical wiring, with optional `example.parameters` for audible starting settings. Do not add a second testing-only patch. The factory creates a fresh empty project containing only the required modules, lays out registry-sized DAG columns, selects cabled Drum kit inputs, preloads local sampler audio, validates through `parseProject`, and declares the transport/keyboard/pad gesture needed to hear it. New sample requirements belong in `domain/demo-samples.ts`, never user recordings or network downloads. Extend the shared factory for new performance types rather than leaving their demos silent. Loading uses the normal project-switch lifecycle and never autoplays; guide browsing stays read-only. Demos are temporary session projects until explicit Save patch, including after edits. Automatic saves and switches must not add them to My patches; preserve preceding owned work and keep recording storage independent.

## 3. Build the audio runtime

Implement a factory in `src/audio/factories.ts`. `AUDIO_FACTORIES` is a complete `Record<ModuleType, Factory>`, so TypeScript flags missing implementations.

```ts
// Example pattern; choose a new type name before adding this to the registry.
function makeGain(context: AudioContext): AudioRuntime {
  const gain = context.createGain();
  return {
    inputs: { in: gain },
    outputs: { out: gain },
    update(parameters) {
      gain.gain.setTargetAtTime(Number(parameters.level), context.currentTime, 0.025);
    },
    dispose() {
      gain.disconnect();
    },
  };
}
```

Name runtime endpoints exactly like registry port IDs. Control inputs may be AudioParams; audio outputs must be AudioNodes. Pitch and trigger ports are musical events, and kit ports carry drum voice assignments plus external-input buses, so their runtime endpoints do not appear in the AudioNode input/output maps. Sequencers and live keyboards currently target oscillator voices; pad controllers target a drum runtime through its optional `trigger(sound, velocity, time)` method. A new event producer/consumer needs explicit routing support in `AudioEngine` and a `LiveControls` command if it is played directly.

For summing modules, give each input its own node before connecting to a shared sum (see Merger). Mapping several socket IDs to one AudioNode can collapse two cables from the same source into one connection. Keep input count/IDs in the registry and derive runtime endpoints and connection indicators from it. Merger uses matching socket/control IDs for its independent, smoothed input gains, plus a separate Sum level. Old saves missing the entire input-control group migrate to unity gain; partial or invalid groups must still fail validation. Keep such additive control migrations explicit so older patches retain their sound.

Start source nodes once, retain ownership, and stop/disconnect them in `dispose()`. Disconnect every internal feedback connection. Prefer smoothed parameter changes. Avoid fetching resources inside a synchronous factory; define a loading lifecycle first if adding samples or AudioWorklets. The complete studio must work offline: bundle any new resources into the production output so the generated precache includes them, and verify them after an offline reload.

## 4. Add specialized controls only if needed

`ModuleCard` renders ordinary numeric knobs automatically. Waveform buttons and output analysis have explicit branches. `SequencerPanel` owns the eight-note buttons, native rate selector and per-module playback light. Its rate options/tick divisions/default are registry-owned; validate string selections and explicitly migrate missing legacy parameters. All melodic rates divide the shared sixteenth-note audio clock; visual ticks only display playback. The keyboard, pad controller, and drum machine use dedicated panel components and `components/instruments.css`; follow that pattern for substantial new controls. If a new module needs substantial custom controls, move those controls into a named component instead of letting `ModuleCard` grow indefinitely.

Give each module a physical identity suited to its role. Different materials, colours, proportions, silhouettes, and control types are encouraged; the user explicitly prefers a collected set of instruments over uniform cards. Reuse the shared screw/socket/knob mechanics, then declare its palette and material details in `components/module-finishes.css`. Add a root `--enclosure-<module-type>` colour token and use it for the module's `--panel-face`; braided cables use the same token to match the enclosure independently of socket/plug accents. Panel and knob custom properties are defined on `.module-panel` in `styles.css`; a module selector can override them. The mixer demonstrates native, keyboard-accessible vertical faders using the same saved gain parameters. Keep controls keyboard accessible and logical coordinates aligned to the cable geometry. Numeric values should have clear labels and units. Unit `%` currently represents a normalized `0…1` value.

Changing a footprint can affect old saved positions. The current visual refresh only reduces selected widths, so all previously valid positions still fit. When enlarging a panel, consider its overlap with neighbours in existing patches; the open workspace itself has no ordinary placement border. Keep signed world positions independent of camera-relative drawing and validate patch data through the v1→v2 migration boundary. Decorative wood cheeks and painted rails should not change the structural border width or the 12px socket-footer inset.

XY Effects demonstrates a control that updates several parameters together. Its panel sends X/Y in one edit through `ModuleCard.onParameters`, preserving coherent undo snapshots. Corner choices use the shared effect catalog and explicit enum validation, while compatibility still comes from registry sockets. New selectable effects need a native audio path, a bounded/crossfaded bus, disposal, and updated guide descriptions; keep tuning values in `CONFIG.audio.xyEffects`.

## 5. Verify and document

1. Run `npm run check`. The exhaustive `tests/module-demos.test.ts` uses the exact user-facing demo factories; preserve valid wiring, complete Output reachability, independent IDs/data, sample/kit readiness, and non-overlapping layout. The catalog-default test automatically includes new definitions.
2. Add behavioral tests for new validation rules or pitch math; avoid tests that merely repeat the factory implementation.
3. In the browser, add and move the module, connect valid sockets, reject incompatible sockets, adjust controls while playing, unplug, and remove it.
4. Save/export/import and reload a patch using the new instrument.
5. Record an audible take and confirm that graph disposal/reconnection leaves no unexpected sound or errors.
6. Update the catalog count/capabilities in README and project status, and document any new model or lifecycle constraint.

## Current signal contracts

| Signal    | Meaning                                              | Current examples                       |
| --------- | ---------------------------------------------------- | -------------------------------------- |
| `audio`   | Audible sample stream                                | Oscillator → Filter → Delay → Output   |
| `pitch`   | Scheduled or live pitch and gate                     | Step sequencer / Keyboard → Oscillator |
| `control` | Audio-rate modulation, measured in target units      | LFO depth in Hz → Filter MOD/frequency |
| `trigger` | Sound identity, velocity and scheduled trigger time  | Pad controller → Drum machine          |
| `kit`     | Four drum voice assignments and external audio buses | Drum kit → Drum machine                |

Drum patterns are an optional additive v1 field, validated as four named lanes of sixteen booleans. Drum voice identities and shortcut mappings live in `domain/instruments.ts`; synthesis recipes live in `audio/drums.ts`. New sounds need corresponding recipes and explicit validation for any persisted data. Drum kit assignments keep these stable lane keys even when the sound changes. Samples use the optional validated `samples` map on Drum kit lane IDs and the Mic sampler’s single `clip` slot; see Architecture for PCM format, total/per-file limits, and audio-clock cleanup of external-input envelopes. Never persist held notes or one-shot trigger events.

Feedback between modules is intentionally rejected. The Delay factory contains its own bounded feedback loop. A future general feedback system needs explicit delay and stability semantics rather than removing cycle validation.

Microphone capture is owned by `MicrophoneCapture` and `useMicrophoneSampler`, outside the audio graph. Extend their cancellation/owner checks when adding new capture workflows; never request device access in a factory, guide, or studio-output recorder. `configureSample` receives validated saved PCM, and the sampler reuses trigger events for one-shot playback. Use `useStudio.setSample` for atomic, validated sample edits against the latest patch. Preserve the shared sample budget, offline exports, source disposal, and update-refresh capture guard.

Mic sampler trimming uses normalized numeric registry controls and a shared frame-range helper in `domain/samples.ts`. Keep waveform selection, audio offsets/envelopes, idle timing, and exported WAV frames aligned with that helper. Native trim sliders are specialized controls rather than extra knobs; keep their edits grouped in history. The module retains its original 300×480 footprint; socket centres follow its current registry-ordered bottom footer. Old samplers migrate a completely absent trim pair to full length in `parseProject`; never silently repair a partially specified or reversed range.

Drum kit inputs wired from Mic sampler directly or through serial Effects modules use `kitSamplerPaths` and `kitSamplerSources` to pass saved-clip references into each drum runtime, without changing patch/socket types or copying sample data into the kit. Keep these as independently owned polyphonic one-shots; never trigger the sampler’s audition player or gate its live bus. Apply trim/Speed/Level and drum Tone/Decay per hit. Sample Decay is a tail fade and must not truncate source duration. Each receiving drum machine/lane owns a persistent private effect rack for its sampled hits; synchronize effect parameters and external modulation, and dispose the rack with the graph. Continuous sources and Mixer/Merger/Switch routes retain live-input gating. Report outstanding voice end times via `remainingTailSeconds` so later edits cannot shorten live-audio idle protection for an already playing hit.

## Audio selectors

Switch demonstrates selection without topology edits: registry-defined audio inputs feed independent gains, and one integer parameter picks a unity target while all other inputs ramp to zero. Start every input closed and use the shared smoothing time for both directions; rapid changes must retarget continuously. Keep source/effect lifetimes independent of selection and disconnect every owned node on disposal. Use native pressed buttons for discrete choices, retain keyboard focus, and route edits through the normal parameter/history path. Selecting an unpatched input must be silent. Switch does not route pitch, trigger, kit or modulation events. Its optional bar-start schedule is saved as validated `switchCues` with automatic/repeat settings. Keep automatic selections outside patch data/history, schedule native gain targets on the shared audio tick times, and cancel/hold queued targets before manual takeover or schedule edits. Stop/restart must reset the arrangement; graph rebuilds must reapply the current and pending selections. The inline, module-owned editor uses a local draft and one atomic Apply edit, with one cue per page to keep native controls within the original enclosure. Preserve Cancel/Escape, focus return, independent editors and draft reset after restored programme data; transport ticks and unrelated edits must not discard a draft. Preserve the disabled legacy migration and use the actual repeating guide demo for browser/recording/offline checks.

Neon chorus is the catalog-wide scale example. When adding a module type, give it a meaningful connected role there or explicitly revise that example's coverage promise. The modulation expansion keeps its original-seventeen promise and uses Moving parts for the four new control sources. Keep the full patch within module/cable/sample limits, every instance connected toward Output, and registry-sized panels non-overlapping. Built-in example samples must be original/local data and every fresh copy must own its editable sample objects.

For new control sources, preserve the legacy 1500-unit full-scale contract. Use normalized source Depth and `boundedModulation` at new receivers, rather than changing the LFO’s existing Hz parameters. Event-based Envelopes use `gate`; tempo sources use `scheduleControl` on the existing audio clock. Keep native nodes and ephemeral random/envelope state out of patch data. If a modulation source has a live display, meter its actual output via `ControlScope`. A stopped LFO uses a clearly described, control-responsive preview. Do not animate a schematic as if it were measured output. Keep independently triggered kit sample modulation taps in their hit cleanup path, and silence consumers before disposing producer buses. When extending a panel, add new sockets to its bottom footer and keep their stable IDs. The entire footer reflows from registry order; `ModulePorts` and `socket-geometry.ts` must stay in agreement. Never preserve an old socket position by moving a new socket onto the panel face. Check legible labels, control/footer clearance, and socket/cable alignment across all module demos.

## Shared demo regression workflow

For each affected module, open its library **?** guide, confirm browsing leaves the existing patch/audio unchanged, then choose **Load demo patch**. Verify a fresh project with only the demo’s modules, preservation of prior owned work in My patches, a temporary Demo label, stopped transport/capture and correct instructions. Check that edited demos stay out of My patches through switches/backgrounding/reload, then explicitly Save patch before checking their persisted edits. Perform the declared gesture from `createModuleDemo(type)` (transport, Keyboard note, or Pad hit) and check actual output audio, not just a rendered panel. Adjust the subject’s controls, record/play a take when audio changes, save/reload (including offline), and verify removal/Undo/disposal. Load a demo from a related guide to check the currently displayed subject is used. Use these same factory projects in native/browser audio harnesses. Full catalog demo checks are appropriate after changes to shared routing/audio code.

Update Getting started’s `PortGuide` whenever socket semantics change, with plain language for MOD, TRIGGER, PITCH/GATE, AUDIO, KIT and IN/OUT. This fixture and documentation policy is also recorded in AGENTS.md for future sessions.

`tests/module-ports.test.ts` exhaustively renders every catalog module’s ports and verifies all sockets remain inside one bottom footer, with cable endpoints on the bottom row. Browser QA must also check actual footer socket centres against cable geometry at several zoom levels, after dragging, and after save/reload. Do not add position fields to `PortDefinition` or move sockets using module-specific CSS. This bottom-only rule applies equally to future modulation, event and audio ports.

## Purposeful displays and compact panels

A screen is optional. Use it to reveal a measured signal, current response/parameter preview, sample selection, or genuinely useful readout. Simple single-control modules should instead be compact physical boxes: Noise and Reverb have no screens and no screen-shaped grille/inset. Do not reserve the old display’s empty space after removing it; size the enclosure in the registry to its controls while keeping comfortable keyboard/touch targets, printed labels, screws and a clear bottom footer.

`LfoDisplay` shows a rate/depth preview when stopped and measured `ControlScope` output when active. `FilterDisplay` uses the Web Audio biquad response calculation in `instrument-display.ts`, follows Cutoff/Resonance/mode while stopped, and adds the measured MOD input when active. Reduced motion retains the base response. `DelayDisplay` shows a fixed four-second impulse preview driven by Time/Feedback/Mix, plus the useful millisecond readout. These parameter views are not incoming-audio scopes. No audio context or extra processing filter is created for a passive preview. Keep drawing/sampling out of musical scheduling and cancel visualization loops on cleanup.

Check every illustrated dial while stopped and playing, plus external modulation, Stop, reduced-motion changes and offline restoration. Compare filter math against the browser’s native `BiquadFilterNode.getFrequencyResponse` when changing its model. Reuse guide demos and the catalog-wide layout/socket checks to verify smaller modules still expose every control above the bottom footer without overlapping other panels. Stable module/port IDs and saved positions do not need migration when a footprint shrinks; cable positions must derive from the new registry dimensions.

## Configured enclosures and pad outputs

Use `moduleDefinition(module)` for instance dimensions and active sockets; `MODULES[type]` remains the full registry/default catalog. The Pad controller’s 4/8/16 layouts, columns, dimensions and ordered output IDs live in `modules.ts`. Keep ports, cable geometry, bounds, free placement and demos on the same resolved definition. Do not squeeze many sockets into the old width or put them among performance controls. Every configuration must pass shared footer/geometry tests and actual browser alignment/clearance checks.

Count edits use `setPadCount` to update the enclosure, remove discarded-port cables and clear neighbour overlap as one Undo snapshot. Preserve stable remaining port IDs and the shared `trigger` bus. `padTargets` filters individual pad hits before AudioEngine dispatch, including after asynchronous activation or a count change. Validate imported configuration values and inactive endpoints; migration may supply an entirely absent legacy count, but must reject invalid supplied counts. The legacy size migration moves only a controller needing clearance and leaves IDs, audio, cables and neighbours intact. Future configurable instruments should follow this single-definition/atomic-edit pattern.

Mixer uses the same configured-instance mechanism for 2–8 inputs. Keep A/B IDs stable, retain hidden C–H gains, and use `setMixerInputCount` for atomic cable removal/resize Undo. Its runtime keeps independent, smoothed gains for all eight possible inputs and mutes inactive ones. Merger aligns its five knobs by matching the footer’s five equal columns; sockets remain entirely in the shared bottom footer.

Keyboard uses the same configured-instance dimensions for 25/37/49/61 keys. Keep key spacing readable, release removed/held notes on resize, preserve the stable pitch socket, and apply any overlap relocation through `setKeyboardKeyCount` in one Undo edit. Migrate absent legacy counts to 25; reject explicit unsupported counts. Performance styling must follow held tokens instead of native `:active`, which sticks to the first touch target during swipes. Shared Select mode gives module controls independent pointer ownership; Hand mode intercepts pointer gestures for navigation, so specialized controls must release ownership on cancellation/lost capture and accept keyboard activation.

Continuous gestures retain their pointer owner outside the visible control until up/cancel/lost capture. Knobs and sequencer steps continue their relative drag, XY pads clamp to their edges and resume on re-entry, and piano keys project outside coordinates onto their own keybed so horizontal swipes continue selecting notes above/below it until release, with left/right overshoot bounded to the end keys. One-shot pad hits and ordinary action buttons keep their existing discrete behavior. Verify outside release and cancellation with actual sound so captured notes cannot linger.

For a comparison demo needing several copies of one module, set a guide endpoint’s optional `instance` teaching name and override its settings through `example.instanceParameters`. The factory must create independent modules and resolve each named endpoint consistently; alias/type conflicts must fail. Optional `example.rows` uses these identities (or unaliased module types), placing every instance exactly once with registry-derived row/column sizes. Names and layout recipes are not patch schema fields. Declare `example.interaction` and `example.instructions` when a mixed transport/live demo needs an explicit first gesture, as in Sample & Hold’s three Switch-selected paths plus dry reference. Keep testing the same recipe, rather than constructing a second browser-only patch.
