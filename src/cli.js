'use strict';
// `hub`, the one program at every node (PLAN-hub.md §1). COMMANDS is the
// dispatcher's table: `hub --help` prints exactly these, and
// tests/hub/help.test.js holds the two equal both ways.

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const reg = require('./registry');
const server = require('./server');
const client = require('./client');
const ledger = require('./ledger');
const relay = require('./relay');
const section = require('./section');
const O = require('./origin');
const S = require('./store');
const D = require('./deliver');
const E = require('./envelope');
const R = require('./route');
const V = require('./vocab');
const { classify, HOOK_GATE_HELP } = require('./classify');

const STATUS_TIMEOUT_MS = 800;   // `hub status` says down within one second (§8 "kill the server")
const UP_DEADLINE_MS = 5000;     // `hub up` waits this long for /health, then names the log
const DOWN_DEADLINE_MS = 5000;   // `hub down` waits this long for the process to exit
const GATE_TIMEOUT_MS = 2000;    // the hook's one call per write request
const LOG = 'server.log';

const out = (s) => process.stdout.write(`${s}\n`);
const err = (s) => process.stderr.write(`${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --flag value and --flag pairs; the rest positional.
function parse(argv, flags, valued) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (valued.includes(a)) { o[a] = argv[i + 1]; i++; }
    else if (flags.includes(a)) o[a] = true;
    else o._.push(a);
  }
  return o;
}

function rootFrom(o, start) {
  if (o['--root']) return path.resolve(o['--root']);
  return reg.findRoot(start || process.cwd());
}

function token() { return process.env.HUB_TOKEN || ''; }

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// ------------------------------------------------------------------ check --
function checkLines(root) {
  if (!root) return { ok: false, lines: [`FAIL  no ${reg.REGISTRY} at or above ${process.cwd()}`] };
  const r = reg.loadRegistry(root);
  if (r.error) return { ok: false, lines: [`FAIL  ${r.error}`] };
  const stores = reg.loadStores(root);
  const f = [...reg.checkFindings(r.data, root), ...(reg.shapeFindings(r.data).length ? [] : reg.storesFindings(r.data, stores))];
  if (f.length) return { ok: false, lines: f.map((x) => `FAIL  ${x}`), registry: r };
  const roles = Object.keys(r.data.roles).length;
  const repos = reg.repoRows(r.data).length;
  const routes = reg.routeTable(r.data).length;
  const s = stores.missing ? `${reg.STORES} missing (every store write is denied until it exists)` : `${reg.STORES} ${stores.entries.length} entries`;
  return { ok: true, lines: [`ok    ${reg.REGISTRY}: ${r.data.node}, ${roles} roles, ${repos} repos, ${routes} routes; ${s}`], registry: r };
}

async function cmdCheck(argv) {
  const o = parse(argv, ['--help'], ['--root']);
  if (o['--help']) { out(COMMANDS.check.help); return 0; }
  const c = checkLines(rootFrom(o));
  c.lines.forEach((l) => out(l));
  return c.ok ? 0 : 1;
}

// ------------------------------------------------------------------- init --
// The starter registry (PLAN-hub.md §2 "Who writes it"; the Setup component): what
// `setup`'s hub component writes where no role list exists, by another name. Data
// from hub.starter.json; this fills the node's name, a free port and the parent.
function freePort() {
  return new Promise((resolve, reject) => {
    const s = require('node:net').createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function cmdInit(argv) {
  const o = parse(argv, ['--help'], ['--root', '--parent', '--port']);
  if (o['--help']) { out(COMMANDS.init.help); return 0; }
  const root = path.resolve(o['--root'] || process.cwd());
  const file = path.join(root, reg.REGISTRY);
  if (fs.existsSync(file)) { err(`hub init refused: ${reg.REGISTRY} exists at ${root} (hub check reads it; nothing is overwritten)`); return 1; }
  if (!fs.existsSync(root)) { err(`hub init refused: ${root} does not exist`); return 1; }
  const d = reg.loadStarter();
  d.node = path.basename(root);
  d.server.port = o['--port'] ? Number(o['--port']) : await freePort();
  d.parent = o['--parent'] || null;
  const f = reg.checkFindings(d, root);
  if (f.length) { f.forEach((x) => err(`hub init: the starter does not pass hub check: ${x}`)); return 1; }
  fs.writeFileSync(file, `${JSON.stringify(d, null, 2)}\n`);
  out(`hub init: wrote ${reg.REGISTRY} for ${d.node} (:${d.server.port}, parent: ${d.parent || 'none'}, ${Object.keys(d.roles).length} roles); hub check: ok`);
  return 0;
}

// ----------------------------------------------------------------- routes --
function routeLines(d) {
  return reg.routeTable(d).map((r) => `${r.tag}${r.kind ? `[${r.kind}]` : ''} -> ${r.target} (${r.via || 'UNRESOLVED'}${r.by === 'repos' ? ', declared by the repo' : ''})`);
}

async function cmdRoutes(argv) {
  const o = parse(argv, ['--help', '--json'], ['--root']);
  if (o['--help']) { out(COMMANDS.routes.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  const r = reg.loadRegistry(root);
  if (r.error) { err(`hub: ${r.error}`); return 1; }
  const table = reg.routeTable(r.data);
  if (o['--json']) { out(JSON.stringify({ node: r.data.node, routes: table })); return table.every((x) => x.via) ? 0 : 1; }
  if (!table.length) out(`${r.data.node}: no tag routes declared (an addressed envelope routes without one)`);
  routeLines(r.data).forEach((l) => out(l));
  const bad = table.filter((x) => !x.via).length;
  if (bad) out(`${bad} route(s) unresolved: hub check names each`);
  return bad ? 1 : 0;
}

// ----------------------------------------------------------------- status --
async function probe(root) {
  const r = reg.loadRegistry(root);
  if (r.error) return { error: r.error };
  const d = r.data;
  const port = d.server && d.server.port;
  const pidfile = server.readPidfile(root);
  const base = {
    name: d.node, up: false, port, pid: null, queued: null, held: null, dead_letter: null,
    children: (Array.isArray(d.children) ? d.children : []).map((c) => ({ name: c && c.name, registered: false })),
  };
  if (!Number.isInteger(port)) return { ...base, why: 'no server.port in hub.json' };
  const t = token();
  const h = await client.call(port, 'GET', '/health', { token: t, timeoutMs: STATUS_TIMEOUT_MS });
  if (h.down) return { ...base, why: `no answer on :${port} (${h.down})${pidfile ? `; stale ${reg.STATE_DIR}/server.json names pid ${pidfile.pid}` : ''}` };
  if (h.status === 401) return { ...base, up: true, auth: t ? 'refused' : 'missing', pid: pidfile ? pidfile.pid : null, why: `a server answers on :${port} but refused ${t ? 'HUB_TOKEN' : 'a request with no HUB_TOKEN'}` };
  if (h.status !== 200 || !h.body || h.body.name !== d.node) return { ...base, why: `:${port} answers, but not as ${d.node}` };
  const s = await client.call(port, 'GET', '/status', { token: t, timeoutMs: STATUS_TIMEOUT_MS });
  if (s.down || s.status !== 200 || !s.body) return { ...base, up: true, pid: h.body.pid, auth: 'ok', why: `/status did not answer (${s.down || s.status})` };
  return { ...s.body, auth: 'ok' };
}

// The restarts `hub up` counted (§7): each row kind `restart` in the ledger.
function restartRows(root) { return ledger.read(root).filter((r) => r.kind === 'restart'); }

async function cmdStatus(argv) {
  const o = parse(argv, ['--help', '--json', '--restarts'], ['--root']);
  if (o['--help']) { out(COMMANDS.status.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  if (o['--restarts']) {
    const rows = restartRows(root);
    if (o['--json']) { out(JSON.stringify({ restarts: rows.length, last: rows.at(-1) || null })); return 0; }
    const last = rows.at(-1);
    out(`${rows.length} restart(s) counted by hub up${last ? `; last ${last.ts}: a stale ${reg.STATE_DIR}/server.json named pid ${last.stale_pid} started ${last.stale_started}` : ''}`);
    return 0;
  }
  const p = await probe(root);
  if (p.error) { err(`hub: ${p.error}`); return 1; }
  if (o['--json']) {
    const { why, ...rest } = p;
    out(JSON.stringify(why ? { ...rest, note: why } : rest));
  } else if (p.up && p.auth === 'ok' && p.queued !== null) {
    out(`${p.name} up :${p.port}, pid ${p.pid}, ${p.queued} queued, ${p.held} held, ${p.dead_letter} dead-letter; ${reg.STORES} ${p.stores_json}`);
  } else {
    out(`${p.name} ${p.up ? 'up?' : 'down'} :${p.port}: ${p.why}${p.up ? '' : '; `hub up` starts it'}`);
  }
  return p.up && p.auth === 'ok' ? 0 : 1;
}

// --------------------------------------------------------------------- up --
async function cmdUp(argv) {
  const o = parse(argv, ['--help', '--foreground'], ['--root']);
  if (o['--help']) { out(COMMANDS.up.help); return 0; }
  const root = rootFrom(o);
  const c = checkLines(root);
  if (!c.ok) { err(`hub up refused: ${c.lines[0].replace(/^FAIL\s+/, '')}${c.lines.length > 1 ? ` (+${c.lines.length - 1} more: hub check)` : ''}`); return 1; }
  if (!token()) { err('hub up refused: HUB_TOKEN is not set (read from the environment only; the harness sets it when it registers the hook)'); return 1; }
  const d = c.registry.data;
  if (o['--foreground']) {
    try {
      const info = await server.start(root, c.registry, token());
      out(`${d.node} up :${info.port}, pid ${info.pid}, 0 queued, 0 held, 0 dead-letter, parent: ${d.parent || 'none'}`);
      return null; // keep running
    } catch (e) {
      err(`hub up refused: cannot listen on 127.0.0.1:${d.server.port} (${e.code || e.message})`);
      return 1;
    }
  }
  const before = await probe(root);
  if (before.up) { out(`${d.node} already up :${before.port}${before.pid ? `, pid ${before.pid}` : ''}`); return before.auth === 'ok' ? 0 : 1; }
  fs.mkdirSync(path.join(root, reg.STATE_DIR), { recursive: true });
  // a start over a stale pidfile is a restart: the server died since it wrote it
  // (§7: the count is the evidence for the bundled-application stage)
  const stale = server.readPidfile(root);
  if (stale) {
    ledger.append(root, { route: 'hub up', by: 'cli', kind: 'restart', stale_pid: stale.pid, stale_started: stale.started || null, decision: null, reason: `hub up found ${d.node} down behind a stale ${reg.STATE_DIR}/server.json` });
    try { fs.unlinkSync(server.pidfilePath(root)); } catch { /* gone */ }
  }
  const logFile = path.join(root, reg.STATE_DIR, LOG);
  const fd = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'bin', 'hub'), 'up', '--foreground', '--root', root], {
    detached: true, stdio: ['ignore', fd, fd], env: process.env,
  });
  child.unref();
  fs.closeSync(fd);
  const deadline = Date.now() + UP_DEADLINE_MS;
  while (Date.now() < deadline) {
    const p = await probe(root);
    if (p.up && p.auth === 'ok' && p.pid === child.pid) {
      out(`${p.name} up :${p.port}, pid ${p.pid}, ${p.queued} queued, ${p.held} held, ${p.dead_letter} dead-letter, parent: ${d.parent || 'none'}`);
      return 0;
    }
    if (!alive(child.pid)) break;
    await sleep(100);
  }
  const tail = (() => { try { return fs.readFileSync(logFile, 'utf8').trim().split('\n').slice(-1)[0]; } catch { return ''; } })();
  err(`hub up: the server did not answer /health within ${UP_DEADLINE_MS} ms${tail ? `: ${tail}` : ''} (${reg.STATE_DIR}/${LOG})`);
  return 1;
}

// ------------------------------------------------------------------- down --
async function cmdDown(argv) {
  const o = parse(argv, ['--help'], ['--root']);
  if (o['--help']) { out(COMMANDS.down.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  const info = server.readPidfile(root);
  const p = await probe(root);
  if (!info) { out(p.up ? `hub down: :${p.port} answers but ${reg.STATE_DIR}/server.json is missing; not stopped` : 'down already'); return p.up ? 1 : 0; }
  // Only a pid that answers /health as this node is signalled: a stale pidfile's
  // pid may since belong to another process.
  if (!p.up || p.pid !== info.pid) {
    try { fs.unlinkSync(server.pidfilePath(root)); } catch { /* gone */ }
    out(`down already; removed a stale ${reg.STATE_DIR}/server.json (pid ${info.pid} did not answer as this node)`);
    return 0;
  }
  try { process.kill(info.pid, 'SIGTERM'); } catch (e) { err(`hub down: cannot signal pid ${info.pid} (${e.code})`); return 1; }
  const deadline = Date.now() + DOWN_DEADLINE_MS;
  while (Date.now() < deadline && alive(info.pid)) await sleep(50);
  if (alive(info.pid)) { err(`hub down: pid ${info.pid} still running after ${DOWN_DEADLINE_MS} ms`); return 1; }
  out(`${p.name} down (pid ${info.pid} stopped)`);
  return 0;
}

// ------------------------------------------------------------------- hook --
function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

function hookDeny(reason) {
  out(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  return 0;
}

function hookLedger(root, row) {
  if (!root) return;
  try { ledger.append(root, { route: 'hook', by: 'hook', ...row }); } catch { /* the deny stands without its row */ }
}

async function cmdHookGate(argv) {
  const o = parse(argv, ['--help'], ['--role', '--root']);
  if (o['--help']) { out(HOOK_GATE_HELP); return 0; }
  const text = await readStdin();
  let input = null;
  try { input = JSON.parse(text); } catch { input = null; }
  const cwd = input && typeof input.cwd === 'string' ? input.cwd : null;
  const root = rootFrom(o, cwd || undefined);
  const r = root ? reg.loadRegistry(root) : { error: `no ${reg.REGISTRY} at or above ${cwd || process.cwd()}` };
  const registry = r.error ? null : r.data;
  // store-ness is read from disk here, so a store read is told from a plain one
  // with the server down (PLAN-hub.md §3 H1a-0b)
  const stores = root ? reg.loadStores(root) : null;
  const c = classify(input, root, registry, stores);
  const role = o['--role'] || (input && typeof input.agent_type === 'string' ? input.agent_type : null);
  const base = { role, tool: input && typeof input.tool_name === 'string' ? input.tool_name : null, cli: null, verb: null, targets: [] };
  if (c.kind === 'read') return 0;
  if (c.kind === 'bad') {
    const why = `hub hook gate: denied, the call cannot be parsed (${c.why})`;
    hookLedger(root, { ...base, decision: 'deny', reason: why });
    return hookDeny(why);
  }
  // a write or a store read: the server decides; without it, both fail closed
  const what = c.kind === 'write' ? 'write' : 'store read';
  const route = c.kind === 'write' ? '/write-request' : '/read-request';
  if (c.kind === 'store-read') {
    base.targets = c.requests.map((q) => q.path).filter(Boolean);
    base.id = c.requests.map((q) => q.id).find(Boolean) || null;
  }
  const selfDeny = (why) => { hookLedger(root, { ...base, decision: 'deny', reason: why }); return hookDeny(why); };
  if (!registry) return selfDeny(`hub hook gate: ${what} denied, ${r.error}; run \`hub status\``);
  if (!role) return selfDeny(`hub hook gate: ${what} denied, no role (--role, or the input's agent_type)`);
  if (!token()) return selfDeny(`hub hook gate: ${what} denied, HUB_TOKEN is not set; run \`hub status\``);
  const port = registry.server && registry.server.port;
  const reasons = [];
  for (const req of c.requests) {
    const a = await client.call(port, 'POST', route, { token: token(), body: { role, ...req }, timeoutMs: GATE_TIMEOUT_MS });
    if (a.down) return selfDeny(`hub hook gate: ${what} denied, the hub server is down (:${port}, ${a.down}); run \`hub status\`, then \`hub up\``);
    if (a.status === 401) return selfDeny(`hub hook gate: ${what} denied, the server refused HUB_TOKEN; run \`hub status\``);
    if (!a.body || (a.body.decision !== 'allow' && a.body.decision !== 'deny')) return selfDeny(`hub hook gate: ${what} denied, the server's answer was not a decision (HTTP ${a.status}); run \`hub status\``);
    if (a.body.decision === 'deny') reasons.push(a.body.reason);
  }
  if (reasons.length) return hookDeny(`hub: ${reasons.join(' | ')}`);
  return 0;
}

// --------------------------------------------------- the relay's verbs and hooks --
// PLAN-hub.md §1, §3 (H1a-2): send, log, grammar, origin, get, limits; the hooks
// planner-stop, dispatcher-stop, session-start and user-prompt. Every hook exits 0
// on any input and FAILS OPEN (the write gate above is the one exception): with the
// server down it does today's work directly and says so in one line.

function hookOut(obj) { out(JSON.stringify(obj)); return 0; }
function hookNotice(lines) { return lines.length ? hookOut({ systemMessage: `hub: ${lines.join(' | ')}` }) : 0; }

// {root, registry, r} for a hook, from --root or the input's cwd; registry null when
// none is readable (the hook then passes, with a notice where one is due).
function nodeFor(o, input) {
  const cwd = input && typeof input.cwd === 'string' ? input.cwd : null;
  const root = rootFrom(o, cwd || undefined);
  const r = root ? reg.loadRegistry(root) : { error: `no ${reg.REGISTRY} at or above ${cwd || process.cwd()}` };
  return { root, registry: r.error ? null : r.data, hash: r.hash || null, error: r.error || null };
}

function hookRole(o, input, registry) {
  const agentType = o['--role'] || (input && typeof input.agent_type === 'string' ? input.agent_type : null);
  if (!agentType) return null;
  return registry ? relay.roleOf({ registry }, agentType) : agentType;
}

async function post(registry, route, body, timeoutMs) {
  const port = registry.server && registry.server.port;
  return client.call(port, 'POST', route, { token: token(), body, timeoutMs: timeoutMs || GATE_TIMEOUT_MS });
}

// The session records a hook can read with the server down: .hub/sessions/*.json.
function sessionRecords(root) { return root ? D.listJson(root, D.SESSIONS_DIR).filter((s) => s && s.session_id) : []; }
function socketForRole(root, registry, role) {
  const recs = sessionRecords(root).filter((s) => s.role === role && s.socket).sort((a, b) => (a.ts < b.ts ? -1 : 1));
  return recs.length ? recs[recs.length - 1] : null;
}
// Prompt records for a session, from the ledger (the server's rows and the hook's own).
function promptRecords(root, sessionId) {
  return ledger.read(root).filter((r) => r.kind === 'prompt' && r.session === sessionId).map((r) => ({ hash: r.hash, ctx_id: r.ctx_id || null, typed: r.typed !== false, ts: r.ts }));
}

// ------------------------------------------------------------------- send --
async function cmdSend(argv) {
  const o = parse(argv, ['--help', '--json'], ['--root', '--to', '--tag', '--ref', '--from', '--conversation', '--estimate', '--checkpoint', '--approval', '--kind']);
  if (o['--help']) { out(COMMANDS.send.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  const r = reg.loadRegistry(root);
  if (r.error) { err(`hub: ${r.error}`); return 1; }
  const body = o._.join(' ').trim();
  if (!body) { err('hub send: a one-line body is needed'); return 2; }
  if (!o['--to'] && !o['--tag']) { err('hub send: --to PATH or --tag TAG is needed'); return 2; }
  const env = { from: o['--from'] || `${r.data.node}/cli`, to: o['--to'] || null, tag: o['--tag'] || undefined, ref: o['--ref'] || null, body, approval: o['--approval'] || null };
  if (o['--conversation']) env.conversation = o['--conversation'];
  if (o['--estimate']) env.estimate = Number(o['--estimate']);
  if (o['--checkpoint']) env.checkpoint = o['--checkpoint'];
  if (o['--kind']) env.kind_hint = o['--kind'];
  if (!token()) { err('hub send: HUB_TOKEN is not set'); return 1; }
  const a = await post(r.data, '/route', env, 10000);
  if (a.down) { err(`hub send: the hub server is down (:${r.data.server.port}, ${a.down}); run \`hub status\``); return 1; }
  if (a.status !== 200 || !a.body || !a.body.results) { err(`hub send: HTTP ${a.status}: ${JSON.stringify(a.body)}`); return 1; }
  const res = a.body.results[0];
  if (o['--json']) out(JSON.stringify(res));
  else out(`${res.id} ${res.decision}${res.target ? ` -> ${res.target} (${res.via}${res.routed_by ? `, routed by ${res.routed_by}` : ''})` : ''}${res.origin ? `, origin ${res.origin}` : ''}${res.reason && !['delivered', 'queued'].includes(res.decision) ? `: ${res.reason}` : ''}`);
  return ['delivered', 'queued'].includes(res.decision) ? 0 : 1;
}

// -------------------------------------------------------------------- log --
async function cmdLog(argv) {
  const o = parse(argv, ['--help', '--json', '--usage'], ['--root', '--since', '--kind', '--limit']);
  if (o['--help']) { out(COMMANDS.log.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  let rows = ledger.read(root);
  if (o['--since']) rows = rows.filter((x) => x.ts >= o['--since']);
  if (o['--kind']) rows = rows.filter((x) => x.kind === o['--kind'] || x.route === o['--kind'] || x.decision === o['--kind']);
  const limit = o['--limit'] ? Number(o['--limit']) : 50;
  rows = rows.slice(-limit);
  if (o['--usage']) {
    const r = reg.loadRegistry(root);
    const unit = r.data && r.data.services && r.data.services[V.USAGE_SERVICE] ? r.data.services[V.USAGE_SERVICE].unit_tokens : null;
    const spawns = rows.filter((x) => x.usage && Number.isInteger(x.usage.input_tokens));
    if (o['--json']) { out(JSON.stringify({ unit_tokens: unit, spawns: spawns.map((x) => ({ id: x.id, ts: x.ts, usage: x.usage })) })); return 0; }
    if (!spawns.length) { out(`no spawn rows carry usage yet (H1b records the result line's usage per spawn)${unit ? `; the unit is ${unit} tokens` : ''}`); return 0; }
    for (const x of spawns) { const t = (x.usage.input_tokens || 0) + (x.usage.output_tokens || 0); out(`${x.ts} ${x.id} ${t} tokens${unit ? ` (${(t / unit).toFixed(2)}u)` : ''}`); }
    return 0;
  }
  if (o['--json']) { out(JSON.stringify({ rows })); return 0; }
  if (!rows.length) { out('no ledger rows'); return 0; }
  for (const x of rows) out(`${x.ts} ${x.route || x.kind || '-'} ${x.decision || x.kind || '-'}${x.tag ? ` ${x.tag}` : ''}${x.from ? ` ${x.from}` : ''}${x.target ? ` -> ${x.target}` : ''}${x.origin ? ` origin ${x.origin}` : ''}${x.reason ? `: ${x.reason}` : ''}`);
  return 0;
}

// ---------------------------------------------------------------- grammar --
async function cmdGrammar(argv) {
  const o = parse(argv, ['--help'], []);
  if (o['--help']) { out(COMMANDS.grammar.help); return 0; }
  out(section.GRAMMAR);
  return 0;
}

// ----------------------------------------------------------------- origin --
async function cmdOrigin(argv) {
  const o = parse(argv, ['--help', '--json'], ['--root', '--session', '--transcript']);
  if (o['--help']) { out(COMMANDS.origin.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  if (!o['--session']) { err('hub origin: --session <id> is needed'); return 2; }
  const c = O.classify(promptRecords(root, o['--session']), o['--transcript'] || null);
  if (o['--json']) out(JSON.stringify(c)); else out(`${c.origin}${c.origin_id ? ` ${c.origin_id}` : ''}: ${c.why}`);
  return 0;
}

// -------------------------------------------------------------------- get --
async function cmdGet(argv) {
  const o = parse(argv, ['--help', '--stub'], ['--root']);
  if (o['--help']) { out(COMMANDS.get.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  const r = reg.loadRegistry(root);
  if (r.error) { err(`hub: ${r.error}`); return 1; }
  const id = o._[0];
  if (!id) { err('hub get: an id is needed (<prefix>:<id>)'); return 2; }
  if (o['--stub']) { const s = S.stub(r.data, root, id, relay.limit({ registry: r.data }, 'stub_chars'), null); out(s.text); return s.status === 'ok' ? 0 : 1; }
  const g = S.getRecord(r.data, root, id);
  if (g.error) { err(`hub get: ${g.error} (${g.status})`); return 1; }
  out(g.text);
  return 0;
}

// ----------------------------------------------------------------- limits --
async function cmdLimits(argv) {
  const o = parse(argv, ['--help', '--json'], ['--root']);
  if (o['--help']) { out(COMMANDS.limits.help); return 0; }
  const root = rootFrom(o);
  if (!root) { err(`hub: no ${reg.REGISTRY} at or above ${process.cwd()}`); return 1; }
  const r = reg.loadRegistry(root);
  if (r.error) { err(`hub: ${r.error}`); return 1; }
  const limits = r.data.limits || {};
  const rows = relay.LIMITS_EXPORT.map((l) => ({ ...l, value: Number.isInteger(limits[l.name]) ? limits[l.name] : null }));
  if (o['--json']) { out(JSON.stringify({ limits: rows })); return 0; }
  for (const l of rows) out(`${l.name} = ${l.value === null ? 'UNSET' : l.value}  (${l.enforced_in}: ${l.where})`);
  return 0;
}

// ---------------------------------------------------------- hook session-start --
async function cmdHookSessionStart(argv) {
  const o = parse(argv, ['--help'], ['--role', '--root']);
  if (o['--help']) { out(HOOK_HELP['session-start']); return 0; }
  let input = null;
  try { input = JSON.parse(await readStdin()); } catch { input = null; }
  if (!input || typeof input !== 'object' || typeof input.session_id !== 'string') return 0; // malformed: fail open, nothing to record
  const n = nodeFor(o, input);
  const agentType = o['--role'] || (typeof input.agent_type === 'string' ? input.agent_type : null);
  if (!agentType) return hookNotice(['session-start: no agent_type in the hook input and no --role; nothing recorded']);
  const rec = { session_id: input.session_id, agent_type: agentType, cwd: typeof input.cwd === 'string' ? input.cwd : null, permission_mode: typeof input.permission_mode === 'string' ? input.permission_mode : null, socket: process.env.CLAUDE_CODE_MESSAGING_SOCKET || null };
  if (n.registry && token()) {
    const a = await post(n.registry, '/sessions', rec);
    if (!a.down && a.status === 200 && a.body && a.body.recorded) return a.body.bypass ? hookNotice([`session ${input.session_id} recorded as ${a.body.role}; its permission mode bypasses prompts, so a relay to it is held unseen (auto-relay §3)`]) : 0;
  }
  // the server is down or unreachable: the same record, written where `hub up` restores it from
  if (!n.root) return hookNotice([`session-start: ${n.error}; nothing recorded`]);
  const local = { ...rec, role: n.registry ? relay.roleOf({ registry: n.registry }, agentType) : agentType, ts: new Date().toISOString() };
  D.writeJson(n.root, D.SESSIONS_DIR, local.session_id, local);
  hookLedger(n.root, { route: 'hook session-start', kind: 'session', session: local.session_id, role: local.role, decision: 'recorded-direct', reason: 'hub down; the session record was written to .hub/sessions/ for hub up to restore' });
  return hookNotice([`hub down; session ${local.session_id} recorded locally as ${local.role}`]);
}

// ----------------------------------------------------------- hook user-prompt --
async function cmdHookUserPrompt(argv) {
  const o = parse(argv, ['--help'], ['--role', '--root']);
  if (o['--help']) { out(HOOK_HELP['user-prompt']); return 0; }
  let input = null;
  try { input = JSON.parse(await readStdin()); } catch { input = null; }
  if (!input || typeof input !== 'object' || typeof input.session_id !== 'string' || typeof input.prompt !== 'string') return 0;
  const n = nodeFor(o, input);
  if (!n.root || !n.registry) return 0; // no node: nothing to store, nothing to say
  const hash = O.promptHash(input.prompt);
  let ctxId = null;
  const notices = [];
  if (n.registry.prompts) {
    const p = S.putRecord(n.registry, n.root, n.registry.prompts, input.prompt);
    if (p.error) notices.push(`the prompt was not stored: ${p.error}`); else ctxId = p.id;
  }
  if (token()) {
    const a = await post(n.registry, `/sessions/${encodeURIComponent(input.session_id)}/prompts`, { hash, ctx_id: ctxId });
    if (!a.down && a.status === 200 && a.body && a.body.recorded) {
      if (a.body.released) notices.push(`${a.body.released} held message(s) released after your prompt`);
      return hookNotice(notices);
    }
  }
  // the server is down: record the prompt where the server and `hub origin` read it back
  const delivered = ledger.read(n.root).some((r) => r.route === 'hook planner-stop' && r.decision === 'relayed-direct' && r.session === input.session_id && r.delivered_hash === hash);
  hookLedger(n.root, { route: 'hook user-prompt', kind: 'prompt', session: input.session_id, hash, ctx_id: ctxId, typed: !delivered, decision: delivered ? 'model' : 'jacob', reason: 'hub down; recorded by the hook' });
  notices.push(`hub down; prompt recorded locally${ctxId ? ` as ${ctxId}` : ''}`);
  return hookNotice(notices);
}

// Build the planner's relay envelopes from its final reply.
function plannerEnvelopes(registry, role, input) {
  const d = section.dispatchItems(input.last_assistant_message);
  const node = registry ? registry.node : 'node';
  return { found: d.found, envelopes: d.items.map((it) => ({ from: `${node}/${role}`, tag: it.tag, ref: it.ref, body: it.body, approval: it.approval, session_id: input.session_id, transcript_path: typeof input.transcript_path === 'string' ? input.transcript_path : null })) };
}

// The planner's own question gate: notices, never a block (question-routing §4).
function plannerNotices(text) {
  const notes = [];
  const dec = section.decisionsOffShape(text);
  for (const b of dec.bad) notes.push(`Decisions row off the shape: ${b}`);
  for (const q of section.questionsOutside(text, section.DECISIONS_HEADING)) notes.push(`a question outside ${section.DECISIONS_HEADING}: ${q.slice(0, 80)}`);
  return notes;
}

// Deliver envelopes straight to a window's recorded socket (the fallback path).
async function relayDirect(n, envelopes, targetRole, label) {
  const s = socketForRole(n.root, n.registry, targetRole);
  if (!s) return { sent: 0, why: `no ${targetRole} socket recorded in ${reg.STATE_DIR}/${D.SESSIONS_DIR}/` };
  let sent = 0;
  const seen = new Set(ledger.read(n.root).filter((r) => r.hash && ['delivered', 'queued', 'held', 'relayed-direct'].includes(r.decision)).map((r) => r.hash));
  for (const raw of envelopes) {
    const env = E.strip(raw);
    const hash = E.itemHash(env);
    if (seen.has(hash)) continue; // identical: dropped, as the server would
    const c = O.classify(promptRecords(n.root, env.session_id), env.transcript_path || null);
    env.origin = c.origin; env.origin_id = c.origin_id; env.refs = [];
    delete env.transcript_path;
    const text = relay.deliveredText(env);
    const r = await D.toSocket(s.socket, text, GATE_TIMEOUT_MS);
    if (!r.ok) return { sent, why: r.why };
    hookLedger(n.root, { route: `hook ${label}`, kind: 'relay', id: env.id, tag: env.tag, from: env.from, hash, origin: env.origin, session: s.session_id, delivered_hash: O.promptHash(text), decision: 'relayed-direct', reason: `hub down; delivered straight to ${targetRole}'s socket` });
    seen.add(hash);
    sent++;
  }
  return { sent, why: null };
}

// ----------------------------------------------------------- hook planner-stop --
async function cmdHookPlannerStop(argv) {
  const o = parse(argv, ['--help'], ['--role', '--root']);
  if (o['--help']) { out(HOOK_HELP['planner-stop']); return 0; }
  let input = null;
  try { input = JSON.parse(await readStdin()); } catch { input = null; }
  if (!input || typeof input !== 'object' || typeof input.last_assistant_message !== 'string') return 0;
  if (input.stop_hook_active) return 0; // our own block or a prior pass: no loop
  const n = nodeFor(o, input);
  const notes = plannerNotices(input.last_assistant_message);
  const role = hookRole(o, input, n.registry) || 'planner-session';
  const { found, envelopes } = plannerEnvelopes(n.registry, role, input);
  if (!found || !envelopes.length) return hookNotice(notes);
  if (n.registry && token()) {
    const a = await post(n.registry, '/route', { envelopes }, 10000);
    if (!a.down && a.status === 200 && a.body && a.body.results) {
      const bad = a.body.results.filter((r) => !['delivered', 'queued'].includes(r.decision));
      for (const r of bad) notes.push(`${r.decision}: ${r.reason}`);
      return hookNotice(notes);
    }
    if (!a.down) notes.push(`the server answered HTTP ${a.status} to /route`);
  }
  if (!n.root || !n.registry) return hookNotice([...notes, `${n.error || 'no registry'}: ${envelopes.length} item(s) not relayed`]);
  const disp = R.dispatcherOf(n.registry);
  const r = await relayDirect(n, envelopes, disp, 'planner-stop');
  if (r.why) notes.push(`hub down; ${r.sent} of ${envelopes.length} item(s) relayed direct, then: ${r.why}`);
  else notes.push(`hub down; relayed direct: ${r.sent} of ${envelopes.length} item(s) to ${disp} (duplicates dropped)`);
  return hookNotice(notes);
}

// -------------------------------------------------------- hook dispatcher-stop --
async function cmdHookDispatcherStop(argv) {
  const o = parse(argv, ['--help'], ['--role', '--root']);
  if (o['--help']) { out(HOOK_HELP['dispatcher-stop']); return 0; }
  let input = null;
  try { input = JSON.parse(await readStdin()); } catch { input = null; }
  if (!input || typeof input !== 'object' || typeof input.last_assistant_message !== 'string') return 0;
  const n = nodeFor(o, input);
  const text = input.last_assistant_message;
  const items = section.needsJacob(text);
  const outside = section.questionsOutside(text, section.NEEDS_HEADING);
  const blocks = [];
  const forwards = [];
  const labels = [];
  for (const it of items.items) {
    if (!it.ok) { blocks.push(`\`${it.raw.slice(0, 60)}\`: ${it.reason}; every question to Jacob goes in ${section.NEEDS_HEADING} as \`N. [type] question -- blocks: pointer\``); continue; }
    if (it.type === 'dispatch') continue; // passes to Jacob unchanged
    if (it.type === 'context') { blocks.push(`[context] ${it.question.slice(0, 60)}: dispatch a read-only question brief to the owner, or read the ledger or that repo's TODO.md; do not ask Jacob`); continue; }
    forwards.push(it); // plan, settings: the planner's
  }
  for (const q of outside) blocks.push(`a question outside ${section.NEEDS_HEADING}: \`${q.slice(0, 60)}\`: every question to Jacob goes there with a type, or you answer it yourself`);
  // forward the planner's questions (through /route, else the planner's socket)
  if (forwards.length) {
    const role = hookRole(o, input, n.registry) || 'dispatcher-session';
    const node = n.registry ? n.registry.node : 'node';
    const envelopes = forwards.map((it) => ({ from: `${node}/${role}`, tag: V.RELAY_TAGS.question, kind_hint: it.type, ref: it.pointer, body: `[${it.type}] ${it.question}`, session_id: input.session_id, transcript_path: typeof input.transcript_path === 'string' ? input.transcript_path : null }));
    let done = false;
    if (n.registry && token()) {
      const a = await post(n.registry, '/route', { envelopes }, 10000);
      if (!a.down && a.status === 200 && a.body && a.body.results) {
        done = true;
        for (const r of a.body.results) labels.push(`forwarded to the planner: ${r.decision}${r.target ? ` -> ${r.target}` : ''}${['delivered', 'queued'].includes(r.decision) ? '' : `: ${r.reason}`}`);
      }
    }
    if (!done && n.root && n.registry) {
      const target = Object.keys(n.registry.roles).find((k) => (n.registry.tags && n.registry.tags.question && n.registry.tags.question.plan) === k) || null;
      const r = target ? await relayDirect(n, envelopes, target, 'dispatcher-stop') : { sent: 0, why: 'no tags.question.plan route names the planner' };
      labels.push(r.why ? `hub down; ${r.sent} of ${envelopes.length} question(s) forwarded direct, then: ${r.why}` : `hub down; forwarded direct to ${target}: ${r.sent} question(s)`);
    } else if (!done) labels.push(`${n.error || 'no registry'}: ${forwards.length} question(s) not forwarded`);
  }
  if (!blocks.length) return hookNotice(labels);
  // bounded: one block per reply (limits.question_max_blocks); on a later pass everything passes, labelled
  let max = 1;
  try { if (n.registry) max = relay.limit({ registry: n.registry }, 'question_max_blocks'); } catch { max = 1; }
  const passes = input.stop_hook_active ? 1 : 0;
  if (passes >= max) return hookNotice([...labels, ...blocks.map((b) => `rule not met: ${b}`)]);
  return hookOut({ decision: 'block', reason: `hub: ${blocks.join(' | ')}${labels.length ? ` | ${labels.join(' | ')}` : ''}` });
}

const HOOK_HELP = {
  'session-start': `hub hook session-start [--role <role>] [--root <dir>]

A SessionStart hook (the body of harness's session-recording hook, PLAN-hub.md §1): reads
the hook input (session_id, agent_type, cwd, permission_mode) and the inbox socket from
CLAUDE_CODE_MESSAGING_SOCKET, and POSTs them to /sessions, so the server can deliver
to this window. With the server down it writes the same record to .hub/sessions/<id>.json,
which hub up restores, and says so in one systemMessage line. A bypass permission mode is
noticed: a relay to such a window is held unseen. Exits 0 on any input; malformed input
records nothing.`,
  'user-prompt': `hub hook user-prompt [--root <dir>]

A UserPromptSubmit hook for the two windows (PLAN-hub.md §1, Jacob's words as an id; §3 origin):
stores the typed prompt in the node's prompt store (hub.json "prompts": the prefix whose
owner declares a put verb in its ids) and records its hash and the returned id against
the session at /sessions/<id>/prompts. The server answers whether the hub itself had
delivered that text to the session (a relay: origin model) or not (Jacob typed it:
origin jacob); a prompt of his releases what the budget held. With the server down the
prompt is still stored and the record kept in the ledger by the hook, for the server and
\`hub origin\` to read. Never blocks, never injects; exits 0 on any input.`,
  'planner-stop': `hub hook planner-stop [--role <role>] [--root <dir>]

The planner's Stop hook (the body of the auto-relay, PLAN-hub.md §1, §3): reads
last_assistant_message, guards on stop_hook_active, parses the ## Dispatch section
(\`hub grammar\`) and POSTs one envelope per line to /route in one connection: parsed
lines as tag dispatch, rejected ones as dispatch-malformed with the reason and the
grammar (auto-relay §9). No section, nothing sent. The server stamps origin, dedupes,
admits, routes and delivers. Decisions rows off the shape and questions outside
## Decisions are noticed, never blocked (question-routing §4). With the server down the
hook relays direct to the dispatcher's recorded socket, stamps origin from the ledger,
drops duplicates, and says \`hub down; relayed direct\`. One systemMessage line on any
failure, nothing on success; exits 0 on any input.`,
  'dispatcher-stop': `hub hook dispatcher-stop [--role <role>] [--root <dir>]

The dispatcher's Stop hook (the body of the question gate, PLAN-hub.md §1; question-routing
§3): questions to Jacob only inside ## Needs Jacob, \`N. [type] question -- blocks: pointer\`.
[dispatch] passes to Jacob; [plan] and [settings] are forwarded to the planner as question
envelopes through /route (direct to its socket with the server down), never Jacob's yes;
[context], a line off the shape and a \`?\` line outside the section are blocked once with
the reason. Bounded by limits.question_max_blocks: on a later pass (stop_hook_active)
everything passes, each unresolved item labelled "rule not met". Exits 0 on any input.`,
};

const HOOKS = { gate: cmdHookGate, 'planner-stop': cmdHookPlannerStop, 'dispatcher-stop': cmdHookDispatcherStop, 'session-start': cmdHookSessionStart, 'user-prompt': cmdHookUserPrompt };

async function cmdHook(argv) {
  const [name, ...rest] = argv;
  if (!name || name === '--help' || name === '-h') { out(COMMANDS.hook.help); return name ? 0 : 2; }
  const h = HOOKS[name];
  if (!h) { err(`hub hook: no hook ${name}; hooks: ${Object.keys(HOOKS).join(', ')}`); return 2; }
  return h(rest);
}

// --------------------------------------------------------------- dispatch --
const COMMANDS = {
  up: { run: cmdUp, line: 'up [--foreground] [--root <dir>]  start this node\'s server (hub check first; HUB_TOKEN from the environment)', help: 'hub up [--foreground] [--root <dir>]\n\nRuns `hub check`, needs HUB_TOKEN, starts the server on 127.0.0.1:<server.port> in the\nbackground (or in the foreground with --foreground, for a supervisor), writes .hub/server.json\n(name, pid, port, started, registry_hash) and waits for /health. One line out; exit 0 when up.' },
  down: { run: cmdDown, line: 'down [--root <dir>]  stop it (only a pid that answers /health as this node)', help: 'hub down [--root <dir>]\n\nSIGTERM to the pid in .hub/server.json, only when that pid answers /health as this node;\na stale pidfile is removed, nothing signalled. Exit 0 when down.' },
  status: { run: cmdStatus, line: 'status [--json] [--restarts] [--root <dir>]  up or down, within one second; the restarts hub up counted', help: 'hub status [--json] [--restarts] [--root <dir>]\n\nAsks /health, then /status, each within 800 ms. --json prints one object:\n{name, up, port, pid, queued, held, dead_letter, children[], auth, stores_json?, note?};\na down node has pid, queued, held and dead_letter null. Exit 0 when up and the token is\naccepted, 1 otherwise. --restarts: how many times hub up found the node down behind a\nstale .hub/server.json (one ledger row each, kind restart), and the last one; exit 0.' },
  check: { run: cmdCheck, line: 'check [--root <dir>]  hub.json against hub.schema.json and the rules the shape cannot say', help: 'hub check [--root <dir>]\n\nhub.json against hub.schema.json (the shape, every enum a vocab.js list), then the rules\nthe shape cannot say: every workspace role is a roles key; no workspace path falls under a\nrepos row\'s directory; every name a role derives (workspace, or the repo whose directory\nis its dir) is a repos key or workspace; a process role declares its lifetime and no\nother mode does; every stores prefix names a repos key; every tag resolves to a role, a\nchild or a reserved target (@from @owner @dir @write @check) and every tag a repos row\ndeclares has a route; every seam kind has an owners row or the unowned default; every\nrole dir and repos directory exists, every repos cli is executable, rendered_from.source\nexists. stores.json, when present: its shape, and every declared_by a repos key. One\nFAIL line each; exit 1 on any.' },
  init: { run: cmdInit, line: 'init [--parent <name>] [--port <n>] [--root <dir>]  write the starter hub.json for a node without a role list', help: 'hub init [--parent <name>] [--port <n>] [--root <dir>]\n\nWrites hub.starter.json\'s registry into <root>/hub.json (the folder\'s name as the node, a\nfree port unless --port, --parent or null): the dispatcher window as the fallback, a kept\ncoder process, route and write on, owners with only the unowned default, the limits at\ntheir starting values, no tags, no children. Refuses when hub.json exists. The file it\nwrites passes hub check, or nothing is written. Where a role list exists, setup\'s hub\ncomponent writes hub.json from it instead (PLAN-hub.md §2, Decision 2).' },
  routes: { run: cmdRoutes, line: 'routes [--json] [--root <dir>]  the tag table here, each tag resolved', help: 'hub routes [--json] [--root <dir>]\n\nOne line per route: `tag[kind] -> target (role|child|reserved)`, from hub.json\'s tags (a\nnested entry routes by question kind) and from the tags each repos row declares (routed to\nthe role or child of the repo\'s name when no tags row names them). An unresolved target\nis printed UNRESOLVED and exit 1; hub check names it. --json: {node, routes: [{tag, kind,\ntarget, via, by}]}, the same object GET /routes serves. Proposed rules from the\ndispatcher\'s choices come with H2.' },
  send: { run: cmdSend, line: 'send [--to <path>|--tag <tag>] [--ref <ref>] [--from <path>] "<line>"  one envelope through /route', help: 'hub send [--to <path>] [--tag <tag>] [--ref <ref>] [--from <node>/<role>] [--conversation <id>]\n         [--approval <date>] [--kind <question kind>] [--estimate <tokens>] [--checkpoint <text>] [--json] "<one line>"\n\nPOSTs one envelope (routing-tree §2) to /route and prints its id, decision (delivered |\nqueued | held | dropped | dead-letter), target and the origin the server stamped. --from\ndefaults to <node>/cli; the server overwrites origin, kind and refs whatever is sent. Exit 0\nwhen delivered or queued, 1 otherwise or with the server down.' },
  log: { run: cmdLog, line: 'log [--since <ts>] [--kind <k>] [--usage] [--json] [--limit <n>]  the ledger, newest last', help: 'hub log [--since <ts>] [--kind <k>] [--usage] [--json] [--limit <n>] [--root <dir>]\n\nReads .hub/ledger.jsonl (no server needed): one line per row, the last 50 unless --limit.\n--kind matches a row\'s kind, route or decision (prompt, session, restart, /route, held,\ndead-letter, dropped, delivered, pasted, limit). --usage: the spawn rows\' usage in tokens\nand in units of services.usage.unit_tokens (rows arrive with H1b).' },
  grammar: { run: cmdGrammar, line: 'grammar  the Dispatch section\'s shape (PLAN-auto-relay.md §2)', help: 'hub grammar\n\nPrints the ## Dispatch grammar the planner-stop hook parses and every dispatch-malformed\nrelay quotes; planner-role prints it at session start; tests hold it to PLAN-auto-relay.md\n§2\'s example.' },
  origin: { run: cmdOrigin, line: 'origin --session <id> [--transcript <path>]  jacob or model for a session\'s last turn', help: 'hub origin --session <id> [--transcript <path>] [--json] [--root <dir>]\n\nThe stamp the server would give a message from that session: jacob when the turn\'s prompt\n(the transcript\'s last user line with string content, else the session\'s latest record) is\none the user-prompt hook recorded as typed, model otherwise (a relay the hub delivered, or\nno record). Prints origin, the ctx: id when there is one, and why. Reads the ledger; no\nserver needed.' },
  get: { run: cmdGet, line: 'get <id> [--stub]  a store\'s record by id, through its declared get', help: 'hub get <prefix>:<id> [--stub] [--root <dir>]\n\nResolves the prefix through hub.json stores to the owner\'s declared get verb (its ids) and\nprints the record exactly as the store prints it (PLAN-hub.md §12). --stub prints the stub\ninstead: the id, the store\'s first line cut at limits.stub_chars, the store. An undeclared\nprefix, a missing get or a store that answers nothing is exit 1, named: never a pass.' },
  limits: { run: cmdLimits, line: 'limits [--json]  every limit the server enforces, its value and where', help: 'hub limits [--json] [--root <dir>]\n\nThe limits export (PLAN-hub.md §8 "limits both ways"): each limits key with its hub.json\nvalue, where the server reads it and the phase that enforces it; tests diff the names\nagainst hub.json\'s limits and vocab.js both ways. GET /limits serves the same table.' },
  hook: { run: cmdHook, line: 'hook <name> [--role <role>]  the hooks (hub hook --help)', help: 'hub hook <name>\n\nhooks:\n  gate             the PreToolUse write gate and read route; `hub hook gate --help` states what it classifies\n  planner-stop     the planner\'s Stop hook: the Dispatch section through /route\n  dispatcher-stop  the dispatcher\'s Stop hook: the Needs Jacob gate, plan questions to the planner\n  session-start    a SessionStart hook: the session and its inbox socket to /sessions\n  user-prompt      a UserPromptSubmit hook: the typed prompt to the prompt store and /sessions/<id>/prompts\nEach answers --help. Every hook but gate fails open: exit 0 on any input, the work done directly with the server down.' },
};

function usage() {
  const lines = Object.entries(COMMANDS).map(([, c]) => `  ${c.line}`);
  return `hub <command>\n\ncommands:\n${lines.join('\n')}\n\nThe node is the nearest directory holding hub.json, or --root.`;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { out(usage()); return cmd ? 0 : 2; }
  const c = COMMANDS[cmd];
  if (!c) { err(`hub: unknown command ${cmd}`); out(usage()); return 2; }
  return c.run(rest);
}

module.exports = { main, COMMANDS, HOOKS, usage, probe, STATUS_TIMEOUT_MS };
