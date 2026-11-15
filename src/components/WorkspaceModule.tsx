import type { PlaybackPosition } from '../audio/playback-position';
import { memo, type PointerEvent } from 'react';
import type { AudioEngine } from '../audio/engine';
import type { LiveControls } from '../audio/live';
import { SEQUENCER_DEGREES } from '../domain/modules';
import type { DrumSample, Endpoint, PatchModule, Project } from '../domain/types';
import type { MicrophoneControls } from '../hooks/useMicrophoneSampler';
import { ModuleCard } from './ModuleCard';

interface Props {
  module: PatchModule;
  project: Project;
  originX: number;
  originY: number;
  scale: number;
  selected: boolean;
  playbackPosition: PlaybackPosition;
  live: LiveControls;
  microphone: MicrophoneControls;
  audioActive: boolean;
  engine: AudioEngine;
  playing: boolean;
  pending: Endpoint | null;
  commit: (edit: (project: Project) => Project, group?: string) => void;
  setSample: (moduleId: string, slot: string, sample: DrumSample | null) => boolean;
  notify: (message: string) => void;
  onSelect: (id: string) => void;
  onDragStart: (module: PatchModule, event: PointerEvent<HTMLElement>) => void;
  onPort: (endpoint: Endpoint) => void;
  onRemoved: (id: string) => void;
}

/** Navigation changes the enclosing surface, not these instrument/control trees.
 * Keep every prop honest: edits, routing, live handlers and capture state still update normally.
 */
export const WorkspaceModule = memo(function WorkspaceModule({
  module,
  project,
  originX,
  originY,
  scale,
  selected,
  playbackPosition,
  live,
  microphone,
  audioActive,
  engine,
  playing,
  pending,
  commit,
  setSample,
  notify,
  onSelect,
  onDragStart,
  onPort: portClick,
  onRemoved,
}: Props) {
  return (
    <ModuleCard
      module={module}
      project={project}
      position={{ x: module.x - originX, y: module.y - originY }}
      scale={scale}
      selected={selected}
      playbackPosition={playbackPosition}
      live={live}
      microphone={microphone}
      audioActive={audioActive}
      engine={engine}
      playing={playing}
      pending={pending}
      onSelect={() => onSelect(module.id)}
      onDragStart={(event) => onDragStart(module, event)}
      onParameter={(id, value) =>
        commit(
          (current) => ({
            ...current,
            modules: current.modules.map((item) =>
              item.id === module.id
                ? { ...item, parameters: { ...item.parameters, [id]: value } }
                : item,
            ),
          }),
          `${module.id}:${id}`,
        )
      }
      onParameters={(values, group) =>
        commit(
          (current) => ({
            ...current,
            modules: current.modules.map((item) =>
              item.id === module.id
                ? { ...item, parameters: { ...item.parameters, ...values } }
                : item,
            ),
          }),
          group ? `${module.id}:${group}` : '',
        )
      }
      onSample={(slot, sample) => {
        const accepted = setSample(module.id, slot, sample);
        if (!accepted)
          notify('This sample exceeds the patch storage limit. Remove an unused sample first.');
        return accepted;
      }}
      onStep={(index, next, group) =>
        commit(
          (current) => ({
            ...current,
            modules: current.modules.map((item) =>
              item.id === module.id && item.steps
                ? {
                    ...item,
                    steps: item.steps.map((degree, position) =>
                      position === index
                        ? next === 'next'
                          ? (degree + 1) % (SEQUENCER_DEGREES.max + 1)
                          : next
                        : degree,
                    ),
                  }
                : item,
            ),
          }),
          group ? `${module.id}:step:${index}:${group}` : '',
        )
      }
      onPort={portClick}
      onDrumStep={(sound, index) =>
        commit((current) => ({
          ...current,
          modules: current.modules.map((item) =>
            item.id === module.id && item.drumPattern
              ? {
                  ...item,
                  drumPattern: {
                    ...item.drumPattern,
                    [sound]: item.drumPattern[sound].map((enabled, position) =>
                      position === index ? !enabled : enabled,
                    ),
                  },
                }
              : item,
          ),
        }))
      }
      onRemove={() => {
        commit((current) => ({
          ...current,
          modules: current.modules.filter((item) => item.id !== module.id),
          cables: current.cables.filter(
            (cable) => cable.from.moduleId !== module.id && cable.to.moduleId !== module.id,
          ),
        }));
        onRemoved(module.id);
      }}
    />
  );
});
