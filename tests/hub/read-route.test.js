'use strict';
// PLAN-hub.md §8 "read route" (H1a-0b; TODO.md hb-36's done-when), clause by clause,
// on a fixture node through the real hook (`hub hook gate`) and the real server:
// a store read (a declared-prefix id, a path stores.json lists, a declared CLI's
// `get`) is answered with the store's `get`; an owned non-store path and an unowned
// path are plain Read with no server call; with the server killed a store read is
// denied with the `hub status` line and a plain read passes; with stores.json
// removed every Read of a path is plain and `hub status` reports the file missing;
// every answer is one ledger row.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const F = require('./fixture');
const client = require('../../src/client');

let node;
const P = (rel) => path.join(node.root, rel);
const rowsAfter = (n) => F.ledgerRows(node).slice(n);

test.before(async () => { node = await F.makeNode(); F.up(node); });
test.after(() => { F.down(node); F.cleanup(node); });

test('a Read of a path stores.json lists is answered with that store\'s get: one server row', () => {
  const before = F.ledgerRows(node).length;
  const g = F.gate(node, 'planner', 'Read', { file_path: P('PLAN-alpha.md') });
  assert.equal(g.decision, 'pass', g.reason || g.raw.stderr);
  const rows = rowsAfter(before);
  assert.equal(rows.length, 1, 'the server was asked once');
  const r = rows[0];
  assert.equal(r.route, '/read-request');
  assert.equal(r.by, 'server');
  assert.equal(r.decision, 'allow');
  assert.equal(r.kind, 'store');
  assert.equal(r.store, 'tools/plans');
  assert.deepEqual(r.targets, ['PLAN-alpha.md']);
  assert.equal(r.verb, null, 'tools/plans declares no get, so none is named');
  assert.match(r.reason, /is a store tools\/plans declares/);
});

test('a store with a declared get: the row names the verb', () => {
  const before = F.ledgerRows(node).length;
  assert.equal(F.gate(node, 'operator', 'Read', { file_path: P('todo.json') }).decision, 'pass');
  const r = rowsAfter(before)[0];
  assert.equal(r.store, 'tools/items');
  assert.equal(r.verb, 'get');
  assert.match(r.reason, /its `get` is tools\/items\/items get/);
});

test('Bash reads of a store path: an argument, an input redirection, a path after cd', () => {
  for (const [cmd, target, store] of [
    ['cat todo.json', 'todo.json', 'tools/items'],
    ['jq . tools/items/todo.json | head', 'tools/items/todo.json', 'tools/items'],
    ['wc -l < TODO.md', 'TODO.md', 'tools/items'],
    ['cd site && head -c 10 data.db', 'site/data.db', 'site'],
    ['grep -n alpha PLAN-alpha.md', 'PLAN-alpha.md', 'tools/plans'],
  ]) {
    const before = F.ledgerRows(node).length;
    const g = F.gate(node, 'planner', 'Bash', { command: cmd });
    assert.equal(g.decision, 'pass', `${cmd}: ${g.reason}`);
    const rows = rowsAfter(before);
    assert.equal(rows.length, 1, cmd);
    assert.equal(rows[0].kind, 'store', cmd);
    assert.deepEqual(rows[0].targets, [target], cmd);
    assert.equal(rows[0].store, store, cmd);
    assert.ok(!('args' in rows[0]), 'a row holds no arguments');
  }
});

test('a read naming an id with a declared prefix is answered with that store\'s get', () => {
  for (const cmd of ['tools/items/items get items:it-7', 'hub get items:it-7', 'echo items:it-7']) {
    const before = F.ledgerRows(node).length;
    const g = F.gate(node, 'operator', 'Bash', { command: cmd });
    assert.equal(g.decision, 'pass', `${cmd}: ${g.reason}`);
    const rows = rowsAfter(before);
    assert.equal(rows.length, 1, cmd);
    assert.deepEqual({ kind: rows[0].kind, id: rows[0].id, store: rows[0].store, verb: rows[0].verb }, { kind: 'store', id: 'items:it-7', store: 'tools/items', verb: 'get' }, cmd);
  }
});

test('a declared CLI\'s get verb with no id is a store read, not an undeclared write verb', () => {
  const before = F.ledgerRows(node).length;
  const g = F.gate(node, 'operator', 'Bash', { command: 'tools/items/items get' });
  assert.equal(g.decision, 'pass', g.reason);
  const r = rowsAfter(before)[0];
  assert.equal(r.route, '/read-request');
  assert.equal(r.store, 'tools/items');
  assert.equal(r.id, null);
  // the counterfactual: another verb on the same CLI is still a write request
  const w = F.gate(node, 'operator', 'Bash', { command: 'tools/items/items list' });
  assert.equal(F.ledgerRows(node).at(-1).route, '/write-request');
  assert.equal(w.decision, 'deny');
});

test('an id no declared prefix claims, or one failing the declared pattern, is prose: plain read, no row', () => {
  const before = F.ledgerRows(node).length;
  for (const cmd of ['echo other:x-1', 'echo items:bogus', 'echo http://example.com/items:it-1', 'git log --format=%h:%s']) {
    assert.equal(F.gate(node, 'operator', 'Bash', { command: cmd }).decision, 'pass', cmd);
  }
  assert.equal(F.ledgerRows(node).length, before, 'no server call');
});

test('an owned non-store path and an unowned path are plain Read: never denied, no server call', () => {
  const before = F.ledgerRows(node).length;
  const reads = [
    ['Read', { file_path: P('site/src.txt') }],        // owned by site, not a store
    ['Read', { file_path: P('notes.md') }],            // unowned
    ['Read', { file_path: P('tools/items/cli.json') }], // owned, a declaration, not a store
    ['Bash', { command: 'cat site/src.txt notes.md' }],
    ['Bash', { command: 'cat /etc/hostname' }],         // outside the node
    ['Bash', { command: 'cat "$SOME_FILE"' }],          // a path built at run time
    ['Grep', { pattern: 'x', path: P('todo.json') }],   // Grep is plain: stated in the help
    ['Glob', { pattern: 'PLAN-*.md' }],
  ];
  for (const [tool, input] of reads) {
    const g = F.gate(node, 'planner', tool, input);
    assert.equal(g.decision, 'pass', `${tool} ${JSON.stringify(input)}: ${g.reason}`);
  }
  assert.equal(F.ledgerRows(node).length, before, 'plain reads made no server call and left no row');
});

test('a store read beside a write is a write: the write decides', () => {
  const g = F.gate(node, 'planner', 'Bash', { command: 'cat todo.json && echo x > notes.md' });
  assert.equal(g.decision, 'deny');
  assert.match(g.reason, /writes notes\.md/);
  assert.equal(F.ledgerRows(node).at(-1).route, '/write-request');
});

test('a store read from a role that is not a roles key, or with no role, is denied', () => {
  const g1 = F.gate(node, 'stranger', 'Read', { file_path: P('todo.json') });
  assert.equal(g1.decision, 'deny');
  assert.match(g1.reason, /not a roles key/);
  const g2 = F.gate(node, null, 'Read', { file_path: P('todo.json') });
  assert.equal(g2.decision, 'deny');
  assert.match(g2.reason, /store read denied, no role/);
});

test('with HUB_TOKEN unset or wrong, a store read is denied and a plain read passes', () => {
  const unset = F.gate(node, 'planner', 'Read', { file_path: P('todo.json') }, { extra: { HUB_TOKEN: undefined } });
  assert.equal(unset.decision, 'deny');
  assert.match(unset.reason, /store read denied, HUB_TOKEN is not set; run `hub status`/);
  const wrong = F.gate(node, 'planner', 'Bash', { command: 'cat todo.json' }, { extra: { HUB_TOKEN: 'wrong' } });
  assert.equal(wrong.decision, 'deny');
  assert.match(wrong.reason, /refused HUB_TOKEN/);
  assert.equal(F.gate(node, 'planner', 'Read', { file_path: P('notes.md') }, { extra: { HUB_TOKEN: undefined } }).decision, 'pass');
});

test('the server itself: a body naming neither id, path nor store is denied, as one row; a direct plain path is allowed', async () => {
  const before = F.ledgerRows(node).length;
  const a = await client.call(node.port, 'POST', '/read-request', { token: node.token, body: { role: 'planner', tool: 'Read' }, timeoutMs: 2000 });
  assert.equal(a.status, 200);
  assert.equal(a.body.decision, 'deny');
  assert.match(a.body.reason, /neither an id, a path nor a store/);
  const b = await client.call(node.port, 'POST', '/read-request', { token: node.token, body: { role: 'planner', tool: 'Read', path: 'notes.md' }, timeoutMs: 2000 });
  assert.deepEqual({ decision: b.body.decision, kind: b.body.kind, store: b.body.store }, { decision: 'allow', kind: 'plain', store: null });
  assert.match(b.body.reason, /an unowned non-store path: plain Read/);
  const c = await client.call(node.port, 'POST', '/read-request', { token: node.token, body: { role: 'planner', tool: 'Read', path: 'site/src.txt' }, timeoutMs: 2000 });
  assert.match(c.body.reason, /site's non-store path: plain Read/);
  const rows = rowsAfter(before);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.by === 'server' && r.route === '/read-request'));
  assert.equal(rows[0].ledger, undefined);
  assert.equal(rows[0].id, null);
});

test('with stores.json removed, every Read of a path is plain Read and hub status reports it missing; an id read still reaches the server', () => {
  const f = P('stores.json');
  const saved = fs.readFileSync(f);
  fs.unlinkSync(f);
  try {
    const before = F.ledgerRows(node).length;
    for (const [tool, input] of [['Read', { file_path: P('todo.json') }], ['Read', { file_path: P('PLAN-alpha.md') }], ['Bash', { command: 'cat todo.json TODO.md' }]]) {
      assert.equal(F.gate(node, 'planner', tool, input).decision, 'pass', tool);
    }
    assert.equal(F.ledgerRows(node).length, before, 'no path is a store without stores.json: no server call');
    const s = F.hub(node, ['status']);
    assert.equal(s.code, 0, s.stderr);
    assert.match(s.stdout, /stores\.json missing/);
    const j = JSON.parse(F.hub(node, ['status', '--json']).stdout);
    assert.equal(j.stores_json, 'missing');
    const g = F.gate(node, 'operator', 'Bash', { command: 'tools/items/items get items:it-9' });
    assert.equal(g.decision, 'pass', g.reason);
    assert.equal(F.ledgerRows(node).at(-1).id, 'items:it-9', 'the prefix is hub.json\'s, so the id read is a store read regardless');
  } finally { fs.writeFileSync(f, saved); }
  const before = F.ledgerRows(node).length;
  assert.equal(F.gate(node, 'planner', 'Read', { file_path: P('todo.json') }).decision, 'pass');
  assert.equal(F.ledgerRows(node).length, before + 1, 'the same Read is a store read again with the file back');
  assert.match(F.hub(node, ['status']).stdout, /stores\.json present/);
});

test('hub check: a stores prefix naming no repos key fails; a malformed ids declaration leaves the id a store with no get', async () => {
  const bad = await F.makeNode({ mutate: (r) => { r.stores.ghost = 'nobody'; } });
  try {
    const c = F.hub(bad, ['check']);
    assert.equal(c.code, 1);
    assert.match(c.stdout, /stores\.ghost: nobody is not a repos key/);
  } finally { F.cleanup(bad); }
  const odd = await F.makeNode({ services: { name: 'items', ids: 'not a list' } });
  try {
    F.up(odd);
    const g = F.gate(odd, 'operator', 'Bash', { command: 'echo items:it-1' });
    assert.equal(g.decision, 'pass', g.reason);
    const r = F.ledgerRows(odd).at(-1);
    assert.deepEqual({ kind: r.kind, store: r.store, verb: r.verb }, { kind: 'store', store: 'tools/items', verb: null });
    assert.match(r.reason, /declares no `get` yet/);
  } finally { F.down(odd); F.cleanup(odd); }
});

test('with the server killed, a store read is denied with the hub status line and a plain read passes', async () => {
  const dead = await F.makeNode();
  try {
    F.up(dead);
    const info = F.pidfile(dead);
    // the counterfactual first: the same store reads pass while it is up
    for (const [tool, input] of [['Read', { file_path: path.join(dead.root, 'todo.json') }], ['Bash', { command: 'cat PLAN-alpha.md' }], ['Bash', { command: 'tools/items/items get items:it-2' }]]) {
      assert.equal(F.gate(dead, 'planner', tool, input).decision, 'pass', `precondition ${tool}`);
    }
    process.kill(info.pid, 'SIGKILL');
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) { try { process.kill(info.pid, 0); } catch { break; } await new Promise((r) => setTimeout(r, 20)); }
    const before = F.ledgerRows(dead).length;
    for (const [tool, input] of [['Read', { file_path: path.join(dead.root, 'todo.json') }], ['Bash', { command: 'cat PLAN-alpha.md' }], ['Bash', { command: 'tools/items/items get items:it-2' }], ['Bash', { command: 'echo items:it-3' }]]) {
      const g = F.gate(dead, 'planner', tool, input);
      assert.equal(g.decision, 'deny', `${tool} ${JSON.stringify(input)}`);
      assert.match(g.reason, /store read denied, the hub server is down .*run `hub status`/);
    }
    const rows = F.ledgerRows(dead).slice(before);
    assert.equal(rows.length, 4, 'each of the hook\'s own denies is one row');
    assert.ok(rows.every((r) => r.by === 'hook' && r.decision === 'deny'));
    assert.deepEqual(rows[0].targets, [path.join(dead.root, 'todo.json')]);
    assert.equal(rows[2].id, 'items:it-2');
    for (const [tool, input] of [['Read', { file_path: path.join(dead.root, 'notes.md') }], ['Read', { file_path: path.join(dead.root, 'site/src.txt') }], ['Bash', { command: 'cat notes.md' }], ['Grep', { pattern: 'a' }]]) {
      assert.equal(F.gate(dead, 'planner', tool, input).decision, 'pass', tool);
    }
    assert.equal(F.ledgerRows(dead).length, before + 4, 'the plain reads left no row');
  } finally { F.cleanup(dead); }
});
