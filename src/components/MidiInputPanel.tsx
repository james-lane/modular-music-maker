import { useEffect, useRef, useState } from 'react';
import type { LiveControls } from '../audio/live';
import { useMidiControls } from '../hooks/useMidi';
import type { Parameters, PatchModule } from '../domain/types';
import { CONFIG } from '../config';

/** Device identity stays on this browser. Channel/CC assignments are portable
 * patch data; permission and current controller values are session-only.
 */
export function MidiInputPanel({
  module,
  live,
  onParameters,
}: {
  module: PatchModule;
  live: LiveControls;
  onParameters: (values: Parameters) => void;
}) {
  const midi = useMidiControls();
  const [values, setValues] = useState([0, 0, 0, 0]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      live.noteOff(module.id, 60, 'midi:test');
    },
    [live, module.id],
  );
  const setting = (id: string, label: string, min: number, max: number) => (
    <label key={id}>
      {label}
      <input
        aria-label={id.startsWith('cc') ? `MIDI MOD ${id.slice(2)} CC` : `MIDI ${label}`}
        type="number"
        min={min}
        max={max}
        value={Number(module.parameters[id])}
        onChange={(event) => {
          if (event.target.value === '') return;
          const value = Number(event.target.value);
          if (!Number.isInteger(value) || value < min || value > max) return;
          if (id === 'noteMin' && value > Number(module.parameters.noteMax)) return;
          if (id === 'noteMax' && value < Number(module.parameters.noteMin)) return;
          onParameters({ [id]: value });
        }}
      />
    </label>
  );
  return (
    <div className="midi-instrument">
      <div className="midi-access">
        <span role="status">
          {midi.phase === 'unsupported'
            ? 'Web MIDI unavailable in this browser'
            : midi.phase === 'enabled'
              ? `${midi.devices.length} MIDI input${midi.devices.length === 1 ? '' : 's'} available`
              : midi.phase === 'requesting'
                ? 'Waiting for MIDI permission…'
                : 'Hardware MIDI is off'}
        </span>
        <button
          disabled={midi.phase === 'unsupported' || midi.phase === 'requesting'}
          onClick={() => (midi.phase === 'enabled' ? midi.disable() : void midi.enable())}
        >
          {midi.phase === 'enabled' ? 'Disable MIDI' : 'Enable MIDI'}
        </button>
      </div>
      {midi.error && (
        <p className="midi-error" role="alert">
          {midi.error}
        </p>
      )}
      <div className="midi-device-row">
        <label>
          Input device
          <select
            aria-label="MIDI input device"
            value={midi.device(module.id)}
            onChange={(event) => midi.setDevice(module.id, event.target.value)}
          >
            <option value="">All MIDI inputs</option>
            {midi.device(module.id) &&
              !midi.devices.some((device) => device.id === midi.device(module.id)) && (
                <option value={midi.device(module.id)}>Selected input disconnected</option>
              )}
            {midi.devices.map((device) => (
              <option value={device.id} key={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Channel
          <select
            aria-label="MIDI channel"
            value={Number(module.parameters.channel)}
            onChange={(event) => onParameters({ channel: Number(event.target.value) })}
          >
            <option value={0}>All</option>
            {Array.from({ length: 16 }, (_, i) => (
              <option value={i + 1} key={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="midi-note-row">
        {setting('noteMin', 'Lowest note', 0, 127)}
        {setting('noteMax', 'Highest note', 0, 127)}
        {setting('firstNote', 'First drum note', 0, 112)}
      </div>
      <div className="midi-test-row">
        <button
          onClick={() => {
            clearTimeout(timer.current);
            live.noteOn(module.id, 60, 1, 'midi:test');
            live.midiHit(module.id, 0, 1);
            timer.current = setTimeout(
              () => live.noteOff(module.id, 60, 'midi:test'),
              CONFIG.midi.testNoteMs,
            );
          }}
        >
          Test note / hit
        </button>
        <button
          onClick={() => {
            midi.panic();
            setValues([0, 0, 0, 0]);
          }}
        >
          Release MIDI notes
        </button>
        <label>
          Velocity
          <input
            aria-label="MIDI velocity"
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={Number(module.parameters.velocity)}
            onChange={(event) => onParameters({ velocity: Number(event.target.value) })}
          />
        </label>
      </div>
      <div className="midi-cc-rows">
        {[1, 2, 3, 4].map((index) => (
          <div key={index}>
            <strong>MOD {index}</strong>
            {setting(`cc${index}`, 'CC', 0, 119)}
            <label>
              <input
                aria-label={`MOD ${index} bipolar`}
                type="checkbox"
                checked={Boolean(module.parameters[`bipolar${index}`])}
                onChange={(event) => onParameters({ [`bipolar${index}`]: event.target.checked })}
              />{' '}
              ±
            </label>
            <label className="midi-test-control">
              Test MOD {index}
              <input
                aria-label={`Test MIDI MOD ${index}`}
                type="range"
                min="0"
                max="127"
                value={values[index - 1]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setValues((current) => current.map((old, i) => (i === index - 1 ? value : old)));
                  live.midiControl(module.id, index, value);
                }}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
