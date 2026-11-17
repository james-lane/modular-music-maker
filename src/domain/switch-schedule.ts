import { SWITCH_SCHEDULE } from './modules';
import type { PatchModule, Project, SwitchCue } from './types';

export interface SwitchSchedule {
  cues: SwitchCue[];
  repeat: boolean;
  loopBars: number;
}

/** The audio clock counts sixteenths: 6/8 contains six eighths, or twelve ticks. */
export function ticksPerBar(signature: Project['timeSignature']): number {
  return signature === '4/4' ? 16 : 12;
}

export function switchScheduleError({ cues, repeat, loopBars }: SwitchSchedule): string | null {
  if (!Number.isInteger(loopBars) || loopBars < 1 || loopBars > SWITCH_SCHEDULE.maxBar)
    return `Repeat length must be 1–${SWITCH_SCHEDULE.maxBar} bars.`;
  if (!cues.length || cues.length > SWITCH_SCHEDULE.maxCues)
    return `Use 1–${SWITCH_SCHEDULE.maxCues} cues.`;
  if (
    cues.some(
      (cue) =>
        !Number.isInteger(cue.bar) ||
        cue.bar < 1 ||
        cue.bar > SWITCH_SCHEDULE.maxBar ||
        !Number.isInteger(cue.input) ||
        cue.input < 1 ||
        cue.input > 4,
    )
  )
    return `Each cue needs a bar from 1–${SWITCH_SCHEDULE.maxBar} and an input from 1–4.`;
  if (new Set(cues.map((cue) => cue.bar)).size !== cues.length) return 'Use only one cue per bar.';
  if (!cues.some((cue) => cue.bar === 1)) return 'Add a bar 1 cue to choose the starting input.';
  if (repeat && cues.some((cue) => cue.bar > loopBars))
    return 'Repeat length must include every cue.';
  return null;
}

/** A pure musical lookup shared by scheduled audio and the read-only key lights. */
export function switchInputAtBar(module: PatchModule, bar: number): number {
  if (!module.parameters.automatic || bar < 0) return Number(module.parameters.selected);
  const current = module.parameters.repeat ? bar % Number(module.parameters.loopBars) : bar;
  let selected = Number(module.parameters.selected),
    latest = 0;
  for (const cue of module.switchCues ?? []) {
    if (cue.bar <= current + 1 && cue.bar >= latest) {
      selected = cue.input;
      latest = cue.bar;
    }
  }
  return selected;
}

export function setSwitchSchedule(project: Project, id: string, schedule: SwitchSchedule): Project {
  if (switchScheduleError(schedule)) return project;
  return {
    ...project,
    modules: project.modules.map((module) =>
      module.id === id && module.type === 'switch'
        ? {
            ...module,
            parameters: {
              ...module.parameters,
              automatic: true,
              repeat: schedule.repeat,
              loopBars: schedule.loopBars,
            },
            switchCues: schedule.cues.map((cue) => ({ ...cue })).sort((a, b) => a.bar - b.bar),
          }
        : module,
    ),
  };
}
