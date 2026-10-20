'use strict';
// The skeleton: hub up|down|status, the token check, .hub/server.json, /health,
// /status; and `hub check`'s workspace rules (§8 "write gate", last clause).

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const F = require('./fixture');
const client = require('../../src/client');

test('up, status, the token check, the pidfile, down', async () => {
  const node = await F.makeNode();
  try {
    const st0 = F.hub(node, ['status']);
    assert.equal(st0.code, 1);
    assert.match(st0.stdout, /^fixture-node down :\d+: no answer/);

    const u = F.hub(node, ['up']);
    assert.equal(u.code, 0, u.stderr);
    assert.match(u.stdout, new RegExp(`^fixture-node up :${node.port}, pid \\d+, 0 queued, 0 held, 0 dead-letter, parent: none`));

    const info = F.pidfile(node);
    assert.deepEqual(Object.keys(info).sort(), ['name', 'pid', 'port', 'registry_hash', 'started']);
    assert.equal(info.port, node.port);
    const hash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.join(node.root, 'hub.json'))).digest('hex')}`;
    assert.equal(info.registry_hash, hash);

    const s = F.hub(node, ['status', '--json']);
    assert.equal(s.code, 0, s.stderr);
    const j = JSON.parse(s.stdout);
    assert.deepEqual(
      { name: j.name, up: j.up, port: j.port, pid: j.pid, queued: j.queued, held: j.held, dead_letter: j.dead_letter, children: j.children, auth: j.auth },
      { name: 'fixture-node', up: true, port: node.port, pid: info.pid, queued: 0, held: 0, dead_letter: 0, children: [{ name: 'kid', registered: false }], auth: 'ok' },
    );
    assert.equal(j.stores_json, 'present');

    // every request carries the token or is refused
    for (const route of ['/health', '/status']) {
      assert.equal((await client.call(node.port, 'GET', route, { token: '', timeoutMs: 2000 })).status, 401, `${route} without a token`);
      assert.equal((await client.call(node.port, 'GET', route, { token: 'nope', timeoutMs: 2000 })).status, 401, `${route} with a wrong token`);
      assert.equal((await client.call(node.port, 'GET', route, { token: node.token, timeoutMs: 2000 })).status, 200, `${route} with the token`);
    }
    const w = await client.call(node.port, 'POST', '/write-request', { token: 'nope', body: { role: 'planner', tool: 'Edit', file: 'x' }, timeoutMs: 2000 });
    assert.equal(w.status, 401);
    assert.equal(F.ledgerRows(node).length, 0, 'a refused token reaches no route and leaves no row');
    const bad = F.hub(node, ['status'], { extra: { HUB_TOKEN: 'nope' } });
    assert.equal(bad.code, 1);
    assert.match(bad.stdout, /refused HUB_TOKEN/);

    const again = F.hub(node, ['up']);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /already up/);

    const d = F.hub(node, ['down']);
    assert.equal(d.code, 0, d.stderr);
    assert.match(d.stdout, new RegExp(`down \\(pid ${info.pid} stopped\\)`));
    assert.equal(F.pidfile(node), null, 'the pidfile is removed');
    assert.equal(F.hub(node, ['status']).code, 1);
  } finally { F.cleanup(node); }
});

test('an unparseable write-request body is denied and is one ledger row', async () => {
  const node = await F.makeNode();
  try {
    F.up(node);
    const http = require('node:http');
    const res = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: node.port, method: 'POST', path: '/write-request', headers: { Authorization: `Bearer ${node.token}` } }, (r) => {
        const c = []; r.on('data', (x) => c.push(x)); r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }));
      });
      req.end('{not json');
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.decision, 'deny');
    const rows = F.ledgerRows(node);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, res.body.ledger);
  } finally { F.down(node); F.cleanup(node); }
});

test('hub up refuses without HUB_TOKEN, and on a failing hub check', async () => {
  const node = await F.makeNode({ mutate: (r) => { r.owners.workspace.roles.push('ghost'); } });
  try {
    const r1 = F.hub(node, ['up']);
    assert.equal(r1.code, 1);
    assert.match(r1.stderr, /hub up refused: owners\.workspace\.roles: ghost is not a roles key/);
    const ok = await F.makeNode();
    try {
      const r2 = F.hub(ok, ['up'], { extra: { HUB_TOKEN: undefined } });
      assert.equal(r2.code, 1);
      assert.match(r2.stderr, /HUB_TOKEN is not set/);
      assert.equal(F.pidfile(ok), null);
    } finally { F.cleanup(ok); }
  } finally { F.cleanup(node); }
});

test('hub up refuses a port another process holds, naming it', async () => {
  const node = await F.makeNode();
  const net = require('node:net');
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(node.port, '127.0.0.1', r));
  try {
    const r = F.hub(node, ['up']);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /did not answer \/health|EADDRINUSE|not as fixture-node/);
  } finally { blocker.close(); F.cleanup(node); }
});

test('hub check: the good fixture passes; each workspace rule fails on its own fixture', async () => {
  const good = await F.makeNode();
  try {
    const r = F.hub(good, ['check']);
    assert.equal(r.code, 0, r.stdout);
    assert.match(r.stdout, /^ok {4}hub\.json: fixture-node, 5 roles, 3 repos; stores\.json 5 entries/);
  } finally { F.cleanup(good); }
  const cases = [
    ['a workspace role that is not a roles key', (r) => { r.owners.workspace.roles.push('ghost'); }, /owners\.workspace\.roles: ghost is not a roles key/],
    ['a workspace path under a repos row\'s directory', (r) => { r.owners.workspace.paths.push('site/*.md'); }, /owners\.workspace\.paths: site\/\*\.md falls under repos\.site \(site\/\)/],
    ['a workspace path a ** glob carries under a repo', (r) => { r.owners.workspace.paths.push('**/notes.md'); }, /owners\.workspace\.paths: \*\*\/notes\.md falls under repos\./],
    ['a derived name that is neither a repos key nor workspace', (r) => { r.roles.lost = { mode: 'cold', dir: 'nowhere' }; }, /roles\.lost: derives nowhere, which is neither a repos key nor workspace/],
    ['a warm mode', (r) => { r.roles.operator.mode = 'warm'; }, /roles\.operator\.mode: "warm" is not one of/],
    ['a repos row with no verbs', (r) => { delete r.repos.site.verbs; }, /repos\.site\.verbs: must be a list of strings/],
  ];
  for (const [what, mutate, re] of cases) {
    const node = await F.makeNode({ mutate });
    try {
      const r = F.hub(node, ['check']);
      assert.equal(r.code, 1, what);
      assert.match(r.stdout, re, what);
    } finally { F.cleanup(node); }
  }
  const s = await F.makeNode({ stores: { stores: 1, entries: [{ path: 'x.json', declared_by: 'nobody' }] } });
  try {
    const r = F.hub(s, ['check']);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /stores\.json: x\.json is declared by nobody, which is not a repos key/);
  } finally { F.cleanup(s); }
});
