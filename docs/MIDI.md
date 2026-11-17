# Optional Web MIDI

Add **MIDI Input** from the module library. Its test controls work in every browser without hardware or permission. Connect **PITCH / GATE → Oscillator PITCH** (and optionally Envelope NOTE / GATE), route the instrument's audio to Output, and press **Test note / hit**. The MIDI guide's **Load demo patch** supplies this exact wired fixture, including a filter-wheel route.

For hardware, press **Enable MIDI** and allow the browser's permission. This requests ordinary MIDI input, never SysEx or microphone access. Choose a device and channel per instance (All/0 accepts every channel), and optionally restrict Lowest/Highest note. Several instances can split or layer a keyboard, listen to different devices, or expose additional controller assignments. The shared permission/port owner closes inputs on Disable/unmount and tracks hotplug.

## Signals and assignments

- PITCH / GATE sends chromatic notes, hardware velocity scaled by Velocity, last-held-note priority and CC64 sustain. Oscillator remains monophonic; its Octave transposes incoming notes.
- TRIGGER sends sixteen consecutive note assignments starting at First drum note (default 36), in the existing pad order: kick, snare, clap, closed/open hat, low/high tom, rim, shaker, crash, ride, cowbell, tambourine, claves, low/high conga. These are consecutive Patchwork assignments, not a complete General MIDI drum map. Notes outside that window can still play PITCH / GATE. Filter the note range to isolate an individual pad in another MIDI Input instance.
- MOD 1–4 receive selected CC numbers 0–119; defaults are 1, 7, 74 and 11. Ordinary output maps 0–127 to 0…1500 reference units, bipolar maps it to −1500…+1500. Native ConstantSource output changes are smoothed on the audio clock. CC64 can both sustain notes and drive an explicitly assigned MOD output. CC120/123 release held notes on their input/channel. Other messages, including program changes, pitch bend, aftertouch, clock and SysEx, are ignored.
- Test note / hit generates a short C4 and the first drum hit through the same live/engine routes. Test MOD sliders generate the same native control signals as CC input; their positions are ephemeral test values, not hardware feedback.

## Receiving modules

Existing Filter MOD adds reference-Hz values to cutoff. Oscillator PITCH MOD and sampler SPEED MOD bend up to one octave; sampler LEVEL MOD scales its saved Level. These contracts remain unchanged for old patches.

New MOD sockets take over the named setting across its registry range, clamping negative/unusually large signals safely; unplugging restores the saved knob/fader. Oscillator LEVEL MOD, Drum machine LEVEL MOD and Envelope DEPTH MOD instead multiply the saved strength by 0…1. Native smoothing and bounded feedback/gain remain in effect. Other LFO/envelope/sequencer/XY modulation sources can use exactly the same sockets.

New targets include Noise/Output level, LFO rate/depth, Filter resonance, Delay time/feedback/mix, Reverb mix, all active Mixer channels, Merger inputs/sum, Envelope/Mod sequencer/Sample & Hold depth, and XY Effects X/Y/mix. XY axes use signed −1…1 input; select bipolar MIDI output to reach both sides. XY blend weights are calculated with native bounded audio nodes, retaining a dry centre, convex corner weights and effect tails. External control does not move saved controls or write performance events into patch history/autosave.

Keyboard, Pad controller, Step sequencer and XY controller are signal sources: use MIDI Input in place of their outputs rather than wiring into them. Drum kit responds through its connected Drum machine. Switch keeps its manual keys and bar schedule; MIDI selection is not implemented. Every field guide states its own capabilities and limits.

## Lifetime, saving and compatibility

Web MIDI needs HTTPS/localhost, a supporting browser and permission. Feature detection is authoritative; unsupported or denied access leaves the complete studio usable. Chromium-based browsers and desktop Firefox support the API; Safari/iPad/iPhone Safari currently do not. See [MDN requestMIDIAccess](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess) and the [Web MIDI specification](https://www.w3.org/TR/webmidi/).

Hardware enablement always starts off after reload. Channel/note/CC/polarity assignments are validated portable patch parameters. Device choices are separately validated browser preferences keyed by patch/module; imported copies do not silently select another machine's device. Permissions, native objects, held notes, current CC values and test controls are never serialized. Temporary examples/demos remain temporary until explicit Save patch. All required runtime code is bundled for offline use; no service or external library is required.

Stop, Disable, blur/hidden visibility, disconnect, routing or MIDI configuration changes, module removal, project switch and unmount release MIDI ownership. Pending audio resume/permission results cannot revive an old performance after cancellation. Touch and MIDI sources have independent note ownership; releasing the same pitch from one does not release another held source. Record captures the studio's routed audio, not MIDI messages or the sampler's dry preview.

Patch v3 explicitly migrates v1/v2 without changing sound, IDs, samples or routes. Mixer/Merger gain wider footers for the additional sockets; legacy instances move only if they overlap a neighbour at the new size. Existing compatible positions and neighbouring panels are retained. Old releases cannot read v3 patches. App build versions continue to derive independently from Git.

## Future modules

Add useful native MOD targets to `ModuleDefinition.modulationInputs` and expose matching `AudioRuntime.modulationTargets`. The shared lazy `withParameterInputs` adapter creates bounded control nodes only when connected, clears intrinsic AudioParam offsets during external takeover, and disposes every owned node. Custom contracts (e.g. signed XY axes) must supply matching native inputs directly. Keep all sockets in the ordinary registry-driven bottom footer, use `moduleDefinition` for active sockets/size, and test configured counts, cable clearance, saved-layout migrations and shared demos.

Every new module must supply required `ModuleGuide.midi` copy covering compatible signal types, exact supported controls and unsupported features. Do not claim full MIDI support simply because a module has audio inputs. Add relevant guide/demo/browser regressions, including unsupported/denied access and held-note cleanup. Never request MIDI or audio while merely browsing a guide or loading a demo.
