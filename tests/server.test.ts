import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '../server/app';
import { ProjectRepository } from '../server/repository';
import { CONFIG } from '../src/config';
import { encodeSamplePcm } from '../src/domain/samples';
import { createModule, createProject } from '../src/domain/project';

test('repository writes real patch files atomically and tolerates a corrupt neighbor', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'patchwork-test-'));
  try {
    const repository = new ProjectRepository(directory);
    const project = createProject();
    await repository.save(project);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(directory, `${project.id}.json`), 'utf8')),
      project,
    );
    await writeFile(path.join(directory, 'corrupt.json'), 'not json');
    assert.deepEqual(await repository.list(), [project]);
    await assert.rejects(() => repository.save({ ...project, id: '../../outside' }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('HTTP API saves/lists patches and rejects mismatched IDs and invalid payloads', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'patchwork-api-test-'));
  const server = createApp(directory).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const project = createProject();
  const put = (body: unknown, id = project.id) =>
    fetch(`${base}/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await put(project)).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/projects`)).json(), [project]);
    assert.equal((await put(project, crypto.randomUUID())).status, 400);
    assert.equal((await put({ ...project, masterVolume: 50 })).status, 400);
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    // Embedded samples must pass the real HTTP body limit, not only the domain parser.
    const kit = createModule('drum-kit', 40, 40);
    const pcm = encodeSamplePcm(
      new Float32Array(CONFIG.samples.sampleRate * CONFIG.samples.maxSeconds),
    );
    kit.samples = { kick: { name: 'Kick sample', pcm }, snare: { name: 'Snare sample', pcm } };
    kit.parameters.kick = 'sample';
    const withSamples = { ...project, modules: [...project.modules, kit] };
    assert.ok(JSON.stringify(withSamples).length > 256 * 1024);
    assert.equal((await put(withSamples)).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/projects`)).json(), [withSamples]);
    kit.samples.kick.pcm = 'invalid';
    assert.equal((await put(withSamples)).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
