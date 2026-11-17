import { z } from 'zod';
import { CONFIG, ROOT_NOTES } from '../config';
import {
  DEFAULT_SEQUENCER_RATE,
  MODULES,
  SWITCH_SCHEDULE,
  defaultSwitchCues,
  MIXER_INPUT_COUNTS,
  DEFAULT_PAD_LAYOUT,
  PAD_LAYOUTS,
  SAMPLER_TRIM,
  SEQUENCER_DEGREES,
  SEQUENCER_RATES,
} from './modules';
import { DRUM_LANES, DRUM_SOUNDS, DRUM_STEP_COUNT } from './instruments';
import { isValidSamplePcm } from './samples';
import { XY_CORNERS, XY_EFFECTS } from './xy-effects';
import { connectionError } from './project';
import { clearModuleOverlap } from './workspace';
import { switchScheduleError } from './switch-schedule';
import type { ModuleType, Project } from './types';

const endpoint = z.object({ moduleId: z.uuid(), portId: z.string().max(24) }).strict();

/** One versioned validation boundary is shared by JSON import, browser storage and Node. */
export const projectSchema = z
  .object({
    version: z.literal(2),
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    updatedAt: z.iso.datetime(),
    tempo: z.number().min(CONFIG.tempo.min).max(CONFIG.tempo.max),
    rootNote: z.string().refine((note) => ROOT_NOTES.includes(note), 'Unknown root note'),
    scale: z.enum(['minor', 'major', 'pentatonic']),
    timeSignature: z.enum(['4/4', '3/4', '6/8']),
    masterVolume: z.number().min(0).max(1),
    modules: z
      .array(
        z
          .object({
            id: z.uuid(),
            type: z.enum(Object.keys(MODULES) as [ModuleType, ...ModuleType[]]),
            x: z.number().min(-CONFIG.canvas.maxCoordinate).max(CONFIG.canvas.maxCoordinate),
            y: z.number().min(-CONFIG.canvas.maxCoordinate).max(CONFIG.canvas.maxCoordinate),
            parameters: z.record(
              z.string(),
              z.union([z.number(), z.string().max(32), z.boolean()]),
            ),
            steps: z
              .array(z.number().int().min(SEQUENCER_DEGREES.rest).max(SEQUENCER_DEGREES.max))
              .length(8)
              .optional(),
            samples: z
              .record(
                z.string(),
                z
                  .object({
                    name: z.string().trim().min(1).max(80),
                    pcm: z
                      .string()
                      .max(CONFIG.samples.maxEncodedLength)
                      .refine(isValidSamplePcm, 'Invalid sample PCM'),
                  })
                  .strict(),
              )
              .optional(),
            drumPattern: z
              .record(z.string(), z.array(z.boolean()).length(DRUM_STEP_COUNT))
              .optional(),
            switchCues: z
              .array(
                z
                  .object({
                    bar: z.number().int().min(1).max(SWITCH_SCHEDULE.maxBar),
                    input: z.number().int().min(1).max(4),
                  })
                  .strict(),
              )
              .max(SWITCH_SCHEDULE.maxCues)
              .optional(),
          })
          .strict(),
      )
      .max(CONFIG.maxModules),
    cables: z
      .array(z.object({ id: z.uuid(), from: endpoint, to: endpoint }).strict())
      .max(CONFIG.maxCables),
  })
  .strict()
  .superRefine((project, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    if (new Set(project.modules.map((module) => module.id)).size !== project.modules.length)
      issue('Module IDs must be unique.');
    if (new Set(project.cables.map((cable) => cable.id)).size !== project.cables.length)
      issue('Cable IDs must be unique.');
    const sampleLength = project.modules.reduce(
      (sum, module) =>
        sum +
        Object.values(module.samples ?? {}).reduce((total, sample) => total + sample.pcm.length, 0),
      0,
    );
    if (sampleLength > CONFIG.samples.maxProjectEncodedLength)
      issue('Samples exceed the patch storage limit.');
    for (const module of project.modules) {
      const definition = MODULES[module.type];
      if (
        definition.maxInstances &&
        project.modules.filter((item) => item.type === module.type).length > definition.maxInstances
      )
        issue(`Only ${definition.maxInstances} ${definition.name} module is allowed.`);
      const allowed = new Set([
        ...definition.controls.map((control) => control.id),
        ...Object.keys(definition.defaults ?? {}),
      ]);
      if (Object.keys(module.parameters).some((key) => !allowed.has(key)))
        issue('Unknown module parameter.');
      if (module.type === 'switch') {
        if (
          typeof module.parameters.automatic !== 'boolean' ||
          typeof module.parameters.repeat !== 'boolean'
        )
          issue('Switch automatic and repeat settings must be booleans.');
        const error = switchScheduleError({
          cues: module.switchCues ?? [],
          repeat: Boolean(module.parameters.repeat),
          loopBars: Number(module.parameters.loopBars),
        });
        if (typeof module.parameters.loopBars !== 'number' || error)
          issue(error ?? 'Invalid Switch repeat length.');
      } else if (module.switchCues) issue('Only Switch modules can store switch cues.');
      if (
        module.type === 'mixer' &&
        !MIXER_INPUT_COUNTS.some((count) => count === module.parameters.inputCount)
      )
        issue('Mixer input count must be a whole number from 2 to 8.');
      if (
        module.type === 'pad-controller' &&
        !PAD_LAYOUTS.some((layout) => layout.count === module.parameters.padCount)
      )
        issue('Pad count must be 4, 8 or 16.');
      for (const control of definition.controls) {
        const value = module.parameters[control.id];
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < control.min ||
          value > control.max
        )
          issue(`Invalid ${definition.name} ${control.label}.`);
        if (control.step === 1 && typeof value === 'number' && !Number.isInteger(value))
          issue(`${control.label} must be a whole number.`);
      }
      if (
        module.type === 'oscillator' &&
        !['sine', 'triangle', 'sawtooth', 'square'].includes(String(module.parameters.waveform))
      )
        issue('Unknown oscillator waveform.');
      if (
        module.type === 'filter' &&
        !['lowpass', 'highpass', 'bandpass'].includes(String(module.parameters.mode))
      )
        issue('Unknown filter mode.');
      if (module.type === 'drum-kit') {
        if (Object.keys(module.samples ?? {}).some((lane) => !DRUM_LANES.some((id) => id === lane)))
          issue('Unknown sample voice.');
        for (const lane of DRUM_LANES) {
          const source = module.parameters[lane];
          if (
            source !== 'sample' &&
            source !== 'input' &&
            !DRUM_SOUNDS.some((sound) => sound.id === source)
          )
            issue('Unknown drum voice source.');
        }
      } else if (module.type === 'mic-sampler') {
        if (Number(module.parameters.trimStart) >= Number(module.parameters.trimEnd))
          issue('Trim start must be before trim end.');
        if (Object.keys(module.samples ?? {}).some((slot) => slot !== 'clip'))
          issue('Mic sampler only stores one clip.');
      } else if (module.samples) issue('Only Drum kit and Mic sampler modules can store samples.');
      if (module.type === 'xy-effects') {
        for (const corner of XY_CORNERS) {
          if (!XY_EFFECTS.some((effect) => effect.id === module.parameters[corner.id]))
            issue(`Unknown XY Effects ${corner.label} effect.`);
        }
      }
      if (
        module.type === 'sequencer' ||
        module.type === 'mod-sequencer' ||
        module.type === 'random-mod'
      ) {
        if (module.type === 'sequencer' && !module.steps) issue('A sequencer needs eight steps.');
        if (!SEQUENCER_RATES.some((rate) => rate.value === module.parameters.rate))
          issue('Unknown sequencer step rate.');
      }
      if (module.type === 'drum-machine') {
        if (typeof module.parameters.enabled !== 'boolean')
          issue('Drum sequencer enabled must be a boolean.');
        if (
          !module.drumPattern ||
          Object.keys(module.drumPattern).length !== DRUM_LANES.length ||
          DRUM_LANES.some((id) => !module.drumPattern?.[id])
        )
          issue('A drum machine needs four named lanes of sixteen steps.');
      } else if (module.drumPattern) issue('Only drum machines can store a drum pattern.');
    }
    // Validate in order against an accumulating graph to also catch duplicates and cycles.
    const graph = { ...project, cables: [] } as Project;
    for (const cable of project.cables) {
      const error = connectionError(graph, cable.from, cable.to);
      if (error) issue(error);
      graph.cables.push(cable);
    }
  });

export function parseProject(value: unknown): Project {
  const expandedPads = new Set<string>();
  const project = projectSchema.parse(migrateProject(value, expandedPads));
  // Old sixteen-pad controllers gain a wider socket row. Preserve every ID, route
  // and neighbouring position; relocate only a legacy panel that would now overlap.
  for (const module of project.modules) {
    if (!expandedPads.has(module.id)) continue;
    const resized = clearModuleOverlap(
      module,
      project.modules.filter((item) => item.id !== module.id),
    );
    project.modules = project.modules.map((item) => (item.id === module.id ? resized : item));
  }
  return project;
}

/** V2 gives coordinates a signed, open-workspace meaning. V1 IDs, sound, samples
 * and cables migrate unchanged; legacy pad enclosures may need layout clearance.
 * Never mutate the caller's stored object.
 * Validation still runs after migration and unknown versions remain unsupported.
 */
function migrateProject(value: unknown, expandedPads: Set<string>): unknown {
  if (typeof value !== 'object' || value === null || !('version' in value)) return value;
  const project = value.version === 1 ? { ...value, version: 2 } : value;
  if (project.version !== 2 || !('modules' in project) || !Array.isArray(project.modules))
    return project;
  // Additive controls preserve the sound of old saves. Only a completely absent
  // control group is legacy data; partial or invalid values still fail validation.
  return {
    ...project,
    modules: project.modules.map((module: unknown) => {
      if (
        typeof module !== 'object' ||
        module === null ||
        !('type' in module) ||
        !('parameters' in module)
      )
        return module;
      const parameters = module.parameters;
      if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters))
        return module;
      if (
        module.type === 'switch' &&
        !('switchCues' in module) &&
        !['automatic', 'repeat', 'loopBars'].some((key) => key in parameters)
      ) {
        return {
          ...module,
          parameters: { ...MODULES.switch.defaults, ...parameters },
          switchCues: defaultSwitchCues(Number('selected' in parameters ? parameters.selected : 1)),
        };
      }
      if (module.type === 'mixer' && !('inputCount' in parameters)) {
        const added = MODULES.mixer.controls.slice(MIXER_INPUT_COUNTS[0]);
        if (added.some((control) => control.id in parameters)) return module;
        return {
          ...module,
          parameters: {
            ...parameters,
            inputCount: MIXER_INPUT_COUNTS[0],
            ...Object.fromEntries(added.map((control) => [control.id, control.default])),
          },
        };
      }
      if (module.type === 'pad-controller' && !('padCount' in parameters)) {
        if ('id' in module && typeof module.id === 'string') expandedPads.add(module.id);
        return { ...module, parameters: { ...parameters, padCount: DEFAULT_PAD_LAYOUT.count } };
      }
      if (module.type === 'sequencer' && !('rate' in parameters)) {
        return {
          ...module,
          parameters: { ...parameters, rate: DEFAULT_SEQUENCER_RATE.value },
        };
      }
      if (module.type === 'merger') {
        const inputs = MODULES.merger.controls.filter((control) => control.id !== 'level');
        if (inputs.some((control) => control.id in parameters)) return module;
        return {
          ...module,
          parameters: {
            ...parameters,
            ...Object.fromEntries(inputs.map((control) => [control.id, control.default])),
          },
        };
      }
      if (module.type !== 'mic-sampler' || 'trimStart' in parameters || 'trimEnd' in parameters)
        return module;
      return {
        ...module,
        parameters: { ...parameters, trimStart: SAMPLER_TRIM.start, trimEnd: SAMPLER_TRIM.end },
      };
    }),
  };
}
