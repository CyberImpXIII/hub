'use strict';
// §8 "write gate" with the server killed, and the H1a-0 part of "kill the server":
// `hub status --json` says down within one second. The hook fails CLOSED for
// writes (the one exception to "every hook fails open") and a read still passes.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const F = require('./fixture');

let node;
const P = (rel) => path.join(node.root, rel);

test.before(async () => {
  node = await F.makeNode();
  F.up(node);
  const info = F.pidfile(node);
  // the counterfactual first: while it is up, the same allowed call passes
  const g = F.gate(node, 'planner', 'Bash', { command: 'tools/items/items add x' });
  assert.equal(g.decision, 'pass', 'precondition: allowed while the server is up');
  process.kill(info.pid, 'SIGKILL');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { try { process.kill(info.pid, 0); } catch { break; } await new Promise((r) => setTimeout(r, 20)); }
});
test.after(() => F.cleanup(node));

test('hub status --json says down within one second, exit 1', async () => {
  // the promise is the probe's: timed in process, so a busy machine's process
  // start-up is not counted; the spawned command is bounded loosely beside it
  const { probe, STATUS_TIMEOUT_MS } = require('../../src/cli');
  assert.ok(STATUS_TIMEOUT_MS < 1000);
  const t0 = Date.now();
  const p = await probe(node.root);
  const ms = Date.now() - t0;
  assert.ok(ms < 1000, `the probe took ${ms} ms`);
  assert.equal(p.up, false);
  const r = F.hub(node, ['status', '--json']);
  assert.equal(r.code, 1);
  assert.ok(r.ms < 5000, `the command took ${r.ms} ms`);
  const s = JSON.parse(r.stdout);
  for (const k of ['name', 'up', 'port', 'pid', 'queued', 'held', 'dead_letter', 'children']) assert.ok(k in s, k);
  assert.equal(s.up, false);
  assert.equal(s.pid, null);
  assert.equal(s.queued, null);
  assert.match(s.note, /stale \.hub\/server\.json/);
});

test('with the server killed, the hook denies a write with the hub status line', () => {
  const before = F.ledgerRows(node).length;
  for (const [tool, input] of [
    ['Edit', { file_path: P('PLAN-alpha.md'), old_string: 'a', new_string: 'b' }],
    ['Bash', { command: 'tools/items/items add x' }],
    ['Bash', { command: 'echo x > notes.md' }],
  ]) {
    const g = F.gate(node, 'planner', tool, input);
    assert.equal(g.decision, 'deny', `${tool}: ${JSON.stringify(input)}`);
    assert.match(g.reason, /the hub server is down .*run `hub status`/);
    assert.equal(g.code, 0);
  }
  const rows = F.ledgerRows(node).slice(before);
  assert.equal(rows.length, 3, 'each of the hook\'s own denies is one row');
  assert.ok(rows.every((r) => r.by === 'hook' && r.decision === 'deny'));
});

test('with the server killed, a read still passes', () => {
  for (const [tool, input] of [['Read', { file_path: P('PLAN-alpha.md') }], ['Bash', { command: 'cat todo.json' }], ['Grep', { pattern: 'a' }]]) {
    assert.equal(F.gate(node, 'planner', tool, input).decision, 'pass', tool);
  }
});

test('an unparseable call is denied, server down or not', () => {
  for (const raw of ['not json', '[]', '{"tool_input": {}}', JSON.stringify({ tool_name: 'Edit', tool_input: {}, cwd: node.root }), JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } })]) {
    const g = F.gate(node, 'planner', null, null, { raw });
    assert.equal(g.decision, 'deny', raw);
    assert.match(g.reason, /cannot be parsed/, raw);
  }
});

test('with HUB_TOKEN unset, a write is denied and a read passes', () => {
  const g = F.gate(node, 'planner', 'Edit', { file_path: P('notes.md') }, { extra: { HUB_TOKEN: undefined } });
  assert.equal(g.decision, 'deny');
  assert.match(g.reason, /HUB_TOKEN is not set; run `hub status`/);
  assert.equal(F.gate(node, 'planner', 'Read', { file_path: P('notes.md') }, { extra: { HUB_TOKEN: undefined } }).decision, 'pass');
});

test('hub down after a kill removes the stale pidfile and signals nothing', () => {
  const r = F.hub(node, ['down']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /removed a stale \.hub\/server\.json/);
  assert.equal(F.pidfile(node), null);
});
