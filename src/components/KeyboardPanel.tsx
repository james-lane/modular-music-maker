import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LiveControls } from '../audio/live';
import {
  KEYBOARD_BASE_MIDI,
  KEYBOARD_NOTE_COUNT,
  KEYBOARD_SHORTCUTS,
  midiLabel,
} from '../domain/instruments';
import type { PatchModule } from '../domain/types';

/** Pointer capture, key-up, focus loss and window blur all have explicit note-off paths. */
export function KeyboardPanel({ module, live }: { module: PatchModule; live: LiveControls }) {
  const held = useRef(new Map<string, number>());
  const tapTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [notes, setNotes] = useState<number[]>([]);
  const releaseAll = useRef(() => {});
  releaseAll.current = () => {
    held.current.clear();
    setNotes([]);
    live.releaseKeyboard(module.id);
  };

  useEffect(() => {
    const release = () => releaseAll.current();
    const visibility = () => {
      if (document.hidden) release();
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
      tapTimers.current.forEach((timer) => clearTimeout(timer));
      release();
    };
  }, []);

  const press = (token: string, note: number) => {
    if (held.current.has(token)) return;
    held.current.set(token, note);
    setNotes([...held.current.values()]);
    live.noteOn(module.id, note);
  };
  const release = (token: string) => {
    const note = held.current.get(token);
    held.current.delete(token);
    setNotes([...held.current.values()]);
    if (note !== undefined && ![...held.current.values()].includes(note))
      live.noteOff(module.id, note);
  };
  let whitePosition = -1;
  const keys = Array.from({ length: KEYBOARD_NOTE_COUNT }, (_, offset) => {
    const note = KEYBOARD_BASE_MIDI + offset;
    const black = [1, 3, 6, 8, 10].includes(note % 12);
    if (!black) whitePosition++;
    return {
      note,
      black,
      position: black ? whitePosition + 1 : whitePosition,
      shortcut: KEYBOARD_SHORTCUTS[offset],
    };
  });
  const shifted = (note: number) => note + Number(module.parameters.octave) * 12;
  return (
    <div className="keyboard-instrument">
      <div className="keyboard-readout">
        <span>CHROMATIC · 25 KEYS</span>
        <strong>
          {notes.length
            ? midiLabel(shifted(notes.at(-1)!))
            : `${midiLabel(shifted(KEYBOARD_BASE_MIDI))} — ${midiLabel(shifted(KEYBOARD_BASE_MIDI + 24))}`}
        </strong>
        <i className={`tiny-led ${notes.length ? 'on' : ''}`} />
      </div>
      <div
        className="piano-keybed"
        role="group"
        aria-label="Keyboard performance keys"
        tabIndex={0}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) releaseAll.current();
        }}
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          const offset = KEYBOARD_SHORTCUTS.indexOf(event.key.toLowerCase());
          if (offset < 0) return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) press(`key:${event.code}`, KEYBOARD_BASE_MIDI + offset);
        }}
        onKeyUp={(event) => {
          if (held.current.has(`key:${event.code}`)) {
            event.preventDefault();
            event.stopPropagation();
            release(`key:${event.code}`);
          }
        }}
      >
        {keys.map(({ note, black, position, shortcut }) => (
          <button
            key={note}
            className={`piano-key ${black ? 'black-key' : 'white-key'} ${notes.includes(note) ? 'held' : ''}`}
            style={{ '--key-position': position } as CSSProperties}
            aria-label={`Play ${midiLabel(shifted(note))}${shortcut ? ` (${shortcut.toUpperCase()})` : ''}`}
            aria-pressed={notes.includes(note)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              press(`pointer:${event.pointerId}`, note);
            }}
            onPointerUp={(event) => release(`pointer:${event.pointerId}`)}
            onPointerCancel={(event) => release(`pointer:${event.pointerId}`)}
            onLostPointerCapture={(event) => release(`pointer:${event.pointerId}`)}
            onClick={(event) => {
              if (event.detail === 0) {
                const token = `tap:${crypto.randomUUID()}`;
                press(token, note);
                const timer = setTimeout(() => {
                  release(token);
                  tapTimers.current.delete(timer);
                }, 180);
                tapTimers.current.add(timer);
              }
            }}
          >
            {!black && (
              <span>{note % 12 === 0 ? midiLabel(shifted(note)) : shortcut?.toUpperCase()}</span>
            )}
          </button>
        ))}
      </div>
      <p className="instrument-help">
        Focus the keys, then play <kbd>A W S E D F…</kbd> · Last note takes priority
      </p>
    </div>
  );
}
