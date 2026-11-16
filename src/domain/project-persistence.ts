import type { Project } from './types';

export type ProjectSaveStatus = 'saving' | 'saved' | 'error' | 'temporary';

/** Demo lifetime is session state, never a marker inside a portable patch file.
 * All automatic save paths share this gate, including project switches and pagehide.
 */
export class ProjectPersistence {
  private temporaryId: string | null = null;

  constructor(private readonly write: (project: Project) => void) {}

  open(project: Project, temporary = false) {
    this.temporaryId = temporary ? project.id : null;
  }

  isTemporary(project: Project) {
    return project.id === this.temporaryId;
  }

  flush(project: Project): boolean {
    if (this.isTemporary(project)) return false;
    this.write(project);
    return true;
  }

  save(project: Project) {
    // A failed explicit save must leave a demo temporary and retryable.
    this.write(project);
    if (this.isTemporary(project)) this.temporaryId = null;
  }
}
