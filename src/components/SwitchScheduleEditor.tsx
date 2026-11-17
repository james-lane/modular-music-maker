import { useLayoutEffect, useRef, useState } from 'react';
import { SWITCH_SCHEDULE, defaultSwitchCues } from '../domain/modules';
import { switchScheduleError, type SwitchSchedule } from '../domain/switch-schedule';
import type { PatchModule } from '../domain/types';

/** A local draft stays inside the hardware; Apply remains one validated Undo edit. */
export function SwitchScheduleEditor({
  module,
  onApply,
  onClose,
}: {
  module: PatchModule;
  onApply: (schedule: SwitchSchedule) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(() =>
    (module.switchCues ?? defaultSwitchCues()).map((cue) => ({
      id: crypto.randomUUID(),
      bar: String(cue.bar),
      input: cue.input,
    })),
  );
  const [current, setCurrent] = useState(0);
  const [repeat, setRepeat] = useState(Boolean(module.parameters.repeat));
  const [loopBars, setLoopBars] = useState(String(module.parameters.loopBars));
  const barInput = useRef<HTMLInputElement>(null);
  const row = rows[current];
  useLayoutEffect(() => {
    barInput.current?.focus({ preventScroll: true });
  }, [row.id]);
  const schedule = {
    cues: rows.map((row) => ({ bar: Number(row.bar), input: row.input })),
    repeat,
    loopBars: Number(loopBars),
  };
  const error = switchScheduleError(schedule);
  return (
    <form
      className="switch-cue-form"
      aria-label="Switch schedule"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!error) onApply(schedule);
      }}
    >
      <div className="switch-cue-navigation">
        <button
          type="button"
          aria-label="Previous cue"
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
        >
          ‹
        </button>
        <strong>
          CUE {current + 1} / {rows.length}
        </strong>
        <button
          type="button"
          aria-label="Next cue"
          disabled={current === rows.length - 1}
          onClick={() => setCurrent(current + 1)}
        >
          ›
        </button>
        <button type="button" className="switch-cue-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="switch-cue-row" key={row.id}>
        <label>
          Bar
          <input
            ref={barInput}
            type="number"
            min="1"
            max={SWITCH_SCHEDULE.maxBar}
            step="1"
            aria-label={`Cue ${current + 1} bar`}
            value={row.bar}
            onChange={(event) =>
              setRows((rows) =>
                rows.map((item) =>
                  item.id === row.id ? { ...item, bar: event.target.value } : item,
                ),
              )
            }
          />
        </label>
        <label>
          Input
          <select
            aria-label={`Cue ${current + 1} input`}
            value={row.input}
            onChange={(event) =>
              setRows((rows) =>
                rows.map((item) =>
                  item.id === row.id ? { ...item, input: Number(event.target.value) } : item,
                ),
              )
            }
          >
            {[1, 2, 3, 4].map((input) => (
              <option key={input} value={input}>
                {input}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={`Remove cue ${current + 1}`}
          title="Remove cue"
          disabled={rows.length === 1}
          onClick={() => {
            setRows((rows) => rows.filter((item) => item.id !== row.id));
            setCurrent(Math.max(0, current - 1));
          }}
        >
          ×
        </button>
      </div>
      <div className="switch-repeat-controls">
        <label>
          <input
            type="checkbox"
            checked={repeat}
            onChange={(event) => {
              setRepeat(event.target.checked);
              const length = Number(loopBars);
              if (
                !event.target.checked &&
                (!Number.isInteger(length) || length < 1 || length > SWITCH_SCHEDULE.maxBar)
              )
                setLoopBars(String(SWITCH_SCHEDULE.defaultLoopBars));
            }}
          />
          Repeat
        </label>
        <label>
          Every
          <input
            type="number"
            min="1"
            max={SWITCH_SCHEDULE.maxBar}
            step="1"
            aria-label="Repeat length in bars"
            disabled={!repeat}
            value={loopBars}
            onChange={(event) => setLoopBars(event.target.value)}
          />
          bars
        </label>
      </div>
      <p className={`switch-cue-error${error ? ' invalid' : ''}`} role="status">
        {error ?? 'Apply enables Auto. Play starts at bar 1.'}
      </p>
      <div className="switch-cue-actions">
        <button
          type="button"
          disabled={rows.length >= SWITCH_SCHEDULE.maxCues}
          onClick={() => {
            const used = new Set(rows.map((row) => Number(row.bar)));
            let bar = Math.max(...used) + 1;
            if (bar > SWITCH_SCHEDULE.maxBar) {
              bar = 1;
              while (used.has(bar)) bar++;
            }
            setRows((rows) => [...rows, { id: crypto.randomUUID(), bar: String(bar), input: 1 }]);
            setCurrent(rows.length);
          }}
        >
          Add cue
        </button>
        <button className="switch-cue-apply" type="submit" disabled={Boolean(error)}>
          Use schedule
        </button>
      </div>
    </form>
  );
}
