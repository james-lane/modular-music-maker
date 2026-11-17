import { useState } from 'react';
import { SWITCH_SCHEDULE, defaultSwitchCues } from '../domain/modules';
import { switchScheduleError, type SwitchSchedule } from '../domain/switch-schedule';
import type { PatchModule } from '../domain/types';
import { Modal } from './Dialogs';

export function SwitchScheduleDialog({
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
  const [repeat, setRepeat] = useState(Boolean(module.parameters.repeat));
  const [loopBars, setLoopBars] = useState(String(module.parameters.loopBars));
  const schedule = {
    cues: rows.map((row) => ({ bar: Number(row.bar), input: row.input })),
    repeat,
    loopBars: Number(loopBars),
  };
  const error = switchScheduleError(schedule);
  return (
    <Modal title="Arrange your changes." eyebrow="SWITCH SCHEDULE" onClose={onClose}>
      <p className="dialog-intro">
        Choose an input at each bar start. It stays selected until the next cue. Play starts again
        at bar 1.
      </p>
      <form
        className="switch-cue-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!error) onApply(schedule);
        }}
      >
        <div className="switch-cue-rows">
          {rows.map((row, index) => (
            <div className="switch-cue-row" key={row.id}>
              <label>
                Bar
                <input
                  type="number"
                  min="1"
                  max={SWITCH_SCHEDULE.maxBar}
                  step="1"
                  aria-label={`Cue ${index + 1} bar`}
                  value={row.bar}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.id === row.id ? { ...item, bar: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Input
                <select
                  aria-label={`Cue ${index + 1} input`}
                  value={row.input}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
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
                className="button"
                aria-label={`Remove cue ${index + 1}`}
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="button"
          disabled={rows.length >= SWITCH_SCHEDULE.maxCues}
          onClick={() => {
            const used = new Set(rows.map((row) => Number(row.bar)));
            let bar = Math.max(...used) + 1;
            if (bar > SWITCH_SCHEDULE.maxBar) {
              bar = 1;
              while (used.has(bar)) bar++;
            }
            setRows((current) => [
              ...current,
              { id: crypto.randomUUID(), bar: String(bar), input: 1 },
            ]);
          }}
        >
          Add cue
        </button>
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
            />{' '}
            Repeat schedule
          </label>
          <label>
            Repeat every{' '}
            <input
              type="number"
              min="1"
              max={SWITCH_SCHEDULE.maxBar}
              step="1"
              aria-label="Repeat length in bars"
              disabled={!repeat}
              value={loopBars}
              onChange={(event) => setLoopBars(event.target.value)}
            />{' '}
            bars
          </label>
        </div>
        <p className="dialog-footnote">
          {repeat
            ? 'The whole pattern repeats, including its bar 1 cue.'
            : 'After the last cue, its input stays selected.'}{' '}
          Tapping an input takes manual control. Use Auto to rejoin the current bar.
        </p>
        <p className="switch-cue-error" role="status">
          {error ?? 'Applying enables Auto. Playback starts only when you press Play.'}
        </p>
        <button className="button primary" type="submit" disabled={Boolean(error)}>
          Use schedule
        </button>
      </form>
    </Modal>
  );
}
