import { CONFIG } from '../config';
import type { Project } from './types';
import { parseProject } from './validation';

export function loadProjects(): Project[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CONFIG.storageKey) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((value) => {
      try {
        return [parseProject(value)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function loadActiveProject(): Project | undefined {
  try {
    const activeId = localStorage.getItem(CONFIG.activeProjectKey);
    return loadProjects().find((project) => project.id === activeId);
  } catch {
    return undefined;
  }
}

export function saveLocally(project: Project): void {
  const projects = loadProjects().filter((item) => item.id !== project.id);
  localStorage.setItem(CONFIG.storageKey, JSON.stringify([project, ...projects]));
  localStorage.setItem(CONFIG.activeProjectKey, project.id);
}

/** Browser saving is always available on static hosting; Node adds file-backed persistence.
 * Failure to reach Node is an expected offline case, never presented as a server save.
 */
export async function saveToServer(project: Project): Promise<boolean> {
  try {
    const response = await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listAllProjects(): Promise<Project[]> {
  const projects = new Map(loadProjects().map((project) => [project.id, project]));
  try {
    const response = await fetch('/api/projects', { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const raw: unknown = await response.json();
      if (Array.isArray(raw))
        for (const item of raw) {
          const project = parseProject(item);
          const local = projects.get(project.id);
          if (!local || project.updatedAt > local.updatedAt) projects.set(project.id, project);
        }
    }
  } catch {
    /* Offline and static deployments use the browser library. */
  }
  return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'patchwork'
  );
}
