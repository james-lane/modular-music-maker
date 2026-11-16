import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { request } from 'node:http';
import { createServer } from 'vite';
import viteConfig from '../vite.config';
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
    await assert.rejects(() => repository.delete('../../outside'));
    await repository.delete(project.id);
    await repository.delete(project.id);
    assert.deepEqual(await repository.list(), []);
    await assert.rejects(readFile(path.join(directory, `${project.id}.json`)), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local HTTP guard rejects rebinding, foreign origins and cross-site fetches before parsing JSON', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'patchwork-access-test-'));
  const server = createApp(directory).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const port = address.port;
    const project = createProject();
    const send = (
      method: string,
      endpoint: string,
      headers: Record<string, string>,
      body?: string,
    ) =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const outgoing = request(
          { hostname: '127.0.0.1', port, method, path: endpoint, headers },
          (response) => {
            let data = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => {
              data += chunk;
            });
            response.on('end', () => resolve({ status: response.statusCode ?? 0, body: data }));
          },
        );
        outgoing.on('error', reject);
        outgoing.end(body);
      });
    const localHost = `127.0.0.1:${port}`;
    const endpoint = `/api/projects/${project.id}`;
    for (const host of [
      `rebind.example.test:${port}`,
      `127.0.0.1.evil.test:${port}`,
      `localhost:${port + 1}`,
      'localhost',
      '2130706433',
    ]) {
      assert.equal((await send('GET', '/api/projects', { Host: host })).status, 403, host);
      assert.equal(
        (await send('PUT', endpoint, { Host: host, 'Content-Type': 'application/json' }, '{broken'))
          .status,
        403,
        host,
      );
    }
    for (const origin of [
      'null',
      'https://evil.test',
      `http://127.0.0.1:${port + 2}`,
      `http://localhost.evil.test:${port}`,
    ]) {
      assert.equal(
        (
          await send(
            'PUT',
            endpoint,
            { Host: localHost, Origin: origin, 'Content-Type': 'application/json' },
            '{broken',
          )
        ).status,
        403,
        origin,
      );
    }
    assert.equal(
      (await send('GET', '/api/projects', { Host: localHost, 'Sec-Fetch-Site': 'cross-site' }))
        .status,
      403,
    );
    assert.equal(
      (await send('GET', '/api/projects', { Host: 'evil.test', 'X-Forwarded-Host': localHost }))
        .status,
      403,
    );
    for (const hostname of CONFIG.localApi.hosts) {
      for (const origin of [
        `http://${hostname}:${port}`,
        `http://${hostname}:${CONFIG.localApi.developmentPort}`,
      ]) {
        assert.equal(
          (
            await send(
              'PUT',
              endpoint,
              { Host: `${hostname}:${port}`, Origin: origin, 'Content-Type': 'application/json' },
              JSON.stringify(project),
            )
          ).status,
          200,
          origin,
        );
      }
    }
    const listed = await send('GET', '/api/projects', { Host: localHost });
    assert.equal(listed.status, 200);
    assert.deepEqual(JSON.parse(listed.body), [project]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test('Node and static hosting share CSP, framing, content-type and device-permission protections', async () => {
  const staticHeaders = await readFile('public/_headers', 'utf8');
  const baseline = staticHeaders.split('/service-worker.js')[0];
  const declared = Object.fromEntries(
    baseline
      .split('\n')
      .filter((line) => line.startsWith('  '))
      .map((line) => {
        const separator = line.indexOf(':');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
  assert.deepEqual(declared, CONFIG.securityHeaders);
  const server = createApp().listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    for (const [name, value] of Object.entries(CONFIG.securityHeaders))
      assert.equal(response.headers.get(name), value);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('the configured Vite proxy rewrites Host while preserving an allowed development Origin', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'patchwork-proxy-test-'));
  const node = createApp(directory).listen(0, '127.0.0.1');
  const proxy = viteConfig.server?.proxy?.['/api'];
  assert.ok(proxy && typeof proxy !== 'string');
  let vite: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await once(node, 'listening');
    const nodeAddress = node.address();
    assert.ok(nodeAddress && typeof nodeAddress !== 'string');
    vite = await createServer({
      configFile: false,
      logLevel: 'silent',
      server: {
        host: '127.0.0.1',
        port: 0,
        proxy: { '/api': { ...proxy, target: `http://127.0.0.1:${nodeAddress.port}` } },
      },
    });
    await vite.listen();
    const webAddress = vite.httpServer?.address();
    assert.ok(webAddress && typeof webAddress !== 'string');
    const base = `http://127.0.0.1:${webAddress.port}`;
    const project = createProject();
    const saved = await fetch(`${base}/api/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://127.0.0.1:${CONFIG.localApi.developmentPort}`,
      },
      body: JSON.stringify(project),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/projects`)).json(), [project]);
  } finally {
    await vite?.close();
    await new Promise<void>((resolve) => node.close(() => resolve()));
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
    assert.equal(
      (await fetch(`${base}/api/projects/not-a-uuid`, { method: 'DELETE' })).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${base}/api/projects/${project.id}`, {
          method: 'DELETE',
          headers: { Origin: 'https://untrusted.example' },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(`${base}/api/projects/${project.id}`, { method: 'DELETE' })).status,
      204,
    );
    assert.equal(
      (await fetch(`${base}/api/projects/${project.id}`, { method: 'DELETE' })).status,
      204,
    );
    assert.deepEqual(await (await fetch(`${base}/api/projects`)).json(), []);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
