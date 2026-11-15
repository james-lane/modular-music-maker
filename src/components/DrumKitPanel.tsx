import { useEffect, useRef, useState } from 'react';
import { importDrumSample } from '../audio/sample-import';
import type { LiveControls } from '../audio/live';
import { DRUM_LANES, DRUM_SOUNDS, type DrumLane } from '../domain/instruments';
import type { DrumSample, PatchModule, Project } from '../domain/types';

export function DrumKitPanel({
  module,
  project,
  live,
  onParameter,
  onSample,
}: {
  module: PatchModule;
  project: Project;
  live: LiveControls;
  onParameter: (id: string, value: string) => void;
  onSample: (lane: DrumLane, sample: DrumSample | null) => boolean;
}) {
  const [busy, setBusy] = useState<DrumLane | null>(null);
  const [message, setMessage] = useState('Samples: up to 4 seconds · saved in your patch');
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const connected = project.cables.some(
    (cable) => cable.from.moduleId === module.id && cable.from.portId === 'kit',
  );
  const load = async (lane: DrumLane, file: File) => {
    const token = ++generation.current;
    setBusy(lane);
    try {
      const sample = await importDrumSample(file);
      if (token !== generation.current) return;
      if (!onSample(lane, sample))
        throw new Error(
          'This sample exceeds the patch storage limit. Remove an unused sample first.',
        );
      setMessage(`${sample.name} loaded. Use the voice button to hear it.`);
    } catch (error) {
      if (token === generation.current)
        setMessage(error instanceof Error ? error.message : 'Unable to import sample.');
    } finally {
      if (token === generation.current) setBusy(null);
    }
  };
  return (
    <div className="kit-instrument">
      <div className="kit-badge">
        <strong>VOICE CARTRIDGE</strong>
        <span className={connected ? 'wired' : ''}>
          <i />
          {connected ? 'KIT LINKED' : 'CONNECT KIT OUT'}
        </span>
      </div>
      <div className="kit-voices">
        {DRUM_LANES.map((lane, index) => {
          const source = String(module.parameters[lane]);
          const sample = module.samples?.[lane];
          const inputConnected = project.cables.some(
            (cable) => cable.to.moduleId === module.id && cable.to.portId === lane,
          );
          return (
            <div className="kit-voice" key={lane}>
              <button
                className="kit-audition"
                disabled={!connected}
                title={
                  connected
                    ? 'Audition through the connected drum machine'
                    : 'Connect KIT OUT to a Drum machine first'
                }
                aria-label={`Audition voice ${index + 1}`}
                onClick={() => live.drumHit(module.id, lane)}
              >
                <small>VOICE</small>
                <strong>0{index + 1}</strong>
                <span>▶</span>
              </button>
              <div className="kit-choice">
                <select
                  aria-label={`Voice ${index + 1} sound`}
                  value={source}
                  disabled={busy === lane}
                  onChange={(event) => onParameter(lane, event.target.value)}
                >
                  <optgroup label="Built-in percussion">
                    {DRUM_SOUNDS.map((sound) => (
                      <option key={sound.id} value={sound.id}>
                        {sound.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Your sounds">
                    <option value="sample">Imported sample</option>
                    <option value="input">Audio input {index + 1}</option>
                  </optgroup>
                </select>
                {source === 'sample' ? (
                  <div className="kit-sample-tools">
                    <label className="kit-load">
                      {busy === lane ? 'Loading…' : sample ? 'Replace' : 'Load audio'}
                      <input
                        type="file"
                        accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
                        disabled={busy !== null}
                        aria-label={`Load voice ${index + 1} sample`}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void load(lane, file);
                        }}
                      />
                    </label>
                    <span title={sample?.name}>{sample?.name ?? 'No sample loaded'}</span>
                    {sample && (
                      <button
                        aria-label={`Remove voice ${index + 1} sample`}
                        onClick={() => onSample(lane, null)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ) : (
                  <small>
                    {source === 'input'
                      ? `${inputConnected ? '● Patched' : '○ Connect a source'} to IN ${index + 1}`
                      : 'INTERNAL PERCUSSION'}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="kit-message" role="status">
        {message}
      </p>
    </div>
  );
}
