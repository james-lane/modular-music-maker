import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';
import { createProject } from '../domain/project';
import { loadActiveProject, saveLocally } from '../domain/storage';
import type { Project } from '../domain/types';

type Edit = (project: Project) => Project;

/** Patch history contains serializable snapshots. Drag previews stay in Canvas until released. */
export function useStudio() {
  const [initial] = useState(() => {
    const saved = loadActiveProject();
    return { project: saved ?? createProject(), isFirstVisit: !saved };
  });
  const [project, setProject] = useState(initial.project);
  const current = useRef(project);
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const lastGroup = useRef({ key: '', time: 0 });
  const [, setHistoryVersion] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saving');

  const commit = useCallback((edit: Edit, group = '') => {
    const previous = current.current;
    const next = edit(previous);
    if (next === previous) return;
    const now = Date.now();
    if (!group || group !== lastGroup.current.key || now - lastGroup.current.time > 700) {
      past.current = [...past.current.slice(-CONFIG.historyLimit + 1), previous];
    }
    lastGroup.current = { key: group, time: now };
    future.current = [];
    current.current = { ...next, updatedAt: new Date().toISOString() };
    setProject(current.current);
    setHistoryVersion((version) => version + 1);
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(current.current);
    current.current = { ...previous, updatedAt: new Date().toISOString() };
    lastGroup.current = { key: '', time: 0 };
    setProject(current.current);
    setHistoryVersion((version) => version + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    current.current = { ...next, updatedAt: new Date().toISOString() };
    setProject(current.current);
    setHistoryVersion((version) => version + 1);
  }, []);

  const openProject = useCallback((next: Project) => {
    // A patch switch may happen before the pending autosave timer has fired.
    try {
      saveLocally(current.current);
    } catch {
      setSaveStatus('error');
    }
    past.current = [];
    future.current = [];
    current.current = next;
    setProject(next);
    setHistoryVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        saveLocally(project);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, CONFIG.autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [project]);

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
    undo,
    redo,
    openProject,
    saveStatus,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
