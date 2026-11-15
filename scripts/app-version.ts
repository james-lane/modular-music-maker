import { execFileSync } from 'node:child_process';
import { readFileSync, watchFile, unwatchFile } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface AppVersion {
  base: string;
  version: string;
  revision: string | null;
  commits: number | null;
  dirty: boolean;
}

const moduleId = 'virtual:app-version';
const resolvedId = `\0${moduleId}`;

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Build identity comes from the checkout, without changing files or requiring Git hooks. */
export function readAppVersion(root: string): AppVersion {
  const manifest: unknown = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('version' in manifest) ||
    typeof manifest.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version)
  ) {
    throw new Error('package.json must contain a major.minor.patch app version.');
  }
  const base = manifest.version;
  // Source archives still work, but must never pretend to identify a Git release.
  try {
    git(root, 'rev-parse', '--show-toplevel');
  } catch {
    return { base, version: `${base}+source`, revision: null, commits: null, dirty: false };
  }
  if (git(root, 'rev-parse', '--is-shallow-repository') === 'true') {
    throw new Error('App versioning needs full Git history. Run git fetch --unshallow first.');
  }
  const revision = git(root, 'rev-parse', 'HEAD');
  const commits = Number(git(root, 'rev-list', '--count', 'HEAD'));
  const dirty = git(root, 'status', '--porcelain', '--untracked-files=normal').length > 0;
  return {
    base,
    version: `${base}+${commits}.g${revision.slice(0, 7)}${dirty ? '.dirty' : ''}`,
    revision,
    commits,
    dirty,
  };
}

/** The UI and release manifest share one snapshot, included in the offline cache. */
export function appVersion(): Plugin {
  let root: string;
  let version: AppVersion;
  return {
    name: 'patchwork-version',
    configResolved(config) {
      root = config.root;
      version = readAppVersion(root);
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) return `export default ${JSON.stringify(version)};`;
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify(version, null, 2)}\n`,
      });
    },
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const watched = new Set<string>();
      const watchBranch = () => {
        const ref = git(root, 'rev-parse', '--symbolic-full-name', 'HEAD');
        const file = path.resolve(root, git(root, 'rev-parse', '--git-path', ref));
        if (watched.has(file)) return;
        watched.add(file);
        watchFile(file, { interval: 1000 }, refresh);
      };
      const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const next = readAppVersion(root);
          if (next.revision) watchBranch();
          if (next.version === version.version) return;
          version = next;
          const module = server.moduleGraph.getModuleById(resolvedId);
          if (module) void server.reloadModule(module);
        }, 100);
      };
      // Git uses atomic file replacement; polling handles commits, checkouts, and worktrees.
      if (version.revision) {
        const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
        for (const name of ['HEAD', 'index']) {
          watched.add(path.resolve(root, git(root, 'rev-parse', '--git-path', name)));
        }
        watched.add(path.join(common, 'packed-refs'));
        for (const file of watched) watchFile(file, { interval: 1000 }, refresh);
        watchBranch();
      }
      server.watcher.on('all', refresh);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        server.watcher.off('all', refresh);
        for (const file of watched) unwatchFile(file, refresh);
      });
    },
  };
}
