# Adding a module

The module registry is the extension point. Keep a new instrument explicit and easy to understand; a dynamic plugin loader is unnecessary at this stage.

## 1. Define the serializable identity

Add the type to `ModuleType` in `src/domain/types.ts`. Only add patch fields if the instrument cannot be represented by parameters, steps, and ports. Changes to persisted shape require compatibility/migration planning.

## 2. Register the instrument

Add a `ModuleDefinition` to `MODULES` in `src/domain/modules.ts`:

- Human name, short description, category, accent color, and panel code.
- Width and height in logical canvas pixels. Leave room for the header, controls, and the 54px socket footer.
- Unique port IDs with `input`/`output` direction and `audio`/`pitch`/`control` signal types.
- Numeric control definitions with bounds, step size, default, optional unit, and optional logarithmic response.
- Non-numeric defaults only when needed. Validate any new string enum in `validation.ts`.
- Optional maximum instance count.

The library, numeric knobs, initial parameters, socket labels, connection checks, and persistence validation derive from this definition automatically. `defaultParameters()` converts declared control defaults into patch data.

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

Name runtime endpoints exactly like registry port IDs. Control inputs may be AudioParams; audio outputs must be AudioNodes. Pitch ports are musical events, so a new pitch producer/consumer also needs scheduling support in `AudioEngine` (currently sequencer → oscillator only).

Start source nodes once, retain ownership, and stop/disconnect them in `dispose()`. Disconnect every internal feedback connection. Prefer smoothed parameter changes. Avoid fetching resources inside a synchronous factory; define a loading lifecycle first if adding samples or AudioWorklets.

## 4. Add specialized controls only if needed

`ModuleCard` renders ordinary numeric knobs automatically. Waveform buttons, sequencer steps, and output analysis currently have explicit branches. If a new module needs substantial custom controls, move those controls into a named component instead of letting `ModuleCard` grow indefinitely.

Use the existing panel/screw/knob/socket styles and registry accent color. Keep controls keyboard accessible and logical coordinates aligned to the cable geometry. Numeric values should have clear labels and units. Unit `%` currently represents a normalized `0…1` value.

## 5. Verify and document

1. Run `npm run check`. The catalog-default test automatically includes new definitions.
2. Add behavioral tests for new validation rules or pitch math; avoid tests that merely repeat the factory implementation.
3. In the browser, add and move the module, connect valid sockets, reject incompatible sockets, adjust controls while playing, unplug, and remove it.
4. Save/export/import and reload a patch using the new instrument.
5. Record an audible take and confirm that graph disposal/reconnection leaves no unexpected sound or errors.
6. Update the catalog count/capabilities in README and project status, and document any new model or lifecycle constraint.

## Current signal contracts

| Signal    | Meaning                                         | Current examples                       |
| --------- | ----------------------------------------------- | -------------------------------------- |
| `audio`   | Audible sample stream                           | Oscillator → Filter → Delay → Output   |
| `pitch`   | Scheduled scale-degree notes and gate           | Step sequencer → Oscillator            |
| `control` | Audio-rate modulation, measured in target units | LFO depth in Hz → Filter MOD/frequency |

Feedback between modules is intentionally rejected. The Delay factory contains its own bounded feedback loop. A future general feedback system needs explicit delay and stability semantics rather than removing cycle validation.
