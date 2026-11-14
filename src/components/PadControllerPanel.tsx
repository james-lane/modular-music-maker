import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LiveControls } from '../audio/live';
import { DRUM_SOUNDS, PAD_SHORTCUTS } from '../domain/instruments';
import type { PatchModule } from '../domain/types';

export function PadControllerPanel({ module, live }: { module: PatchModule; live: LiveControls }) {
  const [lit, setLit] = useState(new Set<number>());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach((timer) => clearTimeout(timer)), []);
  const hit = (index: number) => {
    live.padHit(module.id, DRUM_SOUNDS[index].id);
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
      }, 160),
    );
  };
  return (
    <div className="pad-instrument">
      <div className="instrument-caption">
        <span>16-PAD PERCUSSION CONTROLLER</span>
        <span className="tiny-led on" />
      </div>
      <div
        className="performance-pads"
        role="group"
        aria-label="Pad performance grid"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          const index = PAD_SHORTCUTS.indexOf(event.key.toLowerCase());
          if (index < 0) return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) hit(index);
        }}
      >
        {DRUM_SOUNDS.map((sound, index) => (
          <button
            key={sound.id}
            className={`performance-pad ${lit.has(index) ? 'lit' : ''}`}
            style={{ '--pad-color': sound.color } as CSSProperties}
            aria-label={`Trigger ${sound.name} pad ${index + 1}`}
            title={`${sound.name} · Shortcut ${PAD_SHORTCUTS[index].toUpperCase()}`}
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
            <strong>{sound.short}</strong>
            <kbd>{PAD_SHORTCUTS[index].toUpperCase()}</kbd>
          </button>
        ))}
      </div>
      <p className="instrument-help">Wire TRIGGER OUT to a Drum machine.</p>
    </div>
  );
}
