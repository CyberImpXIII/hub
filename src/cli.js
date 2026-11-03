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

const HOOKS = { gate: cmdHookGate };

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
  hook: { run: cmdHook, line: 'hook gate [--role <role>]  the PreToolUse write gate (hub hook gate --help)', help: 'hub hook <name>\n\nhooks:\n  gate   the PreToolUse write gate; `hub hook gate --help` states what it classifies' },
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
