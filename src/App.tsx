import { Cable, Check, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadRecordings } from './audio/recordings';
import { AppVersion } from './components/AppVersion';
import {
  ExportDialog,
  HelpDialog,
  PatchLibraryDialog,
  RecordingsDialog,
  SettingsDialog,
} from './components/Dialogs';
import { ModuleLibrary } from './components/ModuleLibrary';
import type { ModuleLibraryDrag } from './hooks/useModuleLibraryDrag';
import { ModuleHelpDialog } from './components/ModuleHelpDialog';
import { ExamplePatchesDialog } from './components/ExamplePatchesDialog';
import { OfflineDialog, OfflineIndicator } from './components/OfflineDialog';
import { UpdateNotice } from './components/UpdateNotice';
import { Workspace } from './components/Workspace';
import { CONFIG } from './config';
import { historyShortcut } from './domain/history';
import { StudioHeader, type StudioDialog } from './components/StudioHeader';
import { TransportBar } from './components/TransportBar';
import { MODULES } from './domain/modules';
import {
  loadCableOpacity,
  loadCableStyle,
  saveCableOpacity,
  saveCableStyle,
  saveTheme,
  type CableStyle,
} from './domain/preferences';
import { createModule, createProject } from './domain/project';
import { findOpenPosition, type Point } from './domain/workspace';
import { saveLocally, saveToServer } from './domain/storage';
import type { ModuleType, Project } from './domain/types';
import { parseProject } from './domain/validation';
import { useAudio } from './hooks/useAudio';
import { useMicrophoneSampler } from './hooks/useMicrophoneSampler';
import { useStudio } from './hooks/useStudio';
import { useOffline } from './hooks/useOffline';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const studio = useStudio();
  const offline = useOffline();
  const { theme, setTheme } = useTheme();
  const { project, commit } = studio;
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const microphone = useMicrophoneSampler(project, studio.setSample, notify);
  const playback = useAudio(project, notify);
  const stop = async () => {
    microphone.cancel();
    await playback.stop();
  };
  const audio = { ...playback, stop, active: playback.active || microphone.phase !== 'idle' };
  const updateBlockedReason =
    microphone.phase !== 'idle'
      ? 'Finish or cancel microphone capture before refreshing.'
      : audio.recordingPending || audio.recording
        ? 'Finish recording and wait for your take to save before refreshing.'
        : audio.active || audio.starting
          ? 'Stop playback before refreshing.'
          : '';
  const applyUpdate = () => {
    if (updateBlockedReason || audio.engine.isActive) return;
    void offline.applyUpdate(studio.flush);
  };
  const [dialog, setDialog] = useState<StudioDialog>(studio.isFirstVisit ? 'examples' : null);
  const [guideType, setGuideType] = useState<ModuleType | null>(null);
  const [focused, setFocused] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryDrag, setLibraryDrag] = useState<ModuleLibraryDrag | null>(null);
  const workspaceCentre = useRef<Point>({ x: 600, y: 400 });
  const viewCentreChanged = useCallback((point: Point) => {
    workspaceCentre.current = point;
  }, []);
  const finishLibraryDrag = useCallback((added: boolean) => {
    setLibraryDrag(null);
    if (added) {
      setLibraryOpen(false);
      document.querySelector<HTMLDivElement>('.canvas-viewport')?.focus({ preventScroll: true });
    }
  }, []);
  const [recordingCount, setRecordingCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [cableStyle, setCableStyle] = useState(loadCableStyle);
  const [cableOpacity, setCableOpacity] = useState(loadCableOpacity);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadRecordings()
      .then((items) => setRecordingCount(items.length))
      .catch(() => {});
  }, [audio.recordingVersion, dialog]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      saveLocally(project);
      const onServer = await saveToServer(project);
      notify(
        onServer
          ? 'Patch saved to this browser and your Node server.'
          : 'Patch saved on this device. Export it for a portable backup.',
      );
    } catch {
      notify('Browser storage is full or unavailable. Export your patch to keep a copy.');
    } finally {
      setSaving(false);
    }
  }, [project, notify]);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (offline.applying) return;
      const editing =
        event.target instanceof HTMLElement &&
        Boolean(
          event.target.closest(
            'input, select, textarea, [contenteditable], [role="slider"], .piano-keybed, .performance-pads',
          ),
        );
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
        return;
      }
      // Text fields keep native text undo; sliders, selects and instruments use patch history.
      const textEditing =
        event.target instanceof HTMLElement &&
        Boolean(
          event.target.closest(
            'textarea, input:not([type="range"]), [contenteditable]:not([contenteditable="false"])',
          ),
        );
      const historyAction = historyShortcut(event);
      if (historyAction && !textEditing && (!dialog || dialog === 'settings')) {
        event.preventDefault();
        if (historyAction === 'redo') studio.redo();
        else studio.undo();
        return;
      }
      if (editing || dialog) return;
      if (event.code === 'Space') {
        // A focused button keeps its native Space activation (for example drum audition).
        if (event.target instanceof HTMLElement && event.target.closest('button')) return;
        event.preventDefault();
        if (!event.repeat) void (audio.active ? audio.stop() : audio.play());
      }
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, [audio, studio, save, dialog, offline.applying]);

  const closeLibrary = () => {
    setLibraryDrag(null);
    setLibraryOpen(false);
    document.querySelector<HTMLButtonElement>('.library-toggle')?.focus();
  };

  const addModule = (type: ModuleType) => {
    const definition = MODULES[type];
    if (project.modules.length >= CONFIG.maxModules) {
      notify(`A patch can have up to ${CONFIG.maxModules} modules.`);
      return;
    }
    if (
      definition.maxInstances &&
      project.modules.filter((module) => module.type === type).length >= definition.maxInstances
    ) {
      notify('Your patch already has an Output module. Use a Merger or Mixer to combine sounds.');
      return;
    }
    const { x, y } = findOpenPosition(type, project.modules, workspaceCentre.current);
    commit((current) => ({ ...current, modules: [...current.modules, createModule(type, x, y)] }));
    closeLibrary();
    notify(`${definition.name} added. Connect a cable to bring it into your patch.`);
  };

  const openProject = async (next: Project) => {
    await audio.stop();
    studio.openProject(next);
    setDialog(null);
  };
  const newProject = () => {
    void openProject(createProject(true));
  };
  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > CONFIG.maxPatchBytes)
        throw new Error('This patch is too large. The limit is 2 MB.');
      const imported = parseProject(JSON.parse(await file.text()));
      // Import a copy so opening a shared file cannot silently overwrite an existing patch.
      await openProject({
        ...imported,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      });
      notify('Patch imported. Make it your own.');
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? 'This file is not valid JSON.'
          : error instanceof Error && error.message.includes('too large')
            ? error.message
            : 'This patch is invalid or uses an unsupported version.',
      );
    }
    if (importInput.current) importInput.current.value = '';
  };

  return (
    <div
      className={`studio-app ${focused ? 'workspace-focused' : ''}`}
      onPointerDownCapture={studio.beginInteraction}
      onKeyDownCapture={(event) => {
        if (
          event.repeat ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.nativeEvent.isComposing
        )
          return;
        if (
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) &&
          event.target instanceof HTMLElement &&
          event.target.closest('[role="slider"], input[type="range"], .step-button, .xy-pad')
        )
          studio.beginInteraction();
      }}
    >
      <div className="studio-toolbar" inert={offline.applying}>
        <StudioHeader />
        <TransportBar
          project={project}
          commit={commit}
          audio={audio}
          saving={saving}
          onSave={save}
          onExport={() => setDialog('export')}
          onNew={newProject}
          onImport={() => importInput.current?.click()}
          onExamples={() => setDialog('examples')}
          onSettings={() => setDialog('settings')}
          onOffline={() => setDialog('offline')}
          onPatches={() => setDialog('patches')}
          onRecordings={() => setDialog('recordings')}
          onHelp={() => setDialog('help')}
          recordingCount={recordingCount}
        />
      </div>
      <div
        className={`studio-body ${libraryDrag ? 'library-dragging' : ''}`}
        inert={offline.applying}
      >
        {libraryOpen && (
          <button
            className="library-dismiss"
            aria-label="Dismiss module library"
            onClick={closeLibrary}
          />
        )}
        <ModuleLibrary
          drag={libraryDrag}
          onDragChange={setLibraryDrag}
          onAdd={addModule}
          onHelp={() => setDialog('help')}
          onModuleHelp={(type) => {
            setGuideType(type);
            setDialog('module-help');
          }}
          open={libraryOpen}
          onClose={closeLibrary}
        />
        <Workspace
          {...studio}
          notify={notify}
          microphone={microphone}
          engine={audio.engine}
          playing={audio.playing}
          step={audio.step}
          drumStep={audio.drumStep}
          live={audio.live}
          audioActive={playback.active}
          cableStyle={cableStyle}
          cableOpacity={cableOpacity}
          libraryDrag={libraryDrag}
          onLibraryDragFinish={finishLibraryDrag}
          onViewCentreChange={viewCentreChanged}
          libraryOpen={libraryOpen}
          onLibraryToggle={() => setLibraryOpen((open) => !open)}
          focused={focused}
          onFocusToggle={() => setFocused((value) => !value)}
        />
      </div>
      <footer className="status-bar" inert={offline.applying}>
        <div>
          <span className={`status-led ${audio.active ? 'playing' : ''}`} />
          <span>
            {microphone.phase !== 'idle'
              ? 'Capturing a microphone snippet'
              : audio.recording
                ? 'Recording your next happy accident'
                : audio.active
                  ? 'Sound is flowing'
                  : 'Ready when you are'}
          </span>
          <span className="status-separator" />
          <span>{project.modules.length} modules</span>
          <span className="status-cables">
            <Cable size={13} />
            {project.cables.length} connections
          </span>
        </div>
        <div>
          <OfflineIndicator offline={offline} onOpen={() => setDialog('offline')} />
          <span className="audio-spec">
            {audio.playing ? `${(audio.engine.sampleRate / 1000).toFixed(1)} kHz` : 'WEB AUDIO'}
          </span>
          <AppVersion />
        </div>
      </footer>
      <UpdateNotice offline={offline} blockedReason={updateBlockedReason} onApply={applyUpdate} />
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'offline' && (
        <OfflineDialog
          offline={offline}
          blockedReason={updateBlockedReason}
          onApply={applyUpdate}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'examples' && (
        <ExamplePatchesDialog onOpen={openProject} onClose={() => setDialog(null)} />
      )}
      {dialog === 'module-help' && guideType && (
        <ModuleHelpDialog initialType={guideType} onClose={() => setDialog(null)} />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          project={project}
          theme={theme}
          onThemeChange={(next) => {
            setTheme(next);
            if (!saveTheme(next))
              notify('Theme changed for this visit. Browser storage is unavailable.');
          }}
          onClose={() => setDialog(null)}
          onChange={(changes) => commit((current) => ({ ...current, ...changes }))}
          cableStyle={cableStyle}
          cableOpacity={cableOpacity}
          onCableOpacityChange={(opacity) => {
            setCableOpacity(opacity);
            if (!saveCableOpacity(opacity))
              notify('Cable opacity changed for this visit. Browser storage is unavailable.');
          }}
          onCableStyleChange={(style: CableStyle) => {
            setCableStyle(style);
            if (!saveCableStyle(style))
              notify('Cable style changed for this visit. Browser storage is unavailable.');
          }}
        />
      )}
      {dialog === 'patches' && (
        <PatchLibraryDialog
          onClose={() => setDialog(null)}
          onOpen={(next) => void openProject(next)}
          onNew={newProject}
          onImport={() => importInput.current?.click()}
          notify={notify}
        />
      )}
      {dialog === 'recordings' && (
        <RecordingsDialog onClose={() => setDialog(null)} notify={notify} />
      )}
      {dialog === 'export' && <ExportDialog project={project} onClose={() => setDialog(null)} />}
      <input
        type="file"
        ref={importInput}
        className="visually-hidden"
        accept=".json,application/json"
        aria-label="Import Patchwork JSON file"
        onChange={(event) => void importProject(event.target.files?.[0])}
      />
    </div>
  );
}
