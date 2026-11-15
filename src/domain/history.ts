import { CONFIG } from '../config';
import type { Project } from './types';

export type ProjectEdit = (project: Project) => Project;

/** Compare shared immutable data before descending. Embedded PCM strings are never copied. */
function sameData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const a = Object.entries(left);
  const b = Object.entries(right);
  return (
    a.length === b.length &&
    a.every(([key, value]) => Object.hasOwn(right, key) && sameData(value, Reflect.get(right, key)))
  );
}

/** Only patch data enters history; audio, camera, takes and browser preferences stay outside.
 * Edits must preserve previous snapshots (replace changed data instead of mutating it).
 */
export class PatchHistory {
  private past: Project[] = [];
  private future: Project[] = [];
  private lastGroup = { key: '', time: 0 };
  private interaction: string | null = null;

  constructor(public project: Project) {}

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  /** Pointer drags and held adjustment keys form one edit even when movement pauses. */
  beginInteraction() {
    this.lastGroup = { key: '', time: 0 };
    this.interaction = crypto.randomUUID();
  }

  endInteraction() {
    if (this.interaction) this.lastGroup = { key: '', time: 0 };
    this.interaction = null;
  }

  commit(edit: ProjectEdit, group = '', now = Date.now()): boolean {
    const previous = this.project;
    const next = edit(previous);
    if (next === previous || sameData(previous, next)) return false;
    const key = this.interaction ? `${this.interaction}:${group}` : group;
    if (
      !key ||
      key !== this.lastGroup.key ||
      (!this.interaction && now - this.lastGroup.time > CONFIG.historyGroupDelayMs)
    ) {
      this.past = [...this.past.slice(-CONFIG.historyLimit + 1), previous];
    }
    this.lastGroup = { key, time: now };
    this.future = [];
    this.project = { ...next, updatedAt: new Date(now).toISOString() };
    return true;
  }

  undo(): boolean {
    this.endInteraction();
    this.lastGroup = { key: '', time: 0 };
    const previous = this.past.pop();
    if (!previous) return false;
    this.future.push(this.project);
    this.project = { ...previous, updatedAt: new Date().toISOString() };
    return true;
  }

  redo(): boolean {
    this.endInteraction();
    this.lastGroup = { key: '', time: 0 };
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.project);
    this.project = { ...next, updatedAt: new Date().toISOString() };
    return true;
  }

  open(project: Project) {
    this.endInteraction();
    this.lastGroup = { key: '', time: 0 };
    this.past = [];
    this.future = [];
    this.project = project;
  }
}

/** Shared shortcut mapping; platform-neutral Cmd/Ctrl Z plus Windows-style Ctrl Y. */
export function historyShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}): 'undo' | 'redo' | null {
  if (event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) return 'redo';
  return null;
}
