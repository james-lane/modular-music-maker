import {
  ArrowDownToLine,
  AudioLines,
  FolderOpen,
  Headphones,
  CircleHelp,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Square,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CONFIG, ROOT_NOTES } from '../config';
import type { Project } from '../domain/types';
import type { useAudio } from '../hooks/useAudio';
import type { useStudio } from '../hooks/useStudio';

interface Props {
  project: Project;
  commit: ReturnType<typeof useStudio>['commit'];
  audio: ReturnType<typeof useAudio>;
  saving: boolean;
  onSave: () => Promise<void>;
  onExport: () => void;
  onNew: () => void;
  onImport: () => void;
  onExamples: () => void;
  onSettings: () => void;
  onOffline: () => void;
  onPatches: () => void;
  onRecordings: () => void;
  onHelp: () => void;
  recordingCount: number;
}

/** Composition controls own temporary input text; the domain only receives valid values. */
export function TransportBar({
  project,
  commit,
  audio,
  saving,
  onSave,
  onExport,
  onNew,
  onImport,
  onExamples,
  onSettings,
  onOffline,
  onPatches,
  onRecordings,
  onHelp,
  recordingCount,
}: Props) {
  const [tempoDraft, setTempoDraft] = useState(String(project.tempo));
  const [moreOpen, setMoreOpen] = useState(false);
  const previousVolume = useRef(project.masterVolume || CONFIG.audio.defaultMasterVolume);
  useEffect(() => {
    setTempoDraft(String(project.tempo));
  }, [project.tempo]);
  return (
    <section
      className="transport-bar"
      aria-label="Composition and playback controls"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && moreOpen) {
          setMoreOpen(false);
          event.currentTarget
            .querySelector<HTMLButtonElement>('[aria-label="More patch actions"]')
            ?.focus();
        }
      }}
    >
      <div className="transport-buttons">
        <button
          className={`play-button ${audio.active ? 'playing' : ''}`}
          disabled={audio.starting}
          onClick={() => void (audio.active ? audio.stop() : audio.play())}
          aria-label={audio.active ? 'Stop playback' : 'Play patch'}
        >
          {audio.active ? (
            <Square size={15} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
          <span>{audio.starting ? 'Starting' : audio.active ? 'Stop' : 'Play'}</span>
        </button>
        <button
          className={`record-button ${audio.recording ? 'recording' : ''}`}
          onClick={() => void audio.toggleRecord()}
          aria-label={audio.recording ? 'Stop recording and save take' : 'Record patch'}
        >
          <span className="record-dot" />
          {audio.recording
            ? `${Math.floor(audio.recordingSeconds / 60)}:${String(audio.recordingSeconds % 60).padStart(2, '0')}`
            : 'Record'}
        </button>
      </div>
      <div className="transport-divider" />
      <label className="tempo-control">
        <span className="transport-label">TEMPO</span>
        <div>
          <input
            type="number"
            aria-label="Tempo in beats per minute"
            min={CONFIG.tempo.min}
            max={CONFIG.tempo.max}
            value={tempoDraft}
            onChange={(event) => {
              setTempoDraft(event.target.value);
              const value = Number(event.target.value);
              if (value >= CONFIG.tempo.min && value <= CONFIG.tempo.max)
                commit((current) => ({ ...current, tempo: value }), 'tempo');
            }}
            onBlur={() => {
              const value = Math.max(
                CONFIG.tempo.min,
                Math.min(CONFIG.tempo.max, Number(tempoDraft) || project.tempo),
              );
              setTempoDraft(String(value));
              commit((current) => ({ ...current, tempo: value }), 'tempo');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span>BPM</span>
          <span className="tempo-arrows">
            <button
              aria-label="Increase tempo"
              onClick={() =>
                commit(
                  (current) => ({
                    ...current,
                    tempo: Math.min(CONFIG.tempo.max, current.tempo + 1),
                  }),
                  'tempo',
                )
              }
            >
              ⌃
            </button>
            <button
              aria-label="Decrease tempo"
              onClick={() =>
                commit(
                  (current) => ({
                    ...current,
                    tempo: Math.max(CONFIG.tempo.min, current.tempo - 1),
                  }),
                  'tempo',
                )
              }
            >
              ⌄
            </button>
          </span>
        </div>
      </label>
      <div className="transport-divider small" />
      <label className="composition-select">
        <span className="transport-label">KEY & SCALE</span>
        <div>
          <select
            aria-label="Root note"
            value={project.rootNote}
            onChange={(event) =>
              commit((current) => ({ ...current, rootNote: event.target.value }))
            }
          >
            {ROOT_NOTES.map((note) => (
              <option key={note}>{note}</option>
            ))}
          </select>
          <select
            aria-label="Scale"
            value={project.scale}
            onChange={(event) =>
              commit((current) => ({ ...current, scale: event.target.value as Project['scale'] }))
            }
          >
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="pentatonic">Pentatonic</option>
          </select>
        </div>
      </label>
      <label className="composition-select time-signature">
        <span className="transport-label">TIME</span>
        <select
          aria-label="Time signature"
          value={project.timeSignature}
          onChange={(event) =>
            commit((current) => ({
              ...current,
              timeSignature: event.target.value as Project['timeSignature'],
            }))
          }
        >
          <option>4/4</option>
          <option>3/4</option>
          <option>6/8</option>
        </select>
      </label>
      <div className="beat-indicators" title="Beat in the current bar">
        {Array.from({ length: project.timeSignature === '4/4' ? 4 : 3 }, (_, index) => (
          <i key={index} className={audio.playing && audio.beat === index ? 'active' : ''} />
        ))}
      </div>
      <div className="transport-spacer" />
      <div className="master-volume">
        <button
          className="icon-button"
          aria-label={project.masterVolume ? 'Mute output' : 'Unmute output'}
          onClick={() => {
            if (project.masterVolume) previousVolume.current = project.masterVolume;
            commit((current) => ({
              ...current,
              masterVolume: current.masterVolume ? 0 : previousVolume.current,
            }));
          }}
        >
          {project.masterVolume ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <input
          aria-label="Master volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={project.masterVolume}
          onChange={(event) =>
            commit(
              (current) => ({ ...current, masterVolume: Number(event.target.value) }),
              'masterVolume',
            )
          }
        />
      </div>
      <div className="transport-divider" />
      <button className="button export-button" onClick={() => onExport()}>
        <ArrowDownToLine size={15} /> Export
      </button>
      <button
        className="button primary save-button"
        disabled={saving}
        onClick={() => void onSave()}
      >
        <Save size={15} />
        {saving ? 'Saving…' : 'Save patch'}
      </button>
      <div className="more-container">
        <button
          className="icon-button"
          aria-label="More patch actions"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((value) => !value)}
        >
          <MoreHorizontal size={20} />
        </button>
        {moreOpen && (
          <>
            <div className="menu-dismiss" onClick={() => setMoreOpen(false)} />
            <div className="more-menu">
              <button
                disabled={saving}
                onClick={() => {
                  setMoreOpen(false);
                  void onSave();
                }}
              >
                <Save size={15} /> {saving ? 'Saving…' : 'Save patch'}
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onPatches();
                }}
              >
                <FolderOpen size={15} /> My patches
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onRecordings();
                }}
              >
                <Headphones size={15} /> Recordings{' '}
                {recordingCount > 0 && <span className="count-badge">{recordingCount}</span>}
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onHelp();
                }}
              >
                <CircleHelp size={15} /> Getting started
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onOffline();
                }}
              >
                <WifiOff size={15} /> Use offline / install
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onSettings();
                }}
              >
                <SlidersHorizontal size={15} /> Studio settings
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onExport();
                }}
              >
                <ArrowDownToLine size={15} /> Export patch
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onNew();
                }}
              >
                <Plus size={15} /> New empty patch
              </button>
              <button
                onClick={() => {
                  onImport();
                  setMoreOpen(false);
                }}
              >
                <FolderOpen size={15} /> Import patch
              </button>
              <button
                onClick={() => {
                  onExamples();
                  setMoreOpen(false);
                }}
              >
                <AudioLines size={15} /> Example patches
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
