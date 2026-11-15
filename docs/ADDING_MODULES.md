# Adding a module

The module registry is the extension point. Keep a new instrument explicit and easy to understand; a dynamic plugin loader is unnecessary at this stage.

## 1. Define the serializable identity

Add the type to `ModuleType` in `src/domain/types.ts`. Only add patch fields if the instrument cannot be represented by parameters, steps, and ports. Changes to persisted shape require compatibility/migration planning.

## 2. Register the instrument

Add a `ModuleDefinition` to `MODULES` in `src/domain/modules.ts`:

- Human name, short description, category, accent color, and panel code.
- Width and height in logical canvas pixels. Leave room for the header, controls, and the 54px socket footer.
- Unique port IDs with `input`/`output` direction and `audio`/`pitch`/`control`/`trigger`/`kit` signal types.
- Numeric control definitions with bounds, step size, default, optional unit, and optional logarithmic response.
- Non-numeric defaults only when needed. Validate any new string enum in `validation.ts`.
- Optional maximum instance count.

The library, numeric knobs, initial parameters, socket labels, connection checks, and persistence validation derive from this definition automatically. `defaultParameters()` converts declared control defaults into patch data.

Each module also needs an entry in `MODULE_GUIDES` in `src/domain/module-guides.ts`. Include a plain-language overview, setup steps, explanations keyed by the numeric control IDs, any special controls, a useful tip, and a worked example with explicit module/port endpoints. TypeScript requires a guide for each module type. Tests check that controls remain documented and every example forms a valid patch. Compatible module lists are derived from registry socket directions/signal types; do not maintain a separate hard-coded compatibility list.

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

1. Run `npm run check`. The catalog-default test automatically includes new definitions.
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

Mic sampler trimming uses normalized numeric registry controls and a shared frame-range helper in `domain/samples.ts`. Keep waveform selection, audio offsets/envelopes, idle timing, and exported WAV frames aligned with that helper. Native trim sliders are specialized controls rather than extra knobs; keep their edits grouped in history. The module retains its original 300×480 footprint and socket coordinates. Old samplers migrate a completely absent trim pair to full length in `parseProject`; never silently repair a partially specified or reversed range.

Drum kit inputs directly wired from Mic sampler use `kitSamplerSources` to pass saved-clip references into each drum runtime, without changing patch/socket types or copying sample data into the kit. Keep these as independently owned polyphonic one-shots; never trigger the sampler’s audition player or gate its live bus. Apply trim/Speed/Level and drum Tone/Decay per hit. Sample Decay is a tail fade and must not truncate source duration. Ordinary upstream effects/continuous sources retain live-input gating. Report outstanding voice end times via `remainingTailSeconds` so later edits cannot shorten live-audio idle protection for an already playing hit.

## Audio selectors

Switch demonstrates selection without topology edits: registry-defined audio inputs feed independent gains, and one integer parameter picks a unity target while all other inputs ramp to zero. Start every input closed and use the shared smoothing time for both directions; rapid changes must retarget continuously. Keep source/effect lifetimes independent of selection and disconnect every owned node on disposal. Use native pressed buttons for discrete choices, retain keyboard focus, and route edits through the normal parameter/history path. Selecting an unpatched input must be silent. Switch does not route pitch, trigger, kit or modulation events.

Neon chorus is the catalog-wide scale example. When adding a module type, give it a meaningful connected role there or explicitly revise that example's coverage promise. Keep the full patch within module/cable/sample limits, every instance connected toward Output, and registry-sized panels non-overlapping. Built-in example samples must be original/local data and every fresh copy must own its editable sample objects.
