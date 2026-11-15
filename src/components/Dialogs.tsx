import {
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  Check,
  Clock3,
  Download,
  FolderOpen,
  Headphones,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CONFIG, ROOT_NOTES } from '../config';
import { deleteRecording, loadRecordings, type Recording } from '../audio/recordings';
import { downloadFile, fileSlug, listAllProjects } from '../domain/storage';
import type { Project } from '../domain/types';
import { isCableStyle, type CableStyle } from '../domain/preferences';

/** Also exposes composition controls that move out of the compact phone toolbar. */
export function SettingsDialog({
  project,
  onChange,
  cableStyle,
  onCableStyleChange,
  cableOpacity,
  onCableOpacityChange,
  onClose,
}: {
  project: Project;
  onChange: (changes: Partial<Project>) => void;
  cableStyle: CableStyle;
  onCableStyleChange: (style: CableStyle) => void;
  cableOpacity: number;
  onCableOpacityChange: (opacity: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Find your own feel." eyebrow="STUDIO SETTINGS" onClose={onClose}>
      <p className="dialog-intro">
        A few small changes can take your patch somewhere completely different.
      </p>
      <div className="composition-form">
        <label>
          Root note
          <select
            value={project.rootNote}
            onChange={(event) => onChange({ rootNote: event.target.value })}
          >
            {ROOT_NOTES.map((note) => (
              <option key={note}>{note}</option>
            ))}
          </select>
        </label>
        <label>
          Scale
          <select
            value={project.scale}
            onChange={(event) => onChange({ scale: event.target.value as Project['scale'] })}
          >
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="pentatonic">Pentatonic</option>
          </select>
        </label>
        <label>
          Time signature
          <select
            value={project.timeSignature}
            onChange={(event) =>
              onChange({ timeSignature: event.target.value as Project['timeSignature'] })
            }
          >
            <option>4/4</option>
            <option>3/4</option>
            <option>6/8</option>
          </select>
        </label>
        <label>
          Master volume · {Math.round(project.masterVolume * 100)}%
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={project.masterVolume}
            onChange={(event) => onChange({ masterVolume: Number(event.target.value) })}
          />
        </label>
      </div>
      <p className="dialog-footnote">
        The eight-step pattern repeats independently of the time signature.
      </p>
      <div className="appearance-settings composition-form">
        <label>
          Patch cable style
          <select
            value={cableStyle}
            aria-describedby="cable-style-description"
            onChange={(event) => {
              if (isCableStyle(event.target.value)) onCableStyleChange(event.target.value);
            }}
          >
            <option value="classic">Classic colours</option>
            <option value="braided">Braided module colours</option>
          </select>
        </label>
        <p id="cable-style-description">
          Braided cables weave together the enclosure colours of both connected modules. This
          appearance choice is remembered in this browser for all patches.
        </p>
        <label>
          Patch cable opacity · {Math.round(cableOpacity * 100)}%
          <input
            type="range"
            min={CONFIG.appearance.cableOpacity.min}
            max={CONFIG.appearance.cableOpacity.max}
            step={CONFIG.appearance.cableOpacity.step}
            value={cableOpacity}
            aria-valuetext={`${Math.round(cableOpacity * 100)}%`}
            aria-describedby="cable-opacity-description"
            onChange={(event) => onCableOpacityChange(Number(event.target.value))}
          />
        </label>
        <p id="cable-opacity-description">
          Fade connected cables to see the controls beneath them, or hide them at 0%. New cables
          stay visible while connecting. Remembered in this browser for all patches.
        </p>
      </div>
      <button className="button primary full-width" style={{ marginTop: 20 }} onClick={onClose}>
        <Check size={16} /> Back to the studio
      </button>
    </Modal>
  );
}

/** Native dialog provides focus trapping, Escape and inert background behavior. */
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  className = '',
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      // Close before React removes the dialog, then return keyboard focus to its opener.
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`studio-dialog ${wide ? 'wide' : ''} ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <span className="eyebrow">{eyebrow}</span>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
        <h2 id={titleId}>{title}</h2>
      </div>
      {children}
    </dialog>
  );
}

export function PatchLibraryDialog({
  onClose,
  onOpen,
  onNew,
  onImport,
  notify,
}: {
  onClose: () => void;
  onOpen: (project: Project) => void;
  onNew: () => void;
  onImport: () => void;
  notify: (message: string) => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => {
    let active = true;
    void listAllProjects()
      .then((result) => {
        if (active) setProjects(result);
      })
      .catch(() => {
        if (active) setProjects([]);
        notify('The patch library could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [notify]);
  return (
    <Modal title="Your little collection." eyebrow="MY PATCHES" onClose={onClose} wide>
      <p className="dialog-intro">
        Good ideas deserve another listen. Your patches are saved on this device.
      </p>
      <div className="dialog-toolbar">
        <button className="button primary" onClick={onNew}>
          <Plus size={16} /> New patch
        </button>
        <button className="button" onClick={onImport}>
          <Upload size={16} /> Import patch
        </button>
      </div>
      <div className="saved-patches">
        {projects === null ? (
          <p className="dialog-empty">Opening your patch collection…</p>
        ) : !projects.length ? (
          <p className="dialog-empty">Your first patch is waiting to happen.</p>
        ) : (
          projects.map((project) => (
            <button className="saved-patch" key={project.id} onClick={() => onOpen(project)}>
              <span className="saved-patch-art">
                <AudioLines size={27} />
              </span>
              <span>
                <strong>{project.name}</strong>
                <small>
                  {project.modules.length} modules · {project.tempo} BPM · {project.rootNote}{' '}
                  {project.scale}
                </small>
                <em>
                  {new Date(project.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </em>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))
        )}
      </div>
      <p className="dialog-footnote">
        <FolderOpen size={14} /> Export a patch to keep a portable backup or share it with a friend.
      </p>
    </Modal>
  );
}

function RecordingItem({ recording, onDelete }: { recording: Recording; onDelete: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(recording.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [recording.blob]);
  return (
    <div className="recording-item">
      <div className="recording-title">
        <Headphones size={19} />
        <div>
          <strong>{recording.name}</strong>
          <small>
            {Math.floor(recording.duration / 60)}:
            {String(Math.floor(recording.duration % 60)).padStart(2, '0')} ·{' '}
            {new Date(recording.createdAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </small>
        </div>
        <button
          className="icon-button"
          title="Download recording"
          aria-label={`Download ${recording.name} recording`}
          onClick={() =>
            downloadFile(
              recording.blob,
              `${fileSlug(recording.name)}-${recording.id.slice(0, 6)}.${recording.extension}`,
            )
          }
        >
          <Download size={17} />
        </button>
        <button
          className="icon-button"
          title="Delete recording"
          aria-label={`Delete ${recording.name} recording`}
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <audio src={url || undefined} controls preload="metadata" />
    </div>
  );
}

export function RecordingsDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void loadRecordings()
      .then((result) => {
        if (active) setRecordings(result);
      })
      .catch(() => {
        if (active) {
          setRecordings([]);
          setError(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Modal title="Keep the happy accidents." eyebrow="RECORDINGS" onClose={onClose}>
      <p className="dialog-intro">
        Your live takes, just as you played them. Listen back or take them with you.
      </p>
      <div className="recordings-list">
        {recordings === null ? (
          <p className="dialog-empty">Loading your recordings…</p>
        ) : !recordings.length ? (
          <div className="recordings-empty">
            <span>
              <Headphones size={30} />
            </span>
            <h3>{error ? 'Recording storage is unavailable' : 'Your first take starts here.'}</h3>
            <p>
              {error
                ? 'Try allowing browser storage for this site.'
                : 'Press Record in the studio, make some noise, then press it again to save your take.'}
            </p>
          </div>
        ) : (
          recordings.map((recording) => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              onDelete={() => {
                void deleteRecording(recording.id)
                  .then(() =>
                    setRecordings((current) => current!.filter((item) => item.id !== recording.id)),
                  )
                  .catch(() => notify('This recording could not be deleted.'));
              }}
            />
          ))
        )}
      </div>
      <p className="dialog-footnote">
        <Clock3 size={14} /> Up to 10 minutes per take. Saved in this browser until you delete them.
      </p>
    </Modal>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Make something only you could."
      eyebrow="WELCOME TO PATCHWORK"
      onClose={onClose}
      wide
    >
      <p className="dialog-intro">
        A playground for sound, inspired by the instruments that started it all. No perfect notes
        required.
      </p>
      <div className="help-steps">
        {[
          [
            '01',
            'Start with a sound',
            'Choose More → Example patches, then press Play. Open Add modules to find instruments; use + or drag them onto the dotted workspace.',
          ],
          [
            '02',
            'Follow the cables',
            'Click an output socket, then a matching input. Match audio, pitch, modulation, trigger, or kit sockets. Drum kit KIT OUT goes to Drum machine KIT IN. Keyboard pitch goes to an Oscillator; pad triggers go to a Drum machine. Click a connected input or double-click a cable to unplug it.',
          ],
          [
            '03',
            'Get your hands on it',
            'Pinch the workspace to zoom, or drag its empty background with one finger to pan. Drag knobs up and down; arrow keys also adjust them. Hold Shift for finer dragging. Double-click resets a knob. Tap sequencer steps to cycle notes, or swipe up/down to raise/lower them; arrow keys also adjust a step, and right-click inserts a rest.',
          ],
          [
            '04',
            'Keep a little magic',
            'Your patch saves automatically on this device. Export backs up a patch; Record captures the sound for playback and download. Open More → Use offline / install to save the studio for use without a connection.',
          ],
        ].map(([number, title, description]) => (
          <div key={number}>
            <span>{number}</span>
            <section>
              <h3>{title}</h3>
              <p>{description}</p>
            </section>
          </div>
        ))}
      </div>
      <div className="shortcut-list">
        <span>
          <kbd>Space</kbd> Play / stop
        </span>
        <span>
          <kbd>⌘ / Ctrl S</kbd> Save
        </span>
        <span>
          <kbd>⌘ / Ctrl Z</kbd> Undo
        </span>
        <span>
          <kbd>⌘ / Ctrl Shift Z · Ctrl Y</kbd> Redo
        </span>
      </div>
      <button className="button primary help-done" onClick={onClose}>
        <Check size={16} /> Let’s make some noise
      </button>
    </Modal>
  );
}

export function ExportDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  return (
    <Modal title="Take your ideas with you." eyebrow="EXPORT PATCH" onClose={onClose}>
      <p className="dialog-intro">
        Download your modules, cable connections, notes, and settings as a reusable Patchwork file.
      </p>
      <div className="export-summary">
        <AudioLines size={28} />
        <div>
          <strong>{project.name}</strong>
          <span>
            {project.modules.length} modules · {project.cables.length} cables · {project.tempo} BPM
          </span>
        </div>
        <span className="file-type">.json</span>
      </div>
      <button
        className="button primary full-width"
        onClick={() => {
          downloadFile(
            new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
            `${fileSlug(project.name)}.patchwork.json`,
          );
          onClose();
        }}
      >
        <ArrowDownToLine size={17} /> Download patch
      </button>
      <p className="dialog-footnote">
        Looking for the audio? Open Recordings to download your live takes.
      </p>
    </Modal>
  );
}
