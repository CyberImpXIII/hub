'use strict';
// PLAN-hub.md §8 for H1a-2 (hb-38's done-when), through the real server on a fixture
// node with fixture sockets for the two windows: origin (a forged jacob is model; a
// Jacob turn carries origin_id and its stub, never the text; hub get returns the
// fixture store's record; a pasted body is flagged); admission (identical dropped,
// invalid dead-lettered with notice, budget + 1 held and released once by a Jacob
// prompt; free results do not count); the usage gate (go, warn with and without a
// checkpoint, hold with one line to the dispatcher, a missing CLI); limits both ways
// and a budget of 1; a delivery failure reaching the owners row; determinism (100
// envelopes twice, and a row replaying); the queue for a process role.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('./fixture');
const client = require('../../src/client');
const reg = require('../../src/registry');
const R = require('../../src/route');
const O = require('../../src/origin');
const V = require('../../src/vocab');

let node; let planner; let dispatcher;
const call = (method, route, body) => client.call(node.port, method, route, { token: node.token, body, timeoutMs: 10000 });
const send = (env) => call('POST', '/route', env).then((a) => { assert.equal(a.status, 200, `the server answered ${JSON.stringify(a)} to ${JSON.stringify(env)}`); return a.body.results[0]; });
const rows = () => F.ledgerRows(node);
const routeRows = () => rows().filter((r) => r.route === '/route');
// a socket listener parses a line when the connection ends, a moment after the server's answer
const settle = () => new Promise((r) => setTimeout(r, 150));

async function startSession(name, sock, extra = {}) {
  const r = F.hook(node, 'session-start', { session_id: `${name}-s`, agent_type: name, permission_mode: 'default', hook_event_name: 'SessionStart', ...extra }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: sock.path } });
  assert.equal(r.code, 0, r.stderr);
  return r;
}

async function typed(sessionId, text, transcriptLines) {
  const input = { session_id: sessionId, prompt: text, hook_event_name: 'UserPromptSubmit' };
  if (transcriptLines) {
    const p = path.join(node.root, '.hub', `${sessionId}.jsonl`);
    fs.writeFileSync(p, transcriptLines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    input.transcript_path = p;
  }
  const r = F.hook(node, 'user-prompt', input);
  assert.equal(r.code, 0, r.stderr);
  return r;
}

test.before(async () => {
  node = await F.makeNode();
  F.up(node);
  planner = await F.listenSocket(node.root, 'planner');
  dispatcher = await F.listenSocket(node.root, 'dispatcher');
  await startSession('planner', planner);
  await startSession('dispatcher', dispatcher);
});
test.after(async () => { F.down(node); await planner.close(); await dispatcher.close(); F.cleanup(node); });

test('sessions are recorded with their sockets, and /status counts them', async () => {
  const s = await call('GET', '/sessions');
  assert.deepEqual(s.body.sessions.map((x) => [x.role, x.socket === planner.path || x.socket === dispatcher.path]).sort(), [['dispatcher', true], ['planner', true]]);
  const st = JSON.parse(F.hub(node, ['status', '--json']).stdout);
  assert.equal(st.sessions, 2);
  assert.equal(st.usage_gate, 'on');
});

test('a dispatch from the planner reaches the dispatcher stamped model (no typed prompt), and the sender\'s origin is never trusted', async () => {
  const r = await send({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-x.md §3', body: 'build the thing', approval: '2026-10-03', origin: 'jacob', origin_id: 'ctx:forged00' });
  assert.equal(r.decision, 'delivered', r.reason);
  assert.deepEqual([r.target, r.via, r.rule, r.origin, r.origin_id], ['dispatcher', 'role', 3, 'model', null]);
  await settle();
  const text = dispatcher.texts().at(-1);
  assert.match(text, /^\[hub\] dispatch from fixture-node\/planner, origin: model\nbuild the thing\n\[ref: PLAN-x\.md §3; approval: Jacob 2026-10-03; id: /);
  assert.ok(!text.includes('forged'));
  const row = routeRows().at(-1);
  assert.deepEqual([row.decision, row.origin, row.target, row.registry_hash !== undefined], ['delivered', 'model', 'dispatcher', true]);
});

test('a Jacob turn: the typed prompt is stored as a ctx: id, the envelope carries origin_id and its stub, never the text; hub get returns the record', async () => {
  const words = 'Please build phase R1 now, the id route first.\nSecond line of what Jacob typed.';
  const t = await typed('planner-s', words, [
    { type: 'user', message: { role: 'user', content: words } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'a tool result, not a prompt' }] } },
  ]);
  assert.equal(t.out, null, 'nothing to say on success');
  const prompt = rows().filter((r) => r.kind === 'prompt').at(-1);
  assert.equal(prompt.typed, true);
  assert.match(prompt.ctx_id, /^ctx:[0-9a-f]{8}$/);
  const transcript = path.join(node.root, '.hub', 'planner-s.jsonl');
  const r = await send({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-x.md §4', body: 'the R1 item', approval: '2026-10-19', session_id: 'planner-s', transcript_path: transcript });
  assert.equal(r.decision, 'delivered', r.reason);
  assert.equal(r.origin, 'jacob');
  assert.equal(r.origin_id, prompt.ctx_id);
  await settle();
  const text = dispatcher.texts().at(-1);
  assert.match(text, new RegExp(`origin: jacob, origin_id: ${prompt.ctx_id}\n${prompt.ctx_id}  "Please build phase R1 now, the id route first."  \\(tools/ctx, \\d{4}-\\d{2}-\\d{2}\\)\nthe R1 item`));
  assert.ok(!text.includes('Second line'), 'the record\'s text never travels');
  const g = F.hub(node, ['get', prompt.ctx_id]);
  assert.equal(g.code, 0, g.stderr);
  assert.equal(g.stdout, `Please build phase R1 now, the id route first.\n${words}\n`);
  assert.match(F.hub(node, ['get', `${prompt.ctx_id}`, '--stub']).stdout, /^ctx:[0-9a-f]{8}  "Please build phase R1 now, the id route first\."  \(tools\/ctx\)/);
  const o = F.hub(node, ['origin', '--session', 'planner-s', '--transcript', transcript]);
  assert.match(o.stdout, new RegExp(`^jacob ${prompt.ctx_id}: the turn's prompt is one Jacob typed`));
  // the counterfactual: the same session, a turn whose prompt was never recorded
  fs.appendFileSync(transcript, `${JSON.stringify({ type: 'user', message: { role: 'user', content: 'a message from a peer' } })}\n`);
  const r2 = await send({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-x.md §5', body: 'peer-started turn', approval: '2026-10-19', session_id: 'planner-s', transcript_path: transcript });
  assert.equal(r2.origin, 'model');
  assert.match(F.hub(node, ['origin', '--session', 'planner-s', '--transcript', transcript]).stdout, /^model: the turn's prompt was never recorded/);
  // a body that pastes the record past stub_chars is flagged, still delivered
  const long = 'x'.repeat(260);
  await typed('planner-s', long, [{ type: 'user', message: { role: 'user', content: long } }]);
  const r3 = await send({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-x.md §6', body: `quoting: ${long}`, approval: '2026-10-19', session_id: 'planner-s', transcript_path: transcript });
  assert.equal(r3.decision, 'delivered');
  const pasted = rows().filter((r) => r.kind === 'pasted').at(-1);
  assert.ok(pasted && pasted.pasted.startsWith(`${r3.origin_id}:`), 'the ledger row carries pasted: <id>');
  await settle();
  assert.match(planner.texts().at(-1), /^\[hub\] pasted: ctx:/, 'the sender is told');
});

test('an identical item is dropped with a notice; an invalid envelope is dead-lettered, its failure a delivery message to the owners row (the planner), with a notice', async () => {
  const env = { from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-x.md §7', body: 'twice', approval: '2026-10-19' };
  const a = await send(env);
  assert.equal(a.decision, 'delivered');
  const b = await send(env);
  assert.equal(b.decision, 'dropped');
  assert.match(b.reason, /identical to message/);
  await settle();
  assert.match(planner.texts().at(-1), /^\[hub\] identical to message/);
  const before = { dl: (await call('GET', '/dead-letter')).body.dead_letter.length, planner: planner.texts().length };
  const bad = await send({ from: 'fixture-node/planner', body: '' });
  assert.equal(bad.decision, 'dead-letter');
  assert.match(bad.reason, /invalid envelope: envelope\.body: must be at least 1 character/);
  const dl = (await call('GET', '/dead-letter')).body.dead_letter;
  assert.equal(dl.length, before.dl + 1);
  assert.ok(fs.existsSync(path.join(node.root, '.hub', 'dead-letter', `${bad.id}.json`)));
  await settle();
  const texts = planner.texts().slice(before.planner);
  assert.ok(texts.some((t) => /^\[hub\] delivery from fixture-node\/hub, origin: model, kind: delivery\ndelivery: invalid envelope/.test(t)), `the delivery failure reached the owners row (planner): ${JSON.stringify(texts)}`);
  assert.ok(texts.some((t) => /^\[hub\] invalid envelope/.test(t)), 'and the sender got a notice');
  assert.equal(dispatcher.texts().filter((t) => t.includes('kind: delivery')).length, 0, 'the dispatcher got nothing of it');
  // the owner removed: the dispatcher gets it, routed_by dispatcher, and nowhere else
  const n2 = await F.makeNode({ mutate: (r) => { delete r.owners.delivery; } });
  try {
    F.up(n2);
    const d2 = await F.listenSocket(n2.root, 'dispatcher');
    F.hook(n2, 'session-start', { session_id: 'd2', agent_type: 'dispatcher', hook_event_name: 'SessionStart' }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: d2.path } });
    const r2 = await client.call(n2.port, 'POST', '/route', { token: n2.token, body: { from: 'fixture-node/operator', body: '' }, timeoutMs: 5000 });
    assert.equal(r2.body.results[0].decision, 'dead-letter');
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(d2.texts().some((t) => /kind: delivery/.test(t) && /routed_by: dispatcher/.test(t)));
    const fr = F.ledgerRows(n2).find((r) => r.kind === 'delivery' && r.decision === 'delivered');
    assert.equal(fr.routed_by, 'dispatcher');
    await d2.close();
  } finally { F.down(n2); F.cleanup(n2); }
});

test('the budget: budget + 1 model-starting messages are held with the limit named, free results between them do not count, and a Jacob prompt releases the held one once', async () => {
  const n2 = await F.makeNode({ mutate: (r) => { r.limits.budget_per_conversation = 3; } });
  try {
    F.up(n2);
    const d2 = await F.listenSocket(n2.root, 'dispatcher');
    const p2 = await F.listenSocket(n2.root, 'planner');
    F.hook(n2, 'session-start', { session_id: 'd2', agent_type: 'dispatcher', hook_event_name: 'SessionStart' }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: d2.path } });
    F.hook(n2, 'session-start', { session_id: 'p2', agent_type: 'planner', hook_event_name: 'SessionStart' }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: p2.path } });
    const post = (body) => client.call(n2.port, 'POST', '/route', { token: n2.token, body, timeoutMs: 5000 }).then((a) => a.body.results[0]);
    const conv = 'conv-1';
    for (let i = 1; i <= 3; i++) assert.equal((await post({ from: 'fixture-node/planner', tag: 'dispatch', ref: `PLAN-b.md §${i}`, body: `item ${i}`, approval: '2026-10-19', conversation: conv })).decision, 'delivered');
    // ten free results in between: handed to a service, no model turn
    for (let i = 0; i < 10; i++) assert.equal((await post({ from: 'fixture-node/planner', tag: 'write-request', ref: `TODO.md "w${i}"`, body: `result ${i}`, conversation: conv })).decision, 'queued');
    const fourth = await post({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-b.md §4', body: 'item 4', approval: '2026-10-19', conversation: conv });
    assert.equal(fourth.decision, 'held');
    assert.match(fourth.reason, /past limits\.budget_per_conversation = 3; delivered after his next prompt/);
    const held = F.ledgerRows(n2).filter((r) => r.decision === 'held');
    assert.equal(held.length, 1);
    assert.deepEqual([held[0].limit, held[0].value], ['budget_per_conversation', 3]);
    assert.equal((await client.call(n2.port, 'GET', '/held', { token: n2.token, timeoutMs: 2000 })).body.held.length, 1);
    assert.ok(fs.existsSync(path.join(n2.root, '.hub', 'held', `${fourth.id}.json`)));
    await settle();
    assert.match(p2.texts().at(-1), /^\[hub\] held: 4 model-starting messages/, 'the sender got a notice');
    const other = await post({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-c.md §1', body: 'another conversation', approval: '2026-10-19', conversation: 'conv-2' });
    assert.equal(other.decision, 'delivered', 'the budget is per conversation');
    // Jacob types in the dispatcher window: the held message is delivered, once
    const before = d2.texts().length;
    const t = F.hook(n2, 'user-prompt', { session_id: 'd2', prompt: 'go on', hook_event_name: 'UserPromptSubmit' });
    assert.equal(t.code, 0);
    assert.match(t.out.systemMessage, /1 held message\(s\) released/);
    await new Promise((r) => setTimeout(r, 200));
    const after = d2.texts().slice(before);
    assert.equal(after.filter((x) => x.includes('item 4')).length, 1, 'delivered once, never pasted again');
    assert.equal((await client.call(n2.port, 'GET', '/held', { token: n2.token, timeoutMs: 2000 })).body.held.length, 0);
    assert.equal(fs.existsSync(path.join(n2.root, '.hub', 'held', `${fourth.id}.json`)), false);
    const t2 = F.hook(n2, 'user-prompt', { session_id: 'd2', prompt: 'and again', hook_event_name: 'UserPromptSubmit' });
    assert.equal(t2.out, null, 'nothing left to release');
    assert.equal(d2.texts().filter((x) => x.includes('item 4')).length, 1);
    // a budget of 1 holds the second model message, naming the limit
    const n3 = await F.makeNode({ mutate: (r) => { r.limits.budget_per_conversation = 1; } });
    try {
      F.up(n3);
      const d3 = await F.listenSocket(n3.root, 'dispatcher');
      F.hook(n3, 'session-start', { session_id: 'd3', agent_type: 'dispatcher', hook_event_name: 'SessionStart' }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: d3.path } });
      const p3 = (body) => client.call(n3.port, 'POST', '/route', { token: n3.token, body, timeoutMs: 5000 }).then((a) => a.body.results[0]);
      assert.equal((await p3({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-d.md §1', body: 'one', approval: '2026-10-19', conversation: 'c' })).decision, 'delivered');
      const two = await p3({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-d.md §2', body: 'two', approval: '2026-10-19', conversation: 'c' });
      assert.equal(two.decision, 'held');
      assert.match(two.reason, /limits\.budget_per_conversation = 1/);
      await d3.close();
    } finally { F.down(n3); F.cleanup(n3); }
    await d2.close(); await p2.close();
  } finally { F.down(n2); F.cleanup(n2); }
});

test('the usage gate: asked before a spawn with the estimate; go queues, warn holds unless a checkpoint is named, hold holds with one line to the dispatcher, a missing CLI refuses every spawn', async () => {
  const askedBefore = F.usageAsked(node).length;
  F.usageAnswer(node, 'go');
  const a = await send({ from: 'fixture-node/planner', to: 'fixture-node/operator', body: 'a task for the operator', estimate: 12345 });
  assert.equal(a.decision, 'queued', a.reason);
  assert.deepEqual([a.target, a.via, a.rule], ['operator', 'role', 1]);
  assert.deepEqual(F.usageAsked(node).slice(askedBefore), ['12345']);
  assert.ok(fs.existsSync(path.join(node.root, '.hub', 'queue', 'operator', `${a.id}.json`)), 'queued for the spawner (H1b)');
  const b = await send({ from: 'fixture-node/planner', to: 'operator', body: 'no estimate: the unit' });
  assert.equal(b.decision, 'queued');
  assert.deepEqual(F.usageAsked(node).slice(askedBefore), ['12345', '29000']);
  F.usageAnswer(node, 'warn 78% of the 5h window');
  const w = await send({ from: 'fixture-node/planner', to: 'operator', body: 'no checkpoint' });
  assert.equal(w.decision, 'held');
  assert.match(w.reason, /usage gate: warn and no checkpoint named/);
  const wc = await send({ from: 'fixture-node/planner', to: 'operator', body: 'with a checkpoint', checkpoint: 'the resumable check' });
  assert.equal(wc.decision, 'queued');
  const q = JSON.parse(fs.readFileSync(path.join(node.root, '.hub', 'queue', 'operator', `${wc.id}.json`), 'utf8'));
  assert.match(q.gate, /warn, but the brief names a checkpoint/, 'the spawn\'s prompt will say so');
  const dBefore = dispatcher.texts().length;
  F.usageAnswer(node, 'hold until 18:40');
  const h = await send({ from: 'fixture-node/planner', to: 'operator', body: 'held by usage' });
  assert.equal(h.decision, 'held');
  assert.match(h.reason, /usage gate: hold until 18:40/);
  await settle();
  const lines = dispatcher.texts().slice(dBefore);
  assert.equal(lines.length, 1, 'exactly one line to the dispatcher window');
  assert.match(lines[0], /^\[hub\] usage gate: hold until 18:40/);
  assert.equal((await send({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-u.md §1', body: 'a window message is not gated', approval: '2026-10-19' })).decision, 'delivered');
  assert.equal(F.usageAsked(node).length, askedBefore + 5, 'the gate is asked only before a spawn');
  F.usageAnswer(node, 'go');
  const n2 = await F.makeNode({ mutate: (r) => { r.services.usage.cli = 'tools/usage/gone gate'; } });
  try {
    F.up(n2);
    const r = (await client.call(n2.port, 'POST', '/route', { token: n2.token, body: { from: 'fixture-node/planner', to: 'operator', body: 'x' }, timeoutMs: 5000 })).body.results[0];
    assert.equal(r.decision, 'held');
    assert.match(r.reason, /usage gate: tools\/usage\/gone gate is not at .*; every spawn is refused until it is/);
  } finally { F.down(n2); F.cleanup(n2); }
  const n3 = await F.makeNode({ mutate: (r) => { delete r.services.usage; } });
  try {
    F.up(n3);
    assert.equal(JSON.parse(F.hub(n3, ['status', '--json']).stdout).usage_gate, 'off');
    const r = (await client.call(n3.port, 'POST', '/route', { token: n3.token, body: { from: 'fixture-node/planner', to: 'operator', body: 'x' }, timeoutMs: 5000 })).body.results[0];
    assert.equal(r.decision, 'queued', 'no row: the node runs without the gate');
  } finally { F.down(n3); F.cleanup(n3); }
});

test('limits both ways: the export names exactly hub.json\'s limits keys and vocab.LIMITS, each with its value', async () => {
  const a = await call('GET', '/limits');
  assert.equal(a.status, 200);
  const names = a.body.limits.map((l) => l.name).sort();
  assert.deepEqual(names, Object.keys(node.registry.limits).sort());
  assert.deepEqual(names, [...V.LIMITS].sort());
  for (const l of a.body.limits) { assert.equal(l.value, node.registry.limits[l.name]); assert.ok(l.where && l.enforced_in, l.name); }
  const printed = JSON.parse(F.hub(node, ['limits', '--json']).stdout);
  assert.deepEqual(printed, a.body);
  assert.match(F.hub(node, ['limits']).stdout, /^hops = 8  \(H1a-2: /m);
  assert.deepEqual(a.body.limits.filter((l) => l.enforced_in === 'H1a-2').map((l) => l.name).sort(), ['budget_per_conversation', 'hops', 'question_max_blocks', 'stub_chars']);
});

test('hops: a message over limits.hops is a dead letter and a limit row', async () => {
  const r = await send({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-h.md §1', body: 'hopped', approval: '2026-10-19', hops: 8 });
  assert.equal(r.decision, 'dead-letter');
  assert.match(r.reason, /hop limit: 9 > limits\.hops = 8/);
  const lim = rows().filter((x) => x.kind === 'limit').at(-1);
  assert.deepEqual([lim.limit, lim.value], ['hops', 8]);
});

test('routing rules: addressed here, below (unregistered child: the dispatcher with a notice), tagged, reserved targets, the fallback; a window with no socket is a dead letter and a delivery message', async () => {
  const d1 = await send({ from: 'fixture-node/planner', to: 'fixture-node/dispatcher', body: 'rule 1' });
  assert.deepEqual([d1.decision, d1.rule, d1.target], ['delivered', 1, 'dispatcher']);
  const d2 = await send({ from: 'fixture-node/planner', to: 'fixture-node/kid/coder', body: 'rule 2' });
  assert.deepEqual([d2.decision, d2.rule, d2.target, d2.routed_by], ['delivered', 2, 'dispatcher', 'dispatcher']);
  await settle();
  assert.match(dispatcher.texts().at(-1), /routed_by: dispatcher/);
  assert.match(routeRows().at(-1).reason, /child kid is not registered \(H3\); routed to the fallback dispatcher instead/);
  const q = await send({ from: 'fixture-node/dispatcher', tag: 'question', kind_hint: 'plan', ref: 'PLAN-q.md §1', body: '[plan] which design?' });
  assert.deepEqual([q.decision, q.rule, q.target], ['delivered', 3, 'planner']);
  await settle();
  assert.match(planner.texts().at(-1), /^\[hub\] question from fixture-node\/dispatcher, origin: model\n\[plan\] which design\?/);
  const qk = await send({ from: 'fixture-node/dispatcher', tag: 'question', ref: 'PLAN-q.md §2', body: 'no kind named' });
  assert.deepEqual([qk.decision, qk.target, qk.routed_by], ['delivered', 'dispatcher', 'dispatcher']);
  const rep = await send({ from: 'fixture-node/dispatcher', tag: 'report', ref: 'PLAN-q.md §1', body: 'back to the sender' });
  assert.deepEqual([rep.decision, rep.target, rep.rule], ['delivered', 'dispatcher', 3]);
  const task = await send({ from: 'fixture-node/planner', tag: 'task', ref: 'site/src.txt:1', body: 'for the role whose dir holds it' });
  assert.deepEqual([task.decision, task.target], ['queued', 'site']);
  const own = await send({ from: 'fixture-node/planner', tag: 'bug-report', ref: 'site/data.db:3', body: 'a claim about site' });
  assert.deepEqual([own.decision, own.target], ['queued', 'site']);
  const noOwner = await send({ from: 'fixture-node/planner', tag: 'bug-report', ref: 'elsewhere/x.js:1', body: 'nobody owns it' });
  assert.equal(noOwner.decision, 'dead-letter');
  assert.match(noOwner.reason, /@owner: the ref "elsewhere\/x\.js:1" names no path/);
  const wr = await send({ from: 'fixture-node/planner', tag: 'write-request', ref: 'TODO.md "x"', body: 'to the service' });
  assert.deepEqual([wr.decision, wr.target, wr.via], ['queued', 'write', 'service']);
  assert.ok(fs.existsSync(path.join(node.root, '.hub', 'queue', '@write', `${wr.id}.json`)));
  const unknown = await send({ from: 'fixture-node/planner', tag: 'no-such-tag', body: 'rule 4' });
  assert.deepEqual([unknown.decision, unknown.rule, unknown.target, unknown.routed_by], ['delivered', 4, 'dispatcher', 'dispatcher']);
  const st = JSON.parse(F.hub(node, ['status', '--json']).stdout);
  assert.ok(st.queued >= 4 && st.turns.model > 0 && st.turns.validate > st.turns.model, JSON.stringify(st.turns));
  // a window with no socket: dead letter, and the delivery failure to the owners row
  const n2 = await F.makeNode();
  try {
    F.up(n2);
    const p2 = await F.listenSocket(n2.root, 'planner');
    F.hook(n2, 'session-start', { session_id: 'p2', agent_type: 'planner', hook_event_name: 'SessionStart' }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: p2.path } });
    const r = (await client.call(n2.port, 'POST', '/route', { token: n2.token, body: { from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-x.md §1', body: 'nobody listens', approval: '2026-10-19' }, timeoutMs: 5000 })).body.results[0];
    assert.equal(r.decision, 'dead-letter');
    assert.match(r.reason, /dispatcher: no session with an inbox socket is recorded/);
    await new Promise((res) => setTimeout(res, 200));
    assert.ok(p2.texts().some((t) => /kind: delivery/.test(t) && /no socket recorded for window role dispatcher/.test(t)), JSON.stringify(p2.texts()));
    await p2.close();
  } finally { F.down(n2); F.cleanup(n2); }
});

test('determinism: 100 fixture envelopes decide identically twice against the same registry, and a ledger row replays to its decision', async () => {
  const d = node.registry;
  const tags = ['dispatch', 'question', 'report', 'task', 'bug-report', 'write-request', 'no-such-tag', undefined];
  const tos = [undefined, 'fixture-node/dispatcher', 'operator', 'fixture-node/kid/x', 'elsewhere/y'];
  const refs = ['PLAN-x.md §1', 'site/src.txt:1', 'tools/items/todo.json:2', 'nowhere/z:1', null];
  const envs = [];
  for (let i = 0; i < 100; i++) envs.push({ id: `e${i}`, conversation: `c${i % 7}`, from: i % 2 ? 'fixture-node/planner' : 'fixture-node/dispatcher', to: tos[i % tos.length], tag: tags[i % tags.length], kind_hint: i % 3 ? 'plan' : null, ref: refs[i % refs.length], body: `b${i}`, hops: i % 9 });
  const once = envs.map((e) => R.decide(d, e));
  const twice = envs.map((e) => R.decide(d, e));
  assert.deepEqual(once, twice);
  assert.ok(new Set(once.map((x) => `${x.rule}:${x.target}:${x.via}`)).size > 5, 'the fixture exercises several routes');
  const other = JSON.parse(JSON.stringify(d)); other.tags.task = 'operator';
  assert.notDeepEqual(envs.map((e) => R.decide(other, e)), once, 'a changed registry changes decisions: the comparison is real');
  // every routed row whose decision the registry made (not a failure message, which the owners table routes)
  const replayed = routeRows().filter((x) => x.envelope && x.target && x.decision !== 'dead-letter' && !x.kind);
  assert.ok(replayed.length > 10, 'rows to replay');
  for (const r of replayed) {
    const again = R.decide(d, r.envelope);
    const expectedTarget = r.reason && r.reason.includes('is not registered (H3)') ? 'kid' : r.target;
    assert.equal(again.target, expectedTarget, `row ${r.id} replays: ${r.reason}`);
  }
});

test('hub send prints the decision and exits by it; hub log lists the rows; the restart after a kill keeps sessions, queue and prompts', async () => {
  // from a role with no session: no prompt record, so model
  const s = F.hub(node, ['send', '--tag', 'dispatch', '--ref', 'PLAN-s.md §1', '--approval', '2026-10-19', '--from', 'fixture-node/operator', 'sent from the command line']);
  assert.equal(s.code, 0, s.stderr);
  assert.match(s.stdout.trim(), /^[0-9a-f-]{36} delivered -> dispatcher \(role\), origin model$/);
  await settle();
  assert.match(dispatcher.texts().at(-1), /sent from the command line/);
  const held = F.hub(node, ['send', '--to', 'operator', '--from', 'fixture-node/planner', 'needs a usage answer']);
  assert.equal(held.code, 0);
  assert.match(held.stdout, /queued -> operator/);
  const l = F.hub(node, ['log', '--kind', 'delivered', '--limit', '3']);
  assert.equal(l.code, 0);
  assert.equal(l.stdout.trim().split('\n').length, 3);
  assert.match(l.stdout, /\/route delivered dispatch fixture-node\/operator -> dispatcher origin model/);
  const u = F.hub(node, ['log', '--usage']);
  assert.match(u.stdout, /no spawn rows carry usage yet .*the unit is 29000 tokens/);
  // kill and restart: sessions, the queue and the prompt records come back
  const before = JSON.parse(F.hub(node, ['status', '--json']).stdout);
  const pid = F.pidfile(node).pid;
  process.kill(pid, 'SIGKILL');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { try { process.kill(pid, 0); } catch { break; } await new Promise((r) => setTimeout(r, 20)); }
  assert.equal(F.hub(node, ['up']).code, 0);
  const after = JSON.parse(F.hub(node, ['status', '--json']).stdout);
  assert.equal(after.sessions, before.sessions);
  assert.equal(after.queued, before.queued);
  const r = await send({ from: 'fixture-node/planner', tag: 'dispatch', ref: 'PLAN-r.md §1', body: 'after the restart', approval: '2026-10-19', session_id: 'planner-s' });
  assert.equal(r.decision, 'delivered', 'the dispatcher\'s socket was restored');
  assert.ok(r.origin === 'jacob' || r.origin === 'model');
  assert.equal(r.origin, O.classify(rows().filter((x) => x.kind === 'prompt' && x.session === 'planner-s').map((x) => ({ hash: x.hash, ctx_id: x.ctx_id, typed: x.typed !== false })), null).origin, 'the stamp reads the restored prompt records');
});

test('the audit rule for limits: no numeric literal on a limit\'s code path in src/', () => {
  const srcDir = path.join(F.TOOL, 'src');
  const findings = [];
  for (const f of fs.readdirSync(srcDir)) {
    const lines = fs.readFileSync(path.join(srcDir, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      for (const name of V.LIMITS) {
        if (!line.includes(`'${name}'`) && !line.includes(`.${name}`)) continue;
        if (/\b\d{2,}\b/.test(line.replace(/'[^']*'/g, '').replace(/`[^`]*`/g, ''))) findings.push(`src/${f}:${i + 1}: ${name} beside a numeric literal: ${line.trim().slice(0, 80)}`);
      }
    });
  }
  assert.deepEqual(findings, []);
  // the rule can fail: a planted line is caught
  assert.ok(/\b\d{2,}\b/.test("const b = st.registry.limits.hops || 10;".replace(/'[^']*'/g, '')));
  assert.deepEqual(reg.loadStarter().limits && Object.keys(reg.loadStarter().limits).sort(), [...V.LIMITS].sort(), 'the starter carries every limit');
});
