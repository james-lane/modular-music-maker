import { ArrowDownToLine, AudioLines, Check, Clock3, Headphones, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CONFIG, ROOT_NOTES } from '../config';
import { deleteRecording, loadRecordings, type Recording } from '../audio/recordings';
import { downloadFile, fileSlug } from '../domain/storage';
import type { Project } from '../domain/types';
import {
  isAnimationMode,
  isCableStyle,
  isTheme,
  type AnimationMode,
  type CableStyle,
  type Theme,
} from '../domain/preferences';
import { PortGuide } from './PortGuide';
import { TempoSymbol } from './TempoIndicator';
import { RecordingItem } from './RecordingItem';
import { useRecordingExport } from '../hooks/useRecordingExport';

/** Also exposes composition controls that move out of the compact phone toolbar. */
export function SettingsDialog({
  animationMode,
  onAnimationModeChange,
  project,
  theme,
  onThemeChange,
  onChange,
  cableStyle,
  onCableStyleChange,
  cableOpacity,
  onCableOpacityChange,
  onClose,
}: {
  animationMode: AnimationMode;
  onAnimationModeChange: (mode: AnimationMode) => void;
  project: Project;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
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
          Animation
          <select
            value={animationMode}
            aria-label="Animation"
            aria-describedby="animation-description"
            onChange={(event) => {
              if (isAnimationMode(event.target.value)) onAnimationModeChange(event.target.value);
            }}
          >
            <option value="auto">Automatic</option>
            <option value="full">Full</option>
            <option value="reduced">Reduced</option>
          </select>
        </label>
        <p id="animation-description">
          Automatic reduces moving displays in patches with{' '}
          {CONFIG.appearance.reducedAnimationModuleCount} or more modules. Reduced keeps step
          lights, keys, pads, section changes and recording feedback, with simpler highlights and
          slower display updates. Sound stays the same. Remembered on this device; your device’s
          Reduce Motion preference is always respected.
        </p>
        <label>
          Theme
          <select
            value={theme}
            aria-describedby="theme-description"
            onChange={(event) => {
              if (isTheme(event.target.value)) onThemeChange(event.target.value);
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <p id="theme-description">
          System follows your device’s light or dark setting. Module colours stay the same.
          Remembered in this browser for all patches.
        </p>
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

export function RecordingsDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState(false);
  const recordingExport = useRecordingExport();
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
      <p className="recording-format-help">
        Choose WAV for editing, MP3 for sharing, or Original for the unchanged recording. Downloads
        are prepared on this device and work offline.
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
              exportActive={recordingExport.active !== null}
              exportError={
                recordingExport.error?.id === recording.id ? recordingExport.error.message : null
              }
              progress={
                recordingExport.active?.id === recording.id
                  ? recordingExport.active.progress
                  : undefined
              }
              onDownload={(format) => void recordingExport.download(recording, format)}
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
      <p className="dialog-footnote">
        <a href="/licenses/lamejs.txt" target="_blank" rel="noreferrer">
          MP3 encoder credits
        </a>
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
            'Choose More → Example patches, then press Play. Open Add modules to find instruments; use + or drag them onto the dotted workspace. Each module’s ? guide also has Load demo patch for a small, ready-wired example.',
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
            'Choose Save patch to keep an example or demo; your own patches then save automatically on this device. Export backs up a patch, and Record captures its sound. The offline status at the bottom right opens installation and offline-use help.',
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
      <section className="port-guide tempo-guide" aria-label="Following the studio tempo">
        <h3>
          <TempoSymbol /> Following the tempo
        </h3>
        <p>
          Modules marked with this metronome follow the studio’s BPM during playback. Press Play to
          run them; changing BPM changes their timing together. The marking shows an automatic link.
        </p>
        <p>
          Drum steps use 1/16 notes. Sequencer and modulation Step rate selects 1/4, 1/8 or 1/16: at
          120 BPM these last 0.5, 0.25 and 0.125 seconds.
        </p>
        <p>
          A lightning symbol on Sample &amp; Hold means TRIGGER IN is connected. Incoming hits
          choose its new values; unplug that cable to return to tempo timing.
        </p>
      </section>
      <section className="port-guide" aria-label="Web MIDI hardware controls">
        <h3>Play with MIDI hardware</h3>
        <p>
          Web MIDI lets a supported browser receive notes and control movements from a connected
          keyboard, pad controller, fader or pedal. MIDI carries instructions; Patchwork makes the
          sound.
        </p>
        <p>
          Add a <strong>MIDI Input</strong> module, connect its PITCH / GATE, TRIGGER or MOD outputs
          to compatible modules, then press <strong>Enable MIDI</strong> and allow access. Choose
          the device and channel on each instance; add more instances for different inputs or note
          ranges. Use Test note / hit and the Test MOD sliders to check wiring without hardware.
        </p>
        <p>
          Four CC assignments convert hardware knobs and faders into MOD signals. New MOD inputs
          take over their named knob over its normal range; unplugging restores the saved knob.
          LEVEL/DEPTH MOD on Oscillator, Drum machine and Envelope scales the saved strength.
          Existing Filter MOD adds to cutoff; pitch/speed MOD bends around the saved note or speed.
          Bipolar outputs allow movement in both directions, including the XY Effects axes.
        </p>
        <p>
          CC64 is sustain. Release MIDI notes clears held notes and neutralizes MOD outputs; Stop,
          disconnecting and leaving the page also release notes. Enable is optional and starts off
          after reload. Device choices stay on this browser; channel/CC assignments travel with
          saved patches. MIDI performances are captured as routed audio by Record.
        </p>
        <p>
          Web MIDI needs HTTPS or localhost and browser permission. It is available in supported
          Chrome, Edge and desktop Firefox browsers; Safari and iPad/iPhone Safari currently lack
          native support. Touch, computer keys and all other studio features remain available. There
          is no MIDI clock, SysEx or external MIDI output in this release. Each module’s guide
          explains its compatibility.
        </p>
      </section>
      <PortGuide />
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
