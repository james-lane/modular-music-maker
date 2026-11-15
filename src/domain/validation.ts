import { z } from 'zod';
import { CONFIG, ROOT_NOTES } from '../config';
import { MODULES, SEQUENCER_DEGREES } from './modules';
import { DRUM_LANES, DRUM_SOUNDS, DRUM_STEP_COUNT } from './instruments';
import { isValidSamplePcm } from './samples';
import { connectionError } from './project';
import type { ModuleType, Project } from './types';

const endpoint = z.object({ moduleId: z.uuid(), portId: z.string().max(24) }).strict();

/** One versioned validation boundary is shared by JSON import, browser storage and Node. */
export const projectSchema = z
  .object({
    version: z.literal(1),
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
            x: z.number().min(0).max(CONFIG.canvas.width),
            y: z.number().min(0).max(CONFIG.canvas.height),
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
      if (
        module.x + definition.width > CONFIG.canvas.width ||
        module.y + definition.height > CONFIG.canvas.height
      )
        issue('Module is outside the workspace.');
      const allowed = new Set([
        ...definition.controls.map((control) => control.id),
        ...Object.keys(definition.defaults ?? {}),
      ]);
      if (Object.keys(module.parameters).some((key) => !allowed.has(key)))
        issue('Unknown module parameter.');
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
      } else if (module.samples) issue('Only Drum kit modules can store samples.');
      if (module.type === 'sequencer' && !module.steps) issue('A sequencer needs eight steps.');
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
  return projectSchema.parse(value);
}
