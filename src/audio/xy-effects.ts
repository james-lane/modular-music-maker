import { createXYControl } from './xy-control';
import { CONFIG } from '../config';
import { XY_CORNERS, XY_EFFECTS } from '../domain/xy-effects';
import type { AudioRuntime } from './factories';

/** A fixed parallel graph lets corner reassignment crossfade without rebuilding audio.
 * Repeated choices share an effect bus, with weights added rather than duplicated nodes.
 */
export function createXYEffects(context: AudioContext): AudioRuntime {
  const settings = CONFIG.audio.xyEffects;
  const input = context.createGain();
  const output = context.createGain();
  const dry = context.createGain();
  dry.gain.value = 0;
  input.connect(dry);
  dry.connect(output);

  const buses = Object.fromEntries(
    XY_EFFECTS.map(({ id }) => {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(output);
      return [id, gain];
    }),
  );
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = settings.filterHz;
  filter.Q.value = settings.filterResonance;
  input.connect(filter);
  filter.connect(buses.filter);

  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = settings.highpassHz;
  input.connect(highpass);
  highpass.connect(buses.highpass);
  input.connect(buses.clean);

  const delay = context.createDelay(1);
  const feedback = context.createGain();
  const echoDry = context.createGain();
  const echoWet = context.createGain();
  delay.delayTime.value = settings.echoSeconds;
  feedback.gain.value = settings.echoFeedback;
  echoDry.gain.value = 0.5;
  echoWet.gain.value = 0.5;
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  input.connect(echoDry);
  echoDry.connect(buses.echo);
  delay.connect(echoWet);
  echoWet.connect(buses.echo);

  const shaper = context.createWaveShaper();
  const gritLevel = context.createGain();
  const curve = new Float32Array(settings.curveSamples);
  for (let index = 0; index < curve.length; index++) {
    const sample = (index * 2) / (curve.length - 1) - 1;
    curve[index] = Math.tanh(sample * settings.drive) / Math.tanh(settings.drive);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  gritLevel.gain.value = settings.gritLevel;
  input.connect(shaper);
  shaper.connect(gritLevel);
  gritLevel.connect(buses.grit);

  const convolver = context.createConvolver();
  const impulse = context.createBuffer(
    2,
    context.sampleRate * settings.spaceSeconds,
    context.sampleRate,
  );
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < data.length; index++)
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length) ** 3;
  }
  convolver.buffer = impulse;
  input.connect(convolver);
  convolver.connect(buses.space);

  const control = createXYControl(context);
  control.dry.connect(dry.gain);
  let assignment = '';
  const routes: { corner: number; effect: string; gain: GainNode }[] = [];
  return {
    configureConnections: (ports) => control.configure(ports),
    inputs: { in: input, ...control.inputs },
    outputs: { out: output },
    update(parameters) {
      control.update({
        x: Number(parameters.x),
        y: Number(parameters.y),
        mix: Number(parameters.mix),
      });
      const next = XY_CORNERS.map((corner) => String(parameters[corner.id])).join(':');
      if (next !== assignment) {
        // Retain bounded native crossfade paths when reassigning effects.
        // Disconnecting a nonzero control signal would click and cut its tail.
        XY_CORNERS.forEach((corner, index) => {
          const effect = String(parameters[corner.id]);
          if (!routes.some((route) => route.corner === index && route.effect === effect)) {
            const gain = context.createGain();
            gain.gain.value = 0;
            control.corners[index].connect(gain);
            gain.connect(buses[effect].gain);
            routes.push({ corner: index, effect, gain });
          }
          for (const route of routes)
            if (route.corner === index)
              route.gain.gain.setTargetAtTime(
                route.effect === effect ? 1 : 0,
                context.currentTime,
                CONFIG.audio.parameterRampSeconds,
              );
        });
        assignment = next;
      }
    },
    dispose() {
      control.dispose();
      routes.forEach((route) => route.gain.disconnect());
      [
        input,
        output,
        dry,
        filter,
        highpass,
        delay,
        feedback,
        echoDry,
        echoWet,
        shaper,
        gritLevel,
        convolver,
        ...Object.values(buses),
      ].forEach((node) => node.disconnect());
      convolver.buffer = null;
      shaper.curve = null;
    },
  };
}
