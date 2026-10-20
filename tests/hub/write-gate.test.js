'use strict';
// PLAN-hub.md §8 "write gate", clause by clause, on a fixture node, through the
// real hook (`hub hook gate`) and the real server (`hub up`).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const F = require('./fixture');

let node;
const P = (rel) => path.join(node.root, rel);

test.before(async () => { node = await F.makeNode(); F.up(node); });
test.after(() => { F.down(node); F.cleanup(node); });

test('a planner Edit of a PLAN-*.md is denied with the declared verb to use', () => {
  const g = F.gate(node, 'planner', 'Edit', { file_path: P('PLAN-alpha.md'), old_string: 'a', new_string: 'b' });
  assert.equal(g.decision, 'deny');
  assert.match(g.reason, /Edit of PLAN-alpha\.md is denied/);
  assert.match(g.reason, /write it through tools\/plans\/plans-cli plans edit\|plans add/);
});

test('Write and NotebookEdit of a store are denied the same way', () => {
  for (const [tool, input] of [['Write', { file_path: P('todo.json'), content: '{}' }], ['NotebookEdit', { notebook_path: P('PLAN-alpha.md'), new_source: 'x' }]]) {
    const g = F.gate(node, 'planner', tool, input);
    assert.equal(g.decision, 'deny', tool);
    assert.match(g.reason, /write it through tools\/(items\/items|plans\/plans-cli)/, tool);
  }
});

test('an Edit of a non-store path is denied too, with no verb to name', () => {
  const g = F.gate(node, 'planner', 'Edit', { file_path: P('notes.md'), old_string: 'a', new_string: 'b' });
  assert.equal(g.decision, 'deny');
  assert.match(g.reason, /no verb is declared for it/);
});

test('a Bash call naming a declared verb on a workspace store is allowed for the planner', () => {
  const before = F.ledgerRows(node).length;
  const g = F.gate(node, 'planner', 'Bash', { command: 'tools/plans/plans-cli plans edit PLAN-alpha.md §2 --from /tmp/x.md' });
  assert.equal(g.decision, 'pass', g.reason || g.raw.stderr);
  const rows = F.ledgerRows(node);
  assert.equal(rows.length, before + 1, 'the allow is one ledger row: the server was asked');
  assert.equal(rows.at(-1).decision, 'allow');
  assert.equal(rows.at(-1).verb, 'plans edit');
  assert.deepEqual(rows.at(-1).targets, ['PLAN-alpha.md']);
});

test('a declared verb with no path argument writes the stores in its cwd: allowed for the dispatcher', () => {
  const g = F.gate(node, 'dispatcher', 'Bash', { command: 'tools/items/items add "a new item"' });
  assert.equal(g.decision, 'pass', g.reason || '');
  assert.deepEqual(F.ledgerRows(node).at(-1).targets, ['TODO.md', 'todo.json']);
});

test('the same verb from a role the workspace row does not name is denied', () => {
  for (const role of ['operator', 'site']) {
    const g = F.gate(node, role, 'Bash', { command: 'tools/plans/plans-cli plans edit PLAN-alpha.md §2 --from /tmp/x.md' });
    assert.equal(g.decision, 'deny', role);
    assert.match(g.reason, new RegExp(`role ${role} may not write PLAN-alpha\\.md \\(workspace\\)`), role);
  }
});

test('an undeclared verb is denied, naming the declared ones', () => {
  const g = F.gate(node, 'planner', 'Bash', { command: 'tools/plans/plans-cli plans burn PLAN-alpha.md' });
  assert.equal(g.decision, 'deny');
  assert.match(g.reason, /verb plans is not declared in tools\/plans\/cli\.json; declared: plans edit\|plans add/);
});

test('a Bash write naming no verb is denied, a store one with the verb to use', () => {
  const g1 = F.gate(node, 'planner', 'Bash', { command: 'echo hi >> PLAN-alpha.md' });
  assert.equal(g1.decision, 'deny');
  assert.match(g1.reason, /a Bash write naming no declared verb \(writes PLAN-alpha\.md\)/);
  assert.match(g1.reason, /plans-cli plans edit/);
  const g2 = F.gate(node, 'planner', 'Bash', { command: 'cd site && sed -i "" s/a/b/ src.txt' });
  assert.equal(g2.decision, 'deny');
  assert.match(g2.reason, /writes site\/src\.txt/);
});

test('a declared CLI call and a write in one command: the write still denies it', () => {
  const g = F.gate(node, 'planner', 'Bash', { command: 'tools/items/items add x && echo y > notes.md' });
  assert.equal(g.decision, 'deny');
  assert.match(g.reason, /writes notes\.md/);
});

test('the list is not the gate: a role whose default tools allow Edit still has its Edit denied', () => {
  assert.ok(node.registry.roles.editor.tools.includes('Edit'));
  const g = F.gate(node, 'editor', 'Edit', { file_path: P('notes.md'), old_string: 'a', new_string: 'b' });
  assert.equal(g.decision, 'deny');
});

test('a repo role writes its own repo\'s store through its verb, and not another\'s', () => {
  const own = F.gate(node, 'site', 'Bash', { command: 'cd site && ./store.sh import data.db' });
  assert.equal(own.decision, 'pass', own.reason || '');
  const other = F.gate(node, 'site', 'Bash', { command: 'tools/items/items add x' });
  assert.equal(other.decision, 'deny');
  assert.match(other.reason, /it may write: site/);
});

test('every read passes with no server call: no ledger row, server up or not', () => {
  const before = F.ledgerRows(node).length;
  const reads = [
    ['Read', { file_path: P('PLAN-alpha.md') }],
    ['Grep', { pattern: 'x', path: node.root }],
    ['Glob', { pattern: '*.md' }],
    ['Bash', { command: 'cat PLAN-alpha.md | grep alpha > /dev/null 2>&1' }],
    ['Bash', { command: 'ls -la && git status' }],
    ['WebSearch', { query: 'x' }],
  ];
  for (const [tool, input] of reads) {
    const g = F.gate(node, 'planner', tool, input);
    assert.equal(g.decision, 'pass', `${tool} ${JSON.stringify(input)}: ${g.reason}`);
  }
  assert.equal(F.ledgerRows(node).length, before, 'a read made no server call and left no row');
});

test('every answer is one ledger row', () => {
  const before = F.ledgerRows(node).length;
  const calls = [
    ['planner', 'Edit', { file_path: P('PLAN-alpha.md'), old_string: 'a', new_string: 'b' }],
    ['planner', 'Bash', { command: 'tools/items/items add x' }],
    ['operator', 'Bash', { command: 'tools/items/items add x' }],
    ['planner', 'Bash', { command: 'tools/items/items frobnicate' }],
  ];
  for (const c of calls) F.gate(node, ...c);
  const rows = F.ledgerRows(node).slice(before);
  assert.equal(rows.length, calls.length);
  assert.deepEqual(rows.map((r) => r.decision), ['deny', 'allow', 'deny', 'deny']);
  for (const r of rows) assert.equal(r.by, 'server');
  assert.ok(rows.every((r) => !('args' in r)), 'a row holds no arguments');
});

test('a role that is not a roles key, and a write with no role, are denied', () => {
  const g1 = F.gate(node, 'stranger', 'Edit', { file_path: P('notes.md') });
  assert.equal(g1.decision, 'deny');
  assert.match(g1.reason, /not a roles key/);
  const g2 = F.gate(node, null, 'Edit', { file_path: P('notes.md') });
  assert.equal(g2.decision, 'deny');
  assert.match(g2.reason, /no role/);
});

test('a wrong HUB_TOKEN: the server refuses it and the hook denies the write', () => {
  const g = F.gate(node, 'planner', 'Bash', { command: 'tools/items/items add x' }, { extra: { HUB_TOKEN: 'wrong' } });
  assert.equal(g.decision, 'deny');
  assert.match(g.reason, /refused HUB_TOKEN; run `hub status`/);
});

test('with stores.json missing, a CLI write cannot be placed and is denied', () => {
  const f = P('stores.json');
  const saved = fs.readFileSync(f);
  fs.unlinkSync(f);
  try {
    const g = F.gate(node, 'planner', 'Bash', { command: 'tools/items/items add x' });
    assert.equal(g.decision, 'deny');
    assert.match(g.reason, /cannot be placed; stores\.json missing/);
  } finally { fs.writeFileSync(f, saved); }
  const back = F.gate(node, 'planner', 'Bash', { command: 'tools/items/items add x' });
  assert.equal(back.decision, 'pass', 'the same call is allowed with the file back');
});
