import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';
import { PatchHistory, type ProjectEdit } from '../domain/history';
import { SAMPLER_TRIM } from '../domain/modules';
import { createProject } from '../domain/project';
import { deleteLocally, loadActiveProject, saveLocally } from '../domain/storage';
import type { DrumSample, Project } from '../domain/types';
import { parseProject } from '../domain/validation';

/** Patch history contains serializable snapshots. Drag previews stay in Canvas until released. */
export function useStudio() {
  const [initial] = useState(() => {
    const saved = loadActiveProject();
    return { project: saved ?? createProject(), isFirstVisit: !saved };
  });
  const [project, setProject] = useState(initial.project);
  const current = useRef(project);
  const [history] = useState(() => new PatchHistory(initial.project));
  const [historyNavigation, setHistoryNavigation] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saving');

  const commit = useCallback(
    (edit: ProjectEdit, group = '') => {
      if (!history.commit(edit, group)) return;
      current.current = history.project;
      setProject(history.project);
    },
    [history],
  );

  const beginInteraction = useCallback(() => history.beginInteraction(), [history]);
  const endInteraction = useCallback(() => history.endInteraction(), [history]);
  useEffect(() => {
    // Captured pointers normally end inside the app; also clear grouping after window loss.
    window.addEventListener('blur', endInteraction);
    window.addEventListener('pointerup', endInteraction);
    window.addEventListener('pointercancel', endInteraction);
    const adjustmentReleased = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
        endInteraction();
    };
    window.addEventListener('keyup', adjustmentReleased);
    const visibilityChanged = () => {
      if (document.hidden) endInteraction();
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.removeEventListener('blur', endInteraction);
      window.removeEventListener('pointerup', endInteraction);
      window.removeEventListener('pointercancel', endInteraction);
      window.removeEventListener('keyup', adjustmentReleased);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [endInteraction]);

  // Capture/import can finish after unrelated edits; validate against the latest patch.
  const setSample = useCallback(
    (moduleId: string, slot: string, sample: DrumSample | null): boolean => {
      let accepted = false;
      commit((current) => {
        if (!current.modules.some((item) => item.id === moduleId)) return current;
        const next = {
          ...current,
          modules: current.modules.map((item) => {
            if (item.id !== moduleId) return item;
            const samples = { ...item.samples };
            if (sample) samples[slot] = sample;
            else delete samples[slot];
            return {
              ...item,
              samples,
              parameters:
                item.type === 'drum-kit'
                  ? { ...item.parameters, [slot]: sample ? 'sample' : slot }
                  : item.type === 'mic-sampler'
                    ? {
                        ...item.parameters,
                        trimStart: SAMPLER_TRIM.start,
                        trimEnd: SAMPLER_TRIM.end,
                      }
                    : item.parameters,
            };
          }),
        };
        try {
          const validated = parseProject(next);
          accepted = true;
          return validated;
        } catch {
          return current;
        }
      });
      return accepted;
    },
    [commit],
  );

  const undo = useCallback(() => {
    if (!history.undo()) return;
    setHistoryNavigation((value) => value + 1);
    current.current = history.project;
    setProject(history.project);
  }, [history]);

  const redo = useCallback(() => {
    if (!history.redo()) return;
    setHistoryNavigation((value) => value + 1);
    current.current = history.project;
    setProject(history.project);
  }, [history]);

  const openProject = useCallback(
    (next: Project) => {
      // A patch switch may happen before the pending autosave timer has fired.
      try {
        saveLocally(current.current);
      } catch {
        setSaveStatus('error');
      }
      history.open(next);
      setHistoryNavigation((value) => value + 1);
      current.current = next;
      setProject(next);
    },
    [history],
  );

  const deleteProject = useCallback(
    (id: string) => {
      const deletingOpenPatch = current.current.id === id;
      const next = deletingOpenPatch ? createProject(true) : undefined;
      deleteLocally(id, next);
      if (next) {
        // Do not use openProject: its preservation save would resurrect the deleted patch.
        history.open(next);
        current.current = next;
        setProject(next);
        setHistoryNavigation((value) => value + 1);
        setSaveStatus('saved');
      }
    },
    [history],
  );

  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        // A deleted patch's old debounce may already be queued when replacement wins.
        if (current.current.id !== project.id) return;
        saveLocally(project);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, CONFIG.autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [project]);

  const flush = useCallback(() => {
    saveLocally(current.current);
    setSaveStatus('saved');
  }, []);

  // Persist the most recent edit on a tab close, even within the debounce window.
  useEffect(() => {
    const flush = () => {
      try {
        saveLocally(current.current);
      } catch {
        /* Visible save status handles storage errors. */
      }
    };
    // iPadOS may suspend a home-screen app without a pagehide event.
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, []);

  return {
    project,
    isFirstVisit: initial.isFirstVisit,
    commit,
    setSample,
    undo,
    redo,
    openProject,
    deleteProject,
    saveStatus,
    flush,
    beginInteraction,
    endInteraction,
    historyNavigation,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
