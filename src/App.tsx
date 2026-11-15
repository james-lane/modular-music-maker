import { Cable, Check, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadRecordings } from './audio/recordings';
import {
  ExportDialog,
  HelpDialog,
  PatchLibraryDialog,
  RecordingsDialog,
  SettingsDialog,
} from './components/Dialogs';
import { ModuleLibrary } from './components/ModuleLibrary';
import { ModuleHelpDialog } from './components/ModuleHelpDialog';
import { ExamplePatchesDialog } from './components/ExamplePatchesDialog';
import { OfflineDialog, OfflineIndicator } from './components/OfflineDialog';
import { UpdateNotice } from './components/UpdateNotice';
import { Workspace } from './components/Workspace';
import { CONFIG } from './config';
import { StudioHeader, type StudioDialog } from './components/StudioHeader';
import { TransportBar } from './components/TransportBar';
import { MODULES } from './domain/modules';
import { loadCableStyle, saveCableStyle, type CableStyle } from './domain/preferences';
import { createModule, createProject } from './domain/project';
import { saveLocally, saveToServer } from './domain/storage';
import type { ModuleType, Project } from './domain/types';
import { parseProject } from './domain/validation';
import { useAudio } from './hooks/useAudio';
import { useStudio } from './hooks/useStudio';
import { useOffline } from './hooks/useOffline';

export default function App() {
  const studio = useStudio();
  const offline = useOffline();
  const { project, commit } = studio;
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const audio = useAudio(project, notify);
  const updateBlockedReason =
    audio.recordingPending || audio.recording
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
  const [recordingCount, setRecordingCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [cableStyle, setCableStyle] = useState(loadCableStyle);
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
      if (editing || dialog) return;
      if (event.code === 'Space') {
        // A focused button keeps its native Space activation (for example drum audition).
        if (event.target instanceof HTMLElement && event.target.closest('button')) return;
        event.preventDefault();
        if (!event.repeat) void (audio.active ? audio.stop() : audio.play());
      }
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) studio.redo();
        else studio.undo();
      }
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, [audio, studio, save, dialog, offline.applying]);

  const closeLibrary = () => {
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
    // Find an unoccupied rack slot. Modules added with + should never cover an existing one.
    const slots = [0, 1, 2].flatMap((row) => [0, 1, 2, 3].map((column) => ({ row, column })));
    slots.push(...[0, 1, 2].map((row) => ({ row, column: 4 })));
    for (const { row, column } of slots) {
      const x = 48 + column * 306;
      const y = 60 + row * 410;
      const overlaps = project.modules.some(
        (module) =>
          x < module.x + MODULES[module.type].width + 15 &&
          x + definition.width + 15 > module.x &&
          y < module.y + MODULES[module.type].height + 15 &&
          y + definition.height + 15 > module.y,
      );
      if (
        !overlaps &&
        x + definition.width <= CONFIG.canvas.width &&
        y + definition.height <= CONFIG.canvas.height
      ) {
        commit((current) => ({
          ...current,
          modules: [...current.modules, createModule(type, x, y)],
        }));
        closeLibrary();
        notify(`${definition.name} added. Connect a cable to bring it into your patch.`);
        return;
      }
    }
    notify('Make a little room by moving a module, then drag your new one into the workspace.');
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
    <div className={`studio-app ${focused ? 'workspace-focused' : ''}`}>
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
      <div className="studio-body" inert={offline.applying}>
        {libraryOpen && (
          <button
            className="library-dismiss"
            aria-label="Dismiss module library"
            onClick={closeLibrary}
          />
        )}
        <ModuleLibrary
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
          engine={audio.engine}
          playing={audio.playing}
          step={audio.step}
          drumStep={audio.drumStep}
          live={audio.live}
          audioActive={audio.active}
          cableStyle={cableStyle}
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
            {audio.recording
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
          <span className="version-badge">v0.1</span>
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
          onClose={() => setDialog(null)}
          onChange={(changes) => commit((current) => ({ ...current, ...changes }))}
          cableStyle={cableStyle}
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
