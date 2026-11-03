'use strict';
// The `route` service (PLAN-hub.md §3; routing-tree §3, §6, §13.3, §14.3): for every
// envelope, in this order and with no model: validate; stamp origin; admission
// (identical dropped, invalid dead-lettered, the usage gate before a spawn, the
// budget since Jacob last typed); route by the registry; deliver; one ledger row
// with the registry hash that produced the decision. A failure the server detects
// becomes a message of its seam kind to the owners row, never a log line that ends
// there; dead-letter is where the message rests. Every limit read here is a
// hub.json `limits` value (Decision 4; LIMITS_EXPORT names each one and where).
//
// The server's state (st): registry, hash, sessions (session_id -> record),
// prompts (session_id -> [prompt records]), delivered (session_id -> Set of hashes
// of texts the hub wrote to that session's socket), held, deadLetter, queued,
// counts (conversation -> model-starting messages since Jacob last typed), turns
// (model turns by the step that caused them, §14.3).

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const reg = require('./registry');
const V = require('./vocab');
const E = require('./envelope');
const R = require('./route');
const O = require('./origin');
const S = require('./store');
const D = require('./deliver');
const ledger = require('./ledger');

const SOCKET_TIMEOUT_MS = 2000;
const GATE_TIMEOUT_MS = 10000;

// Every limit, where it is read, and the phase that enforces it (§8 "limits both
// ways"): the test diffs these names against hub.json's keys and vocab.LIMITS.
const LIMITS_EXPORT = [
  { name: 'hops', where: 'relay.js admit: hops over the limit dead-letters', enforced_in: 'H1a-2' },
  { name: 'budget_per_conversation', where: 'relay.js admit: model-starting messages since Jacob last typed are held past it', enforced_in: 'H1a-2' },
  { name: 'stub_chars', where: 'store.js stub and pasted: the stub line is cut at it, a body carrying more of a record is flagged', enforced_in: 'H1a-2' },
  { name: 'question_max_blocks', where: 'cli.js hook dispatcher-stop: blocks per reply', enforced_in: 'H1a-2' },
  { name: 'pingpong_hold', where: 'relay.js (H2): an exchange with no commit held at it', enforced_in: 'H2' },
  { name: 'role_silence_s', where: 'spawn (H2): a kept role silent past it is hung', enforced_in: 'H2' },
  { name: 'role_daily_budget', where: 'spawn (H2): a kept role\'s requests per day', enforced_in: 'H2' },
  { name: 'heartbeat_s', where: 'children (H3): the parent polls a child every so many seconds', enforced_in: 'H3' },
  { name: 'heartbeat_misses', where: 'children (H3): misses before a child is down', enforced_in: 'H3' },
];

function limit(st, name) {
  const v = st.registry.limits && st.registry.limits[name];
  if (!Number.isInteger(v)) throw new Error(`hub.json limits.${name} is not set: hub check refuses such a registry`);
  return v;
}

function roleOf(st, agentType) {
  const roles = st.registry.roles || {};
  if (roles[agentType]) return agentType;
  const byAgent = Object.keys(roles).find((n) => roles[n].agent === agentType);
  return byAgent || agentType;
}

// The latest session recorded for a role, or null.
function sessionForRole(st, role) {
  let best = null;
  for (const s of st.sessions.values()) if (s.role === role && (!best || s.ts > best.ts)) best = s;
  return best;
}

function sessionsForRole(st, role) { return [...st.sessions.values()].filter((s) => s.role === role); }

function row(st, env, extra) {
  return ledger.append(st.root, {
    route: '/route', by: 'server',
    id: env.id, conversation: env.conversation, from: env.from, to: env.to || null, tag: env.tag || null,
    origin: env.origin || null, origin_id: env.origin_id || null, kind: env.kind || null,
    hash: E.itemHash(env), registry_hash: st.hash, envelope: env,
    ...extra,
  });
}

// One line to a window role's socket, not an envelope: the notice the sender gets
// when its message was dropped, held or dead-lettered (never silent, never a loop).
async function notice(st, role, text) {
  const s = sessionForRole(st, role);
  if (!s || !s.socket) return { ok: false, why: `${role}: no session with a socket recorded` };
  const r = await D.toSocket(s.socket, `[hub] ${text}`, SOCKET_TIMEOUT_MS);
  return r;
}

// The text a window reads: the same facts the relay delivers today (auto-relay §4),
// origin stamped by the server, the record's stub and never its text (§12).
function deliveredText(env) {
  const head = [`[hub] ${env.tag || 'message'} from ${env.from}`, `origin: ${env.origin}`];
  if (env.origin_id) head.push(`origin_id: ${env.origin_id}`);
  if (env.routed_by) head.push(`routed_by: ${env.routed_by}`);
  if (env.kind) head.push(`kind: ${env.kind}`);
  const tail = [];
  if (env.ref) tail.push(`ref: ${env.ref}`);
  if (env.approval) tail.push(`approval: Jacob ${env.approval}`);
  tail.push(`id: ${env.id}`, `conversation: ${env.conversation}`);
  const stub = env.refs && env.refs.length ? `\n${env.refs.map((r) => r.text).join('\n')}` : '';
  return `${head.join(', ')}${stub}\n${env.body}\n[${tail.join('; ')}]`;
}

function deadLetter(st, env, reason, decision) {
  const entry = { id: env.id, reason, ts: new Date().toISOString(), envelope: env };
  D.writeJson(st.root, D.DEAD_DIR, env.id, entry);
  st.deadLetter.push(entry);
  return row(st, env, { decision: 'dead-letter', reason, target: decision ? decision.target : null, via: decision ? decision.via : null, rule: decision ? decision.rule : null, routed_by: decision ? decision.routed_by : null });
}

// A failure the server detected, as a message of its seam kind to the owners row
// (routing-tree §14.7). The owner is a role here (delivered or queued), a child or
// a name no role carries (queued under its name): a message, never a log line.
async function failureMessage(st, kind, about, reason) {
  const owners = st.registry.owners || {};
  let owner = owners[kind];
  let routedBy = null;
  if (owner === undefined) { owner = owners[V.UNOWNED] || R.dispatcherOf(st.registry); routedBy = R.dispatcherOf(st.registry); }
  if (typeof owner === 'string' && owner.includes('{repo}')) owner = R.dispatcherOf(st.registry); // the template needs H2's repo claims
  if (owner === '@from') owner = about.from.split('/').pop();
  const env = E.strip({ from: `${st.registry.node}/hub`, to: null, tag: kind, ref: about.id, body: `${kind}: ${reason} (message ${about.id}, tag ${about.tag || 'none'}, from ${about.from})`, conversation: about.conversation, hops: 0 });
  env.origin = 'model';
  env.kind = kind;
  env.routed_by = routedBy;
  const roles = st.registry.roles || {};
  let delivered;
  if (roles[owner]) delivered = await deliverTo(st, env, { target: owner, via: 'role', rule: 3, routed_by: routedBy, reason: `seam kind ${kind} -> owners row ${owner}` }, true);
  else {
    D.writeJson(st.root, path.join(D.QUEUE_DIR, owner), env.id, env);
    st.queued.push({ id: env.id, target: owner, via: 'owner', ts: env.ts });
    row(st, env, { decision: 'queued', target: owner, via: 'owner', rule: 3, routed_by: routedBy, reason: `seam kind ${kind} -> owners row ${owner}: queued under ${D.QUEUE_DIR}/${owner}/ (no role carries ${owner})` });
    delivered = { decision: 'queued', target: owner };
  }
  return delivered;
}

// Deliver a decided envelope: a window's socket, a process role's queue, a service's
// queue, a child (unregistered until H3: the dispatcher, with a notice), the parent.
async function deliverTo(st, env, decision, internal) {
  const roles = st.registry.roles || {};
  const t = decision.target;
  if (decision.via === 'role' && roles[t]) {
    if (roles[t].mode === 'window') {
      const s = sessionForRole(st, t);
      if (!s || !s.socket) {
        const reason = `${t}: no session with an inbox socket is recorded (hub hook session-start records it)`;
        const id = deadLetter(st, env, reason, decision);
        if (!internal) await failureMessage(st, 'delivery', env, `no socket recorded for window role ${t}`);
        return { decision: 'dead-letter', target: t, via: 'role', ledger: id, reason };
      }
      const text = deliveredText(env);
      const r = await D.toSocket(s.socket, text, SOCKET_TIMEOUT_MS);
      if (!r.ok) {
        const reason = `delivery to ${t} failed: ${r.why}`;
        const id = deadLetter(st, env, reason, decision);
        if (!internal) await failureMessage(st, 'delivery', env, `delivery to window role ${t} failed: ${r.why}`);
        return { decision: 'dead-letter', target: t, via: 'role', ledger: id, reason };
      }
      if (!st.delivered.has(s.session_id)) st.delivered.set(s.session_id, new Set());
      st.delivered.get(s.session_id).add(O.promptHash(text));
      const id = row(st, env, { decision: 'delivered', target: t, via: 'role', rule: decision.rule, routed_by: decision.routed_by, reason: decision.reason, session: s.session_id });
      return { decision: 'delivered', target: t, via: 'role', routed_by: decision.routed_by || null, ledger: id };
    }
    // a process or driven role: queued for the spawner (H1b)
    D.writeJson(st.root, path.join(D.QUEUE_DIR, t), env.id, env);
    st.queued.push({ id: env.id, target: t, via: 'role', ts: new Date().toISOString() });
    const id = row(st, env, { decision: 'queued', target: t, via: 'role', rule: decision.rule, routed_by: decision.routed_by, reason: `${decision.reason}; queued under ${D.QUEUE_DIR}/${t}/ for the spawner (H1b)` });
    return { decision: 'queued', target: t, via: 'role', routed_by: decision.routed_by || null, ledger: id };
  }
  if (decision.via === 'child') {
    // no child registers before H3: the node's dispatcher takes it, with a notice naming the child (routing-tree §9)
    const disp = R.dispatcherOf(st.registry);
    const note = `child ${t} is not registered (H3); routed to the fallback ${disp} instead`;
    if (disp && disp !== t) {
      const d2 = { ...decision, target: disp, via: 'role', routed_by: disp, reason: `${decision.reason}; ${note}` };
      env.routed_by = disp;
      return deliverTo(st, env, d2, internal);
    }
    const id = deadLetter(st, env, note, decision);
    return { decision: 'dead-letter', target: t, via: 'child', ledger: id, reason: note };
  }
  if (decision.via === 'service' || decision.via === 'parent') {
    const dir = decision.via === 'service' ? `@${t}` : '@parent';
    D.writeJson(st.root, path.join(D.QUEUE_DIR, dir), env.id, env);
    st.queued.push({ id: env.id, target: dir, via: decision.via, ts: new Date().toISOString() });
    const id = row(st, env, { decision: 'queued', target: t, via: decision.via, rule: decision.rule, routed_by: decision.routed_by, reason: `${decision.reason}; queued under ${D.QUEUE_DIR}/${dir}/ (${decision.via === 'service' ? 'the service arrives with H1b/G1' : 'H3 forwards up'})` });
    return { decision: 'queued', target: t, via: decision.via, routed_by: decision.routed_by || null, ledger: id };
  }
  const id = deadLetter(st, env, decision.reason, decision);
  if (!internal) await failureMessage(st, 'delivery', env, decision.reason);
  return { decision: 'dead-letter', target: t, via: decision.via || null, routed_by: decision.routed_by || null, ledger: id, reason: decision.reason };
}

// The usage gate (§3; PLAN-usage-reporting.md §3): `<cli> <estimate>`; exit 0 is go.
function askUsageGate(st, env) {
  const svc = st.registry.services && st.registry.services[V.USAGE_SERVICE];
  if (!svc) return { go: true, word: 'off', reason: 'usage gate: off (no services.usage row)' };
  const words = String(svc.cli).trim().split(/\s+/);
  const cli = path.isAbsolute(words[0]) ? words[0] : path.join(st.root, words[0]);
  if (!fs.existsSync(cli)) return { go: false, word: 'missing', reason: `usage gate: ${svc.cli} is not at ${cli}; every spawn is refused until it is` };
  const estimate = Number.isInteger(env.estimate) ? env.estimate : svc.unit_tokens;
  const r = spawnSync(cli, [...words.slice(1), String(estimate)], { cwd: st.root, encoding: 'utf8', timeout: GATE_TIMEOUT_MS });
  if (r.error) return { go: false, word: 'error', reason: `usage gate: ${svc.cli}: ${r.error.code || r.error.message}` };
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.status === 0) return { go: true, word: 'go', reason: `usage gate: go for ${estimate} tokens${out ? ` (${out.split('\n')[0]})` : ''}`, estimate };
  const word = (out.split(/\s+/)[0] || '').toLowerCase();
  if (word === 'warn') {
    if (env.checkpoint) return { go: true, word, reason: `usage gate: warn, but the brief names a checkpoint (${env.checkpoint}); the spawn's prompt says so`, estimate, note: out };
    return { go: false, word, reason: `usage gate: warn and no checkpoint named: held (${out.split('\n')[0]})`, estimate };
  }
  if (word === 'hold') return { go: false, word, reason: `usage gate: ${out.split('\n')[0]}`, estimate, tellJacob: true };
  return { go: false, word: word || `exit ${r.status}`, reason: `usage gate: exit ${r.status}${out ? `: ${out.split('\n')[0]}` : ''}: held` };
}

function hold(st, env, decision, reason, extra) {
  const entry = { id: env.id, reason, ts: new Date().toISOString(), envelope: env, decision, ...extra };
  D.writeJson(st.root, D.HELD_DIR, env.id, entry);
  st.held.push(entry);
  return row(st, env, { decision: 'held', reason, target: decision.target, via: decision.via, rule: decision.rule, routed_by: decision.routed_by, ...extra });
}

// Admission and delivery for one envelope that has been validated and stamped.
async function admit(st, env, decision, released) {
  const roles = st.registry.roles || {};
  const spawns = decision.via === 'role' && roles[decision.target] && roles[decision.target].mode !== 'window';
  if (spawns) {
    const g = askUsageGate(st, env);
    if (!g.go) {
      const id = hold(st, env, decision, g.reason, { gate: g.word });
      if (g.tellJacob && !released) await notice(st, R.dispatcherOf(st.registry), `${g.reason} (message ${env.id} held)`);
      return { decision: 'held', target: decision.target, ledger: id, reason: g.reason };
    }
    env.gate = g.reason;
  }
  if (R.startsModelTurn(env, decision)) {
    const budget = limit(st, 'budget_per_conversation');
    const n = (st.counts.get(env.conversation) || 0) + 1;
    if (n > budget) {
      const reason = `held: ${n} model-starting messages in conversation ${env.conversation} since Jacob last typed, past limits.budget_per_conversation = ${budget}; delivered after his next prompt`;
      const id = hold(st, env, decision, reason, { limit: 'budget_per_conversation', value: budget });
      await notice(st, env.from.split('/').pop(), `${reason} (message ${env.id})`);
      return { decision: 'held', target: decision.target, ledger: id, reason };
    }
    st.counts.set(env.conversation, n);
    st.turns.model++;
  }
  return deliverTo(st, env, decision, false);
}

// The whole path for one incoming envelope.
async function routeOne(st, raw) {
  st.turns.validate++;
  const f = E.findings(raw);
  if (f.length) {
    const env = E.strip({ ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}), from: (raw && typeof raw.from === 'string' && /^[A-Za-z0-9_./-]+$/.test(raw.from)) ? raw.from : 'unknown', body: (raw && typeof raw.body === 'string' && raw.body) ? raw.body : '(no body)' });
    env.origin = 'model';
    const reason = `invalid envelope: ${f.join('; ')}`;
    const id = deadLetter(st, env, reason, null);
    await failureMessage(st, 'delivery', env, reason);
    await notice(st, env.from.split('/').pop(), `${reason} (dead-letter ${env.id})`);
    return { id: env.id, decision: 'dead-letter', reason, ledger: id };
  }
  const env = E.strip(raw);
  // identical: the same item already admitted (auto-relay §4 reason 1)
  const hash = E.itemHash(env);
  const seen = ledger.read(st.root).find((r) => r.route === '/route' && r.hash === hash && ['delivered', 'queued', 'held'].includes(r.decision));
  if (seen) {
    const reason = `identical to message ${seen.id} (${seen.decision} ${seen.ts}): dropped`;
    const id = row(st, env, { decision: 'dropped', reason });
    await notice(st, env.from.split('/').pop(), `${reason}`);
    return { id: env.id, decision: 'dropped', reason, ledger: id };
  }
  // hops
  const hops = limit(st, 'hops');
  env.hops = (env.hops || 0) + 1;
  if (env.hops > hops) {
    const reason = `hop limit: ${env.hops} > limits.hops = ${hops}`;
    env.origin = 'model';
    const id = deadLetter(st, env, reason, null);
    ledger.append(st.root, { route: '/route', by: 'server', id: env.id, kind: 'limit', limit: 'hops', value: hops, decision: 'dead-letter', reason });
    await failureMessage(st, 'delivery', env, reason);
    return { id: env.id, decision: 'dead-letter', reason, ledger: id };
  }
  // origin, stamped by the server from the sender's session (fixed point 4)
  const fromRole = env.from.split('/').pop();
  const session = env.session_id && st.sessions.get(env.session_id) ? st.sessions.get(env.session_id) : sessionForRole(st, fromRole);
  const records = session ? (st.prompts.get(session.session_id) || []) : [];
  const o = O.classify(records, env.transcript_path || null);
  env.origin = o.origin;
  env.origin_id = o.origin_id;
  env.refs = [];
  let pastedId = null;
  if (env.origin_id) {
    const stubChars = limit(st, 'stub_chars');
    const s = S.stub(st.registry, st.root, env.origin_id, stubChars, new Date().toISOString().slice(0, 10));
    env.refs.push({ id: s.id, store: s.store, line: s.line, status: s.status, text: s.text });
    if (s.record) {
      const n = S.pasted(env.body, s.record, stubChars);
      if (n > stubChars) pastedId = `${env.origin_id}:${n}`;
    }
  }
  delete env.transcript_path;
  st.turns.gate++;
  const decision = R.decide(st.registry, env);
  st.turns.route++;
  if (decision.routed_by) env.routed_by = decision.routed_by;
  if (decision.dead) {
    const id = deadLetter(st, env, `${decision.dead}: ${decision.reason}`, decision);
    await failureMessage(st, 'delivery', env, `${decision.dead}: ${decision.reason}`);
    await notice(st, fromRole, `${decision.dead}: ${decision.reason} (dead-letter ${env.id})`);
    return { id: env.id, decision: 'dead-letter', reason: decision.reason, ledger: id };
  }
  const result = await admit(st, env, decision, false);
  if (pastedId) {
    ledger.append(st.root, { route: '/route', by: 'server', id: env.id, kind: 'pasted', pasted: pastedId, reason: `the body carries more than limits.stub_chars of ${env.origin_id}'s text verbatim` });
    await notice(st, fromRole, `pasted: ${pastedId}: the body carries the record's text past limits.stub_chars; cite the id (message ${env.id} delivered anyway)`);
  }
  return { id: env.id, ...result, origin: env.origin, origin_id: env.origin_id, rule: decision.rule, target: result.target || decision.target, via: result.via || decision.via, routed_by: result.routed_by || env.routed_by || decision.routed_by || null, reason: result.reason || decision.reason };
}

// POST /route: one envelope, or {envelopes: [...]} in one connection.
async function route(st, body) {
  const list = Array.isArray(body.envelopes) ? body.envelopes : [body];
  const results = [];
  for (const raw of list) results.push(await routeOne(st, raw));
  return { results, registry_hash: st.hash };
}

// A prompt Jacob typed releases what the budget held, once, and resets the counts.
async function release(st) {
  st.counts.clear();
  const held = st.held.splice(0, st.held.length);
  const results = [];
  for (const h of held) {
    D.removeJson(st.root, D.HELD_DIR, h.id);
    const env = h.envelope;
    env.released = (env.released || 0) + 1;
    const r = await admit(st, env, h.decision || R.decide(st.registry, env), true);
    results.push({ id: env.id, ...r });
  }
  return results;
}

// POST /sessions: a window or role session's record (PLAN-hub.md §1, the session-recording hook).
function recordSession(st, body) {
  const f = [];
  if (typeof body.session_id !== 'string' || !body.session_id) f.push('session_id: missing');
  if (typeof body.agent_type !== 'string' || !body.agent_type) f.push('agent_type: missing');
  if (f.length) return { recorded: false, reason: f.join('; ') };
  const rec = {
    session_id: body.session_id, agent_type: body.agent_type, role: roleOf(st, body.agent_type),
    cwd: typeof body.cwd === 'string' ? body.cwd : null, permission_mode: typeof body.permission_mode === 'string' ? body.permission_mode : null,
    socket: typeof body.socket === 'string' && body.socket ? body.socket : null, ts: new Date().toISOString(),
  };
  st.sessions.set(rec.session_id, rec);
  D.writeJson(st.root, D.SESSIONS_DIR, rec.session_id, rec);
  ledger.append(st.root, { route: '/sessions', by: 'server', kind: 'session', session: rec.session_id, role: rec.role, agent_type: rec.agent_type, socket: rec.socket ? 'recorded' : null, permission_mode: rec.permission_mode, decision: 'recorded', reason: `session ${rec.session_id} is ${rec.role}` });
  return { recorded: true, role: rec.role, bypass: /bypass/i.test(rec.permission_mode || '') };
}

// POST /sessions/:id/prompts: the user-prompt hook's record of one prompt; the hub
// says whether it typed it (a relay it delivered) or Jacob did, and a prompt of his
// releases what the budget held.
async function recordPrompt(st, sessionId, body) {
  if (typeof body.hash !== 'string' || !body.hash) return { recorded: false, reason: 'hash: missing' };
  const delivered = st.delivered.get(sessionId);
  const typed = !(delivered && delivered.has(body.hash));
  const rec = { hash: body.hash, ctx_id: typeof body.ctx_id === 'string' && body.ctx_id ? body.ctx_id : null, typed, ts: new Date().toISOString() };
  if (!st.prompts.has(sessionId)) st.prompts.set(sessionId, []);
  st.prompts.get(sessionId).push(rec);
  ledger.append(st.root, { route: '/sessions/:id/prompts', by: 'server', kind: 'prompt', session: sessionId, hash: rec.hash, ctx_id: rec.ctx_id, typed, decision: typed ? 'jacob' : 'model', reason: typed ? 'a prompt the hub did not deliver: Jacob typed it' : 'a message the hub delivered to this session' });
  let released = [];
  if (typed) released = await release(st);
  return { recorded: true, origin: typed ? 'jacob' : 'model', ctx_id: rec.ctx_id, released: released.length, results: released };
}

// State restored at start: sessions from .hub/sessions/, prompts and delivered
// hashes from the ledger, counts from the ledger's rows since the last typed prompt.
function restore(st) {
  for (const s of D.listJson(st.root, D.SESSIONS_DIR)) if (s && s.session_id) st.sessions.set(s.session_id, s);
  for (const r of ledger.read(st.root)) {
    if (r.kind === 'prompt' && r.session) {
      if (!st.prompts.has(r.session)) st.prompts.set(r.session, []);
      st.prompts.get(r.session).push({ hash: r.hash, ctx_id: r.ctx_id || null, typed: r.typed !== false, ts: r.ts });
      if (r.typed !== false) st.counts.clear();
    }
    if (r.route === '/route' && r.decision === 'delivered' && r.session && r.envelope) {
      if (!st.delivered.has(r.session)) st.delivered.set(r.session, new Set());
      st.delivered.get(r.session).add(O.promptHash(deliveredText(r.envelope)));
      if (R.startsModelTurn(r.envelope, { via: r.via })) st.counts.set(r.conversation, (st.counts.get(r.conversation) || 0) + 1);
    }
  }
  st.queued = [];
  const qroot = path.join(st.root, reg.STATE_DIR, D.QUEUE_DIR);
  try {
    for (const name of fs.readdirSync(qroot)) for (const e of D.listJson(st.root, path.join(D.QUEUE_DIR, name))) st.queued.push({ id: e.id, target: name, via: name.startsWith('@') ? 'service' : 'role', ts: e.ts || null });
  } catch { /* no queue yet */ }
}

module.exports = { LIMITS_EXPORT, limit, route, routeOne, recordSession, recordPrompt, release, restore, deliveredText, sessionForRole, sessionsForRole, roleOf, askUsageGate };
