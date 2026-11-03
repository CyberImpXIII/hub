'use strict';
// The four hooks (PLAN-hub.md §1, §3; §8 "kill the server" hook half, "fails open,
// every hook"): planner-stop and dispatcher-stop forward through /route and, with the
// server killed, relay direct or block once; session-start records with and without
// the server; user-prompt stores the prompt with the server killed; every hook exits
// 0 on malformed input with no block.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('./fixture');

let node; let planner; let dispatcher;

async function killServer() {
  const pid = F.pidfile(node).pid;
  process.kill(pid, 'SIGKILL');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { try { process.kill(pid, 0); } catch { return; } await new Promise((r) => setTimeout(r, 20)); }
}

test.before(async () => {
  node = await F.makeNode();
  F.up(node);
  planner = await F.listenSocket(node.root, 'planner');
  dispatcher = await F.listenSocket(node.root, 'dispatcher');
  F.hook(node, 'session-start', { session_id: 'planner-s', agent_type: 'planner', permission_mode: 'default', hook_event_name: 'SessionStart' }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: planner.path } });
  F.hook(node, 'session-start', { session_id: 'dispatcher-s', agent_type: 'dispatcher', permission_mode: 'default', hook_event_name: 'SessionStart' }, { extra: { CLAUDE_CODE_MESSAGING_SOCKET: dispatcher.path } });
});
test.after(async () => { F.down(node); await planner.close(); await dispatcher.close(); F.cleanup(node); });

const REPLY = '# done\n\nSome text.\n\n## Dispatch\n\n1. PLAN-x.md §3 -- build the gate -- approved: Jacob 2026-10-03\n2. a line the parser rejects\n\n## Needs your yes\n\n1. PLAN-y.md §1 -- waits -- approved: Jacob 2026-10-01\n';

test('planner-stop: the Dispatch section goes through /route, items and malformed lines, nothing on success; a repeat is not resent; stop_hook_active is a no-op; no section sends nothing', async () => {
  const before = dispatcher.texts().length;
  const r = F.hook(node, 'planner-stop', { session_id: 'planner-s', last_assistant_message: REPLY, agent_type: 'planner' });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.out, null, 'nothing on success');
  await new Promise((res) => setTimeout(res, 200));
  const texts = dispatcher.texts().slice(before);
  assert.equal(texts.length, 2, JSON.stringify(texts));
  assert.match(texts[0], /^\[hub\] dispatch from fixture-node\/planner, origin: model\nbuild the gate\n\[ref: PLAN-x\.md §3; approval: Jacob 2026-10-03/);
  assert.match(texts[1], /^\[hub\] dispatch-malformed from fixture-node\/planner, origin: model\n2\. a line the parser rejects \|\| reason: no ` -- ` separators/);
  assert.ok(texts[1].includes('grammar:'));
  assert.ok(!texts.some((t) => t.includes('waits')), 'Needs your yes is never sent');
  const again = F.hook(node, 'planner-stop', { session_id: 'planner-s', last_assistant_message: REPLY, agent_type: 'planner' });
  assert.match(again.out.systemMessage, /dropped: identical to message/);
  assert.equal(dispatcher.texts().length, before + 2, 'a duplicate section is not resent');
  const active = F.hook(node, 'planner-stop', { session_id: 'planner-s', last_assistant_message: REPLY, stop_hook_active: true, agent_type: 'planner' });
  assert.equal(active.out, null);
  assert.equal(dispatcher.texts().length, before + 2);
  const none = F.hook(node, 'planner-stop', { session_id: 'planner-s', last_assistant_message: 'no section here\n', agent_type: 'planner' });
  assert.equal(none.out, null);
  assert.equal(dispatcher.texts().length, before + 2);
  // the planner's own gate notices and never blocks
  const q = F.hook(node, 'planner-stop', { session_id: 'planner-s', last_assistant_message: 'Should we do this?\n\n## Decisions\n\n| # | decision | hinges on | recommend |\n|---|---|---|---|\n| 1 | no pointer | x | yes |\n', agent_type: 'planner' });
  assert.equal(q.code, 0);
  assert.equal(q.out.decision, undefined, 'never a block');
  assert.match(q.out.systemMessage, /Decisions row off the shape: row 1/);
  assert.match(q.out.systemMessage, /a question outside ## Decisions: Should we do this\?/);
});

test('dispatcher-stop: [dispatch] passes, [plan] is forwarded to the planner as a question (never jacob), [context] and a ? outside the section are blocked once, then labelled', async () => {
  await new Promise((res) => setTimeout(res, 300)); // the previous test's notices to the planner land
  const pBefore = planner.texts().length;
  const pass = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: '## Needs Jacob\n\n1. [dispatch] harness is still running after 40 minutes; wait or stop it? -- blocks: TODO.md "x"\n', agent_type: 'dispatcher' });
  assert.equal(pass.out, null, 'a dispatch question passes to Jacob unchanged');
  const fwd = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: '## Needs Jacob\n\n1. [plan] keep graphify-eval or promote it? -- blocks: PLAN-x.md §2\n', agent_type: 'dispatcher' });
  assert.equal(fwd.code, 0);
  assert.equal(fwd.out.decision, undefined);
  assert.match(fwd.out.systemMessage, /forwarded to the planner: delivered -> planner/);
  await new Promise((res) => setTimeout(res, 200));
  const texts = planner.texts().slice(pBefore).filter((t) => !t.startsWith('[hub] identical'));
  assert.equal(texts.length, 1, JSON.stringify(texts));
  assert.match(texts[0], /^\[hub\] question from fixture-node\/dispatcher, origin: model\n\[plan\] keep graphify-eval or promote it\?\n\[ref: PLAN-x\.md §2/);
  assert.ok(!texts[0].includes('origin: jacob'));
  const ctx = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: '## Needs Jacob\n\n1. [context] does fill take a label or a selector? -- blocks: PLAN-y.md §1\n', agent_type: 'dispatcher' });
  assert.equal(ctx.out.decision, 'block');
  assert.match(ctx.out.reason, /\[context\] does fill take a label.*dispatch a read-only question brief to the owner.*do not ask Jacob/);
  const outside = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: 'Is the queue blocked?\n\nDone.\n', agent_type: 'dispatcher' });
  assert.equal(outside.out.decision, 'block');
  assert.match(outside.out.reason, /a question outside ## Needs Jacob: `Is the queue blocked\?`/);
  const second = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: 'Is the queue blocked?\n\nDone.\n', stop_hook_active: true, agent_type: 'dispatcher' });
  assert.equal(second.out.decision, undefined, 'bounded: the second pass passes');
  assert.match(second.out.systemMessage, /rule not met: a question outside ## Needs Jacob/);
  const off = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: '## Needs Jacob\n\n1. [riddle] what? -- blocks: x\n', agent_type: 'dispatcher' });
  assert.equal(off.out.decision, 'block');
  assert.match(off.out.reason, /unknown type \[riddle\]/);
  const quiet = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: 'Dispatched two items. Done.\n', agent_type: 'dispatcher' });
  assert.equal(quiet.out, null, 'a reply with no questions passes with no block');
});

test('every hook exits 0 on malformed input, with no block', () => {
  for (const name of ['planner-stop', 'dispatcher-stop', 'session-start', 'user-prompt', 'gate']) {
    for (const raw of ['not json', '[]', '{}', '{"session_id": 3}', JSON.stringify({ session_id: 's', last_assistant_message: 5 })]) {
      const r = F.hook(node, name, raw);
      assert.equal(r.code, 0, `${name} on ${raw}: ${r.stderr}`);
      if (name !== 'gate') assert.ok(!r.out || r.out.decision !== 'block', `${name} on ${raw} never blocks`);
    }
  }
});

test('session-start without a server and user-prompt with the server killed still record; planner-stop and dispatcher-stop relay direct and block once', async () => {
  const pBefore = planner.texts().length;
  const dBefore = dispatcher.texts().length;
  await killServer();
  // session-start: the record goes to .hub/sessions/ for hub up to restore
  const s = F.hook(node, 'session-start', { session_id: 'operator-s', agent_type: 'operator', permission_mode: 'dontAsk', hook_event_name: 'SessionStart' });
  assert.equal(s.code, 0);
  assert.match(s.out.systemMessage, /hub down; session operator-s recorded locally as operator/);
  assert.ok(fs.existsSync(path.join(node.root, '.hub', 'sessions', 'operator-s.json')));
  // user-prompt: the prompt is still stored, the record kept by the hook
  const words = 'typed while the hub is down';
  const u = F.hook(node, 'user-prompt', { session_id: 'planner-s', prompt: words, hook_event_name: 'UserPromptSubmit' });
  assert.equal(u.code, 0);
  assert.match(u.out.systemMessage, /hub down; prompt recorded locally as ctx:[0-9a-f]{8}/);
  const rec = F.ledgerRows(node).filter((r) => r.kind === 'prompt' && r.session === 'planner-s').at(-1);
  assert.deepEqual([rec.by, rec.typed, rec.decision], ['hook', true, 'jacob']);
  assert.equal(F.hub(node, ['get', rec.ctx_id]).stdout.split('\n')[1], words, 'the store holds it');
  // planner-stop: relayed direct to the dispatcher's recorded socket, stamped from the ledger
  const r = F.hook(node, 'planner-stop', { session_id: 'planner-s', last_assistant_message: '## Dispatch\n\n1. PLAN-k.md §1 -- while down -- approved: Jacob 2026-10-19\n', agent_type: 'planner' });
  assert.equal(r.code, 0);
  assert.match(r.out.systemMessage, /hub down; relayed direct: 1 of 1 item\(s\) to dispatcher/);
  await new Promise((res) => setTimeout(res, 200));
  const texts = dispatcher.texts().slice(dBefore);
  assert.equal(texts.length, 1);
  assert.match(texts[0], /^\[hub\] dispatch from fixture-node\/planner, origin: jacob, origin_id: ctx:[0-9a-f]{8}\nwhile down/);
  const again = F.hook(node, 'planner-stop', { session_id: 'planner-s', last_assistant_message: '## Dispatch\n\n1. PLAN-k.md §1 -- while down -- approved: Jacob 2026-10-19\n', agent_type: 'planner' });
  assert.match(again.out.systemMessage, /0 of 1 item\(s\) to dispatcher \(duplicates dropped\)/);
  assert.equal(dispatcher.texts().length, dBefore + 1, 'a duplicate is not resent while down either');
  const direct = F.ledgerRows(node).filter((x) => x.decision === 'relayed-direct');
  assert.equal(direct.length, 1);
  assert.equal(direct[0].by, 'hook');
  // the relayed text, typed back in the dispatcher window, is the hub's: origin model
  const echo = F.hook(node, 'user-prompt', { session_id: 'dispatcher-s', prompt: texts[0], hook_event_name: 'UserPromptSubmit' });
  assert.equal(F.ledgerRows(node).filter((x) => x.kind === 'prompt' && x.session === 'dispatcher-s').at(-1).decision, 'model', echo.out && echo.out.systemMessage);
  // dispatcher-stop: a plan question goes straight to the planner's socket; a context question still blocks once
  const fwd = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: '## Needs Jacob\n\n1. [plan] which design, while down? -- blocks: PLAN-k.md §2\n', agent_type: 'dispatcher' });
  assert.equal(fwd.out.decision, undefined);
  assert.match(fwd.out.systemMessage, /hub down; forwarded direct to planner: 1 question\(s\)/);
  await new Promise((res) => setTimeout(res, 200));
  assert.match(planner.texts().slice(pBefore).at(-1), /\[plan\] which design, while down\?/);
  const ctx = F.hook(node, 'dispatcher-stop', { session_id: 'dispatcher-s', last_assistant_message: '## Needs Jacob\n\n1. [context] what does X do? -- blocks: PLAN-k.md §3\n', agent_type: 'dispatcher' });
  assert.equal(ctx.out.decision, 'block', 'the one block still happens with the server down');
  // back up: the server restores the session the hook recorded and the prompt the hook kept
  assert.equal(F.hub(node, ['up']).code, 0);
  const st = JSON.parse(F.hub(node, ['status', '--json']).stdout);
  assert.equal(st.sessions, 3);
  assert.match(F.hub(node, ['origin', '--session', 'planner-s']).stdout, /^jacob ctx:[0-9a-f]{8}: the latest recorded prompt is one Jacob typed/);
});
