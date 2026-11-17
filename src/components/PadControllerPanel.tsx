import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LiveControls } from '../audio/live';
import { DRUM_SOUNDS, PAD_SHORTCUTS } from '../domain/instruments';
import type { PatchModule, Project } from '../domain/types';
import { padLabel } from '../domain/pad-controller';
import { PAD_LAYOUTS, padLayout, type PadCount } from '../domain/modules';
import { CONFIG } from '../config';

export function PadControllerPanel({
  module,
  project,
  live,
  onCount,
}: {
  module: PatchModule;
  project: Project;
  live: LiveControls;
  onCount: (count: PadCount) => void;
}) {
  const layout = padLayout(module.parameters.padCount);
  const [lit, setLit] = useState(new Set<number>());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setLit(new Set());
  }, [layout.count]);
  useEffect(() => () => timers.current.forEach((timer) => clearTimeout(timer)), []);
  const hit = (index: number) => {
    live.padHit(module.id, index);
    clearTimeout(timers.current.get(index));
    setLit((current) => new Set([...current, index]));
    timers.current.set(
      index,
      setTimeout(() => {
        setLit((current) => {
          const next = new Set(current);
          next.delete(index);
          return next;
        });
        timers.current.delete(index);
      }, CONFIG.padFeedbackMs),
    );
  };
  return (
    <div className="pad-instrument">
      <div className="pad-toolbar">
        <span>{layout.count}-PAD TRIGGER CONTROLLER</span>
        <label>
          Pads
          <select
            aria-label="Pad count"
            aria-describedby={`pad-count-help-${module.id}`}
            value={layout.count}
            onChange={(event) => {
              const count = PAD_LAYOUTS.find(
                (item) => item.count === Number(event.target.value),
              )?.count;
              if (count) onCount(count);
            }}
          >
            {PAD_LAYOUTS.map((item) => (
              <option key={item.count} value={item.count}>
                {item.count}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="performance-pads"
        style={{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)` }}
        role="group"
        aria-label="Pad performance grid"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          const index = PAD_SHORTCUTS.indexOf(event.key.toLowerCase());
          if (index < 0 || index >= layout.count) return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) hit(index);
        }}
      >
        {DRUM_SOUNDS.slice(0, layout.count).map((sound, index) => (
          <button
            key={sound.id}
            className={`performance-pad ${lit.has(index) ? 'lit' : ''}`}
            style={{ '--pad-color': sound.color } as CSSProperties}
            aria-label={`Trigger ${padLabel(project, module.id, index)} pad ${index + 1}`}
            title={`${padLabel(project, module.id, index)} · Pad ${index + 1} · Shortcut ${PAD_SHORTCUTS[index].toUpperCase()}`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              event.currentTarget.focus();
              hit(index);
            }}
            onClick={(event) => {
              if (event.detail === 0) hit(index);
            }}
          >
            <span className="pad-number">{String(index + 1).padStart(2, '0')}</span>
            <strong>{padLabel(project, module.id, index)}</strong>
            <kbd>{PAD_SHORTCUTS[index].toUpperCase()}</kbd>
          </button>
        ))}
      </div>
      <p className="instrument-help">ALL sends every hit · PAD outputs send one pad.</p>
      <p className="instrument-help pad-count-help" id={`pad-count-help-${module.id}`}>
        Fewer pads unplug extra outputs. Undo restores them.
      </p>
    </div>
  );
}
