'use strict';
// The section parsers (PLAN-hub.md §1: the moved relay parser and question gate),
// held to their contracts: `hub grammar` matches PLAN-auto-relay.md §2's example
// (its gate: "grammar output matches §2's example"); every §5 parser clause; the
// malformed kinds of §9; PLAN-question-routing.md §7's parser clauses.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const F = require('./fixture');
const sec = require('../../src/section');

test('hub grammar prints the shape, and it matches PLAN-auto-relay.md §2\'s example', () => {
  const r = spawnSync(process.execPath, [F.BIN, 'grammar'], { encoding: 'utf8', input: '' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), sec.GRAMMAR.trim());
  const doc = fs.readFileSync(path.join(F.TOOL, 'docs', 'inputs', 'PLAN-auto-relay.md'), 'utf8');
  const example = /## 2\. The section format[\s\S]*?```\n([\s\S]*?)```/.exec(doc);
  assert.ok(example, 'auto-relay §2 holds its example');
  const exampleLines = example[1].trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const grammarLines = sec.GRAMMAR.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of exampleLines) assert.ok(grammarLines.includes(l), `the grammar carries the example line: ${l}`);
});

test('the Dispatch parser: items, each malformed kind labelled with its reason, no section nothing', () => {
  const ok = sec.dispatchItems('text\n\n## Dispatch\n\n1. PLAN-x.md §3 -- build the thing -- approved: Jacob 2026-10-03\n2. TODO.md "fix the gate" -- do it -- approved: Jacob 2026-10-04\n\n## Needs your yes\n\n1. PLAN-y.md §1 -- never sent -- approved: Jacob 2026-10-01\n');
  assert.equal(ok.found, true);
  assert.deepEqual(ok.items.map((i) => [i.tag, i.ref, i.body, i.approval]), [
    ['dispatch', 'PLAN-x.md §3', 'build the thing', '2026-10-03'],
    ['dispatch', 'TODO.md "fix the gate"', 'do it', '2026-10-04'],
  ]);
  const none = sec.dispatchItems('a reply with no section\n\n## Decisions\n\n| # | d | h | r |\n');
  assert.deepEqual(none, { found: false, items: [] });
  const bad = sec.dispatchItems('## Dispatch\n\n1. PLAN-x.md §3 -- no approval here\n2. PLAN-x.md §4 -- approved by Jacob -- approved by: Jacob 2026-10-03\n- PLAN-x.md §5 -- a bullet -- approved: Jacob 2026-10-03\n3. PLAN-x.md §6 → arrows -- approved: Jacob 2026-10-03\n4. not-a-pointer -- what -- approved: Jacob 2026-10-03\n5. PLAN-x.md §7 -- undated -- approved: Jacob yesterday\n');
  assert.equal(bad.items.length, 6);
  assert.ok(bad.items.every((i) => i.tag === 'dispatch-malformed'));
  assert.deepEqual(bad.items.map((i) => i.reason), [
    'no `approved:`',
    'no `approved:`',
    'not a numbered line (`N. `)',
    'does not match the grammar',
    'the pointer `not-a-pointer` is not FILE §section, TODO.md "title", file:line or a commit',
    'the approval is not `approved: Jacob YYYY-MM-DD`',
  ]);
  for (const i of bad.items) assert.ok(i.body.includes('grammar:'), 'a malformed item carries the grammar');
  const mixed = sec.dispatchItems('## Dispatch\n\n1. PLAN-x.md §3 -- good -- approved: Jacob 2026-10-03\n2. bad line\n');
  assert.deepEqual(mixed.items.map((i) => i.tag), ['dispatch', 'dispatch-malformed']);
  const near = sec.dispatchItems('### Dispatch\n\n1. PLAN-x.md §3 -- good -- approved: Jacob 2026-10-03\n');
  assert.equal(near.found, true, 'a near-miss heading is reported, not ignored');
  assert.deepEqual(near.items.map((i) => i.reason), ['near-miss heading']);
  const two = sec.dispatchItems('## Dispatch\n\n1. PLAN-x.md §3 -- a -- approved: Jacob 2026-10-03\n\ntext\n\n## Dispatch\n\n1. PLAN-x.md §4 -- b -- approved: Jacob 2026-10-03\n');
  assert.deepEqual(two.items.map((i) => i.tag), ['dispatch', 'dispatch-malformed']);
  assert.equal(two.items[1].reason, 'a second section');
  const after = sec.dispatchItems('## Dispatch\n\n1. PLAN-x.md §3 -- a -- approved: Jacob 2026-10-03\n\nNone.\n');
  assert.equal(after.items.length, 1, 'lines after a blank line are not items');
});

test('the Needs Jacob parser and the planner\'s Decisions check', () => {
  const n = sec.needsJacob('## Needs Jacob\n\n1. [dispatch] wait or stop harness? -- blocks: TODO.md "x"\n2. [plan] keep graphify-eval? -- blocks: PLAN-x.md §2\n3. [context] what does fill take? -- blocks: PLAN-y.md §1\n4. no type here -- blocks: PLAN-z.md §1\n5. [riddle] what? -- blocks: PLAN-z.md §1\n6. [plan] missing the pointer\n');
  assert.equal(n.found, true);
  assert.deepEqual(n.items.map((i) => (i.ok ? i.type : `bad:${i.reason}`)), [
    'dispatch', 'plan', 'context', 'bad:no `[type]`', 'bad:unknown type [riddle]; types: dispatch, plan, context, settings', 'bad:off the shape (`N. [type] question -- blocks: pointer`)',
  ]);
  assert.deepEqual(sec.questionsOutside('Is this done?\n\n## Needs Jacob\n\n1. [dispatch] a? -- blocks: x\n\n> a quoted question?\n\n```\ncode?\n```\nAnd another one?', sec.NEEDS_HEADING), ['Is this done?', 'And another one?']);
  assert.deepEqual(sec.needsJacob('no questions at all'), { found: false, items: [] });
  const d = sec.decisionsOffShape('## Decisions\n\n| # | decision | hinges on | recommend |\n|---|---|---|---|\n| 1 | PLAN-x.md §8.2: render read-only | hand edits | yes |\n| 2 | PLAN-x.md §9: which | A or B | B |\n| 3 | no pointer | x | yes |\n| 4 | PLAN-x.md §1: too few cells | yes |\n| 5 | PLAN-x.md §2: an option | A or B | C |\n');
  assert.equal(d.found, true);
  assert.deepEqual(d.bad, ['row 3: the decision cell does not start with a FILE §n pointer', '| 4 | PLAN-x.md §1: too few cells | yes |: 3 cells, not 4', 'row 5: recommend is neither yes, no nor an option named in hinges on']);
  assert.deepEqual(sec.decisionsOffShape('nothing'), { found: false, bad: [] });
});
