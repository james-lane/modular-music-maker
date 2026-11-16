import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModulePorts } from '../src/components/ModulePorts';
import { socketPosition } from '../src/components/socket-geometry';
import { MODULE_LIST } from '../src/domain/modules';
import { createModule, createProject } from '../src/domain/project';

test('every catalog socket renders inside one shared bottom footer, never on the panel face', () => {
  for (const definition of MODULE_LIST) {
    const module = createModule(definition.type, 40, 60);
    const project = { ...createProject(true), modules: [module] };
    const html = renderToStaticMarkup(
      createElement(ModulePorts, { module, project, pending: null, onPort() {} }),
    );
    const footer = html.match(/<footer class="module-ports">[\s\S]*?<\/footer>/g) ?? [];
    assert.equal(footer.length, 1, definition.name);
    assert.equal(
      (footer[0].match(/data-port=/g) ?? []).length,
      definition.ports.length,
      definition.name,
    );
    assert(
      !html.replace(footer[0], '').includes('data-port='),
      `${definition.name}: no sockets outside the bottom footer`,
    );
  }
});

test('all cable endpoints use ordered bottom socket centres, including modulation and signed workspace positions', () => {
  for (const definition of MODULE_LIST) {
    const module = createModule(definition.type, -420, -800);
    const positions = definition.ports.map((port) => socketPosition(module, port.id));
    positions.forEach((position, index) => {
      assert.equal(position.y, module.y + definition.height - 22, definition.name);
      assert(position.x > module.x + 12 && position.x < module.x + definition.width - 12);
      if (index) assert(position.x > positions[index - 1].x);
    });
  }
  const oscillator = createModule('oscillator', 0, 0);
  assert.equal(socketPosition(oscillator, 'pitchMod').y, 304);
  const sampler = createModule('mic-sampler', 0, 0);
  assert.equal(socketPosition(sampler, 'rateMod').y, 458);
  assert.equal(socketPosition(sampler, 'levelMod').y, 458);
});
