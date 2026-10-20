'use strict';
// §8 "help == implemented", for what H1a-0 ships: `hub --help` lists exactly the
// subcommands the dispatcher implements, both ways, and each one answers its own
// --help; docs/API.md documents exactly the served routes, both ways; `hub hook
// --help` lists exactly the hooks.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const F = require('./fixture');
const { COMMANDS, HOOKS } = require('../../src/cli');
const { ROUTES } = require('../../src/server');

const run = (...args) => spawnSync(process.execPath, [F.BIN, ...args], { encoding: 'utf8', input: '' });

test('hub --help lists exactly the dispatched subcommands', () => {
  const r = run('--help');
  assert.equal(r.status, 0);
  const listed = [...r.stdout.split('commands:\n')[1].matchAll(/^ {2}([a-z]+)\b/gm)].map((m) => m[1]).sort();
  assert.deepEqual(listed, Object.keys(COMMANDS).sort());
  for (const c of Object.keys(COMMANDS)) {
    const h = run(c, '--help');
    assert.equal(h.status, 0, `${c} --help`);
    assert.match(h.stdout, new RegExp(`^hub ${c}\\b`), `${c} --help names itself`);
  }
  const u = run('nonsense');
  assert.equal(u.status, 2);
});

test('hub hook --help lists exactly the hooks', () => {
  const r = run('hook', '--help');
  assert.equal(r.status, 0);
  const listed = [...r.stdout.split('hooks:\n')[1].matchAll(/^ {2}([a-z-]+)\b/gm)].map((m) => m[1]).sort();
  assert.deepEqual(listed, Object.keys(HOOKS).sort());
});

test('docs/API.md documents exactly the served routes, both ways', () => {
  const doc = fs.readFileSync(path.join(F.TOOL, 'docs', 'API.md'), 'utf8');
  const documented = [...doc.matchAll(/^### (GET|POST|PUT|DELETE) (\/\S*)$/gm)].map((m) => `${m[1]} ${m[2]}`).sort();
  const served = ROUTES.map((r) => `${r.method} ${r.path}`).sort();
  assert.deepEqual(documented, served);
});

test('every route in the table is served, and a path not in it is not', async () => {
  const node = await F.makeNode();
  const client = require('../../src/client');
  try {
    F.up(node);
    for (const r of ROUTES) {
      const a = await client.call(node.port, r.method, r.path, { token: node.token, body: r.method === 'POST' ? { role: 'planner', tool: 'Edit', file: 'notes.md' } : undefined, timeoutMs: 2000 });
      assert.equal(a.status, 200, `${r.method} ${r.path}`);
    }
    assert.equal((await client.call(node.port, 'GET', '/nope', { token: node.token, timeoutMs: 2000 })).status, 404);
    assert.equal((await client.call(node.port, 'GET', '/write-request', { token: node.token, timeoutMs: 2000 })).status, 405);
  } finally { F.down(node); F.cleanup(node); }
});
