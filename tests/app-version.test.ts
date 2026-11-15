import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { build, createServer } from 'vite';
import { appVersion, readAppVersion } from '../scripts/app-version';

function git(root: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Version Test', '-c', 'user.email=version@example.test', ...args],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();
}

async function fixture(t: TestContext, repository = true) {
  // Vite canonicalizes module paths, so avoid macOS /var → /private/var aliases.
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'patchwork-version-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.1.0' }));
  await writeFile(path.join(root, '.gitignore'), 'dist/\nnode_modules/\n');
  await writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(
    path.join(root, 'main.js'),
    'import version from "virtual:app-version"; console.log(version);',
  );
  if (repository) {
    git(root, 'init', '--initial-branch=main');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'Initial fixture');
  }
  return root;
}

test('every commit changes the version, including empty commits, with deterministic clean rebuilds', async (t) => {
  const root = await fixture(t);
  const first = readAppVersion(root);
  assert.ok(first.revision);
  assert.equal(first.commits, 1);
  assert.equal(first.dirty, false);
  assert.equal(first.revision, git(root, 'rev-parse', 'HEAD'));
  assert.equal(first.version, `0.1.0+1.g${first.revision?.slice(0, 7)}`);
  assert.deepEqual(readAppVersion(root), first);

  git(root, 'commit', '--allow-empty', '-m', 'No source changes');
  const second = readAppVersion(root);
  assert.ok(second.revision);
  assert.equal(second.commits, 2);
  assert.notEqual(second.revision, first.revision);
  assert.notEqual(second.version, first.version);

  // Equal commit counts on divergent branches still have distinct full versions.
  git(root, 'checkout', '-b', 'other', first.revision);
  git(root, 'commit', '--allow-empty', '-m', 'Different branch');
  const other = readAppVersion(root);
  assert.equal(other.commits, second.commits);
  assert.notEqual(other.version, second.version);
  git(root, 'checkout', '--detach', second.revision);
  assert.deepEqual(readAppVersion(root), second);
});

test('local edits, staged files, and untracked source are marked; ignored output is excluded', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'main.js'), '// changed');
  assert.match(readAppVersion(root).version, /\.dirty$/);
  git(root, 'add', 'main.js');
  assert.equal(readAppVersion(root).dirty, true);
  git(root, 'commit', '-m', 'Changed source');
  assert.equal(readAppVersion(root).dirty, false);
  await writeFile(path.join(root, 'new.ts'), '// untracked');
  assert.equal(readAppVersion(root).dirty, true);
  await rm(path.join(root, 'new.ts'));
  await build({ root, configFile: false, logLevel: 'silent', plugins: [appVersion()] });
  assert.equal(readAppVersion(root).dirty, false);
});

test('the compiled app and offline-ready release manifest contain the same Git identity', async (t) => {
  const root = await fixture(t);
  const expected = readAppVersion(root);
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [appVersion()],
    build: { write: false, minify: false },
  });
  assert.ok(!Array.isArray(result) && 'output' in result);
  const manifest = result.output.find((file) => file.fileName === 'version.json');
  assert.ok(manifest?.type === 'asset');
  assert.deepEqual(JSON.parse(String(manifest.source)), expected);
  const chunk = result.output.find((file) => file.type === 'chunk');
  assert.ok(chunk?.type === 'chunk');
  assert.ok(chunk.code.includes(expected.version));
});

test('source archives are explicit and shallow histories cannot silently report a wrong commit number', async (t) => {
  const archive = await fixture(t, false);
  assert.deepEqual(readAppVersion(archive), {
    base: '0.1.0',
    version: '0.1.0+source',
    revision: null,
    commits: null,
    dirty: false,
  });
  const root = await fixture(t);
  git(root, 'commit', '--allow-empty', '-m', 'Second');
  const shallow = path.join(archive, 'shallow');
  git(archive, 'clone', '--depth=1', `file://${root}`, shallow);
  assert.throws(() => readAppVersion(shallow), /full Git history/);
  await writeFile(path.join(archive, 'package.json'), '{"version":"invalid"}');
  assert.throws(() => readAppVersion(archive), /major.minor.patch/);
});

test('linked worktrees resolve their own commit and development refreshes after commits', async (t) => {
  const root = await fixture(t);
  const parent = await fixture(t, false);
  const worktree = path.join(parent, 'worktree');
  git(root, 'worktree', 'add', '-b', 'feature/nested', worktree);
  assert.equal(readAppVersion(worktree).revision, readAppVersion(root).revision);
  const server = await createServer({
    root: worktree,
    configFile: false,
    logLevel: 'silent',
    plugins: [appVersion()],
    server: { host: '127.0.0.1', port: 0 },
  });
  // Fixture hooks remove their directories first. Close the watcher before those
  // hooks run, otherwise Vite can recreate cache files during recursive removal.
  try {
    await server.listen();
    const before = await server.transformRequest('/main.js');
    assert.ok(before?.code.includes('virtual:app-version'));
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    const versionUrl = `http://127.0.0.1:${address.port}/@id/__x00__virtual:app-version`;
    const initial = await fetch(versionUrl).then((response) => response.text());
    assert.ok(initial.includes(readAppVersion(worktree).version));
    git(worktree, 'commit', '--allow-empty', '-m', 'New worktree commit');
    const expected = readAppVersion(worktree);
    assert.notEqual(expected.revision, readAppVersion(root).revision);
    // Allow slower CI machines to observe Git's atomic ref replacement.
    let updated = '';
    for (let attempt = 0; attempt < 50; attempt++) {
      updated = await fetch(versionUrl).then((response) => response.text());
      if (updated.includes(expected.version)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(updated.includes(expected.version));
    assert.equal(
      JSON.parse(await readFile(path.join(worktree, 'package.json'), 'utf8')).version,
      '0.1.0',
    );
  } finally {
    await server.close();
  }
});
