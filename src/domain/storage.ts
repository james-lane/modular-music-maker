import { z } from 'zod';
import { CONFIG } from '../config';
import type { Project } from './types';
import { parseProject } from './validation';

const deletedIdsSchema = z.array(z.uuid());

function deletedProjectIds(): Set<string> {
  try {
    return new Set(
      deletedIdsSchema.parse(JSON.parse(localStorage.getItem(CONFIG.deletedProjectsKey) ?? '[]')),
    );
  } catch {
    return new Set();
  }
}

export function loadProjects(): Project[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CONFIG.storageKey) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const deleted = deletedProjectIds();
    return raw.flatMap((value) => {
      try {
        const project = parseProject(value);
        return deleted.has(project.id) ? [] : [project];
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
  // Another open studio may still hold a deleted snapshot. Never revive its ID.
  if (deletedProjectIds().has(project.id))
    throw new Error('This patch has been deleted. Export it or open another patch.');
  const projects = loadProjects().filter((item) => item.id !== project.id);
  localStorage.setItem(CONFIG.storageKey, JSON.stringify([project, ...projects]));
  localStorage.setItem(CONFIG.activeProjectKey, project.id);
}

/** Delete the browser copy and remember its ID so stale autosaves/server lists cannot
 * resurrect it. A replacement is committed with removal when deleting the open patch.
 * Roll back partial storage writes before letting the studio change its current project.
 */
export function deleteLocally(id: string, replacement?: Project): void {
  z.uuid().parse(id);
  const next = replacement ? parseProject(replacement) : undefined;
  if (next?.id === id) throw new Error('A replacement patch needs a fresh ID.');
  const deleted = deletedProjectIds();
  if (next && deleted.has(next.id)) throw new Error('The replacement patch was deleted.');
  const projects = loadProjects().filter((project) => project.id !== id && project.id !== next?.id);
  deleted.add(id);
  const keys = [CONFIG.deletedProjectsKey, CONFIG.storageKey, CONFIG.activeProjectKey];
  const before = keys.map((key) => [key, localStorage.getItem(key)] as const);
  try {
    // Free the patch payload before adding a small tombstone: deletion must work
    // when the old library has filled its storage quota.
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(next ? [next, ...projects] : projects));
    localStorage.setItem(CONFIG.deletedProjectsKey, JSON.stringify([...deleted]));
    if (next) localStorage.setItem(CONFIG.activeProjectKey, next.id);
    else if (localStorage.getItem(CONFIG.activeProjectKey) === id)
      localStorage.removeItem(CONFIG.activeProjectKey);
  } catch (error) {
    // The in-memory project remains available even if storage itself is unavailable.
    for (const [key, value] of before) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        /* Report the original storage failure. */
      }
    }
    throw error;
  }
}

async function deleteServerCopies(): Promise<void> {
  await Promise.all(
    [...deletedProjectIds()].map(async (id) => {
      try {
        await fetch(`/api/projects/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(3000) });
      } catch {
        /* Keep the tombstone for offline retry and late saves from older windows. */
      }
    }),
  );
}

/** Best-effort cleanup of optional loopback files; public installs make no requests. */
export async function syncDeletedProjects(): Promise<void> {
  if (deletedProjectIds().size && (await localServerAvailable())) await deleteServerCopies();
}

/** Public/static installs never probe or send patches to an API. The unauthenticated
 * file adapter is only eligible on loopback, after identifying the Patchwork server.
 */
async function localServerAvailable(): Promise<boolean> {
  if (!navigator.onLine || !CONFIG.localApi.hosts.some((host) => host === window.location.hostname))
    return false;
  try {
    const response = await fetch('/api/health', {
      signal: AbortSignal.timeout(CONFIG.localApi.timeoutMs),
    });
    if (!response.ok) return false;
    const health: unknown = await response.json();
    return (
      typeof health === 'object' &&
      health !== null &&
      'application' in health &&
      health.application === 'patchwork'
    );
  } catch {
    return false;
  }
}

/** Browser saving owns the core flow; a reachable local Node server adds a file copy. */
export async function saveToServer(project: Project): Promise<boolean> {
  if (deletedProjectIds().has(project.id) || !(await localServerAvailable())) return false;
  if (deletedProjectIds().has(project.id)) return false;
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
    if (!(await localServerAvailable())) {
      const deleted = deletedProjectIds();
      return [...projects.values()].filter((project) => !deleted.has(project.id)).sort(newestFirst);
    }
    if (deletedProjectIds().size) await deleteServerCopies();
    const response = await fetch('/api/projects', { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const raw: unknown = await response.json();
      if (Array.isArray(raw))
        for (const item of raw) {
          const project = parseProject(item);
          if (deletedProjectIds().has(project.id)) continue;
          const local = projects.get(project.id);
          if (!local || project.updatedAt > local.updatedAt) projects.set(project.id, project);
        }
    }
  } catch {
    /* Offline and static deployments use the browser library. */
  }
  const deleted = deletedProjectIds();
  return [...projects.values()].filter((project) => !deleted.has(project.id)).sort(newestFirst);
}

const newestFirst = (a: Project, b: Project) => b.updatedAt.localeCompare(a.updatedAt);

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
