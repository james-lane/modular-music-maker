import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transformWithEsbuild, type Plugin, type ResolvedConfig } from 'vite';

/** Cache exactly one complete release, including future chunks and local media. */
export function offlineBuild(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'patchwork-offline',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
      if (config.base !== '/') throw new Error('Patchwork must be hosted at the origin root.');
    },
    async closeBundle() {
      const directory = path.resolve(config.root, config.build.outDir);
      const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
        .filter((file) => !['_headers', 'service-worker.js'].includes(file))
        .sort();
      const source = await readFile(path.resolve(config.root, 'src/offline/worker.ts'), 'utf8');
      const digest = createHash('sha256').update(source);
      for (const file of files)
        digest.update(file).update(await readFile(path.join(directory, file)));
      const assets = files.map((file) =>
        file === 'index.html' ? '/' : `/${file.split(path.sep).join('/')}`,
      );
      const worker = await transformWithEsbuild(source, 'worker.ts', {
        target: 'es2022',
        format: 'iife',
      });
      await writeFile(
        path.join(directory, 'service-worker.js'),
        `const PRECACHE_ASSETS = ${JSON.stringify(assets)};\n` +
          `const CACHE_NAME = "patchwork-shell-${digest.digest('hex').slice(0, 16)}";\n` +
          worker.code,
      );
    },
  };
}
