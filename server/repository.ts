import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseProject } from '../src/domain/validation';
import type { Project } from '../src/domain/types';

/** Small, replaceable persistence adapter. Atomic renames keep interrupted writes safe.
 * Only validated UUIDs reach the filesystem; no request path becomes an arbitrary filename.
 */
export class ProjectRepository {
  constructor(private readonly directory: string) {}

  private filename(id: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      throw new Error('Invalid project ID.');
    return path.join(this.directory, `${id}.json`);
  }

  async save(value: unknown): Promise<Project> {
    const project = parseProject(value);
    const filename = this.filename(project.id);
    await mkdir(this.directory, { recursive: true });
    const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(project, null, 2), { mode: 0o600 });
    await rename(temporary, filename);
    return project;
  }

  async list(): Promise<Project[]> {
    await mkdir(this.directory, { recursive: true });
    const files = (await readdir(this.directory)).filter((file) => file.endsWith('.json'));
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          return parseProject(JSON.parse(await readFile(path.join(this.directory, file), 'utf8')));
        } catch {
          return undefined;
        } // A corrupt file must not hide every other saved patch.
      }),
    );
    return results
      .filter((item): item is Project => Boolean(item))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
