import { execFileSync } from 'node:child_process';

/** Hosting providers commonly clone one commit. Recover its real ancestry before
 * calculating a release number; never replace the requested branch/commit.
 */
export function ensureFullGitHistory(root: string): void {
  let shallow: string;
  try {
    shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Source archives keep the explicit +source version supported by app-version.
    return;
  }
  if (shallow !== 'true') return;
  execFileSync('git', ['fetch', '--unshallow', 'origin'], { cwd: root, stdio: 'inherit' });
}
