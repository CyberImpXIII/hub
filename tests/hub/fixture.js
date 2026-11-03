'use strict';
// A fixture node: a temp git repo made by the test (PLAN-hub.md §8: never a repo of
// ours), holding hub.json, stores.json, workspace stores at its top, and three
// fixture repos with cli.json files. Every name in it is a fixture's.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');

const TOOL = path.resolve(__dirname, '..', '..');
const BIN = path.join(TOOL, 'bin', 'hub');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function write(root, rel, content, mode) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof content === 'string' ? content : `${JSON.stringify(content, null, 1)}\n`);
  if (mode) fs.chmodSync(f, mode);
}

function registry(port) {
  return {
    hub: 1,
    node: 'fixture-node',
    server: { port, keep_alive: 'none' },
    roles: {
      planner: { mode: 'window', agent: 'planner' },
      dispatcher: { mode: 'window', agent: 'dispatcher', fallback: true },
      operator: { mode: 'process', lifetime: 'per-task', tools: ['Read', 'Grep', 'Glob'] },
      editor: { mode: 'process', lifetime: 'per-task', tools: ['Read', 'Edit', 'Write', 'Bash'] },
      site: { mode: 'process', lifetime: 'kept', dir: 'site' },
    },
    repos: {
      'tools/plans': { cli: 'plans-cli', verbs: ['plans edit', 'plans add'] },
      'tools/items': { cli: 'items', verbs: ['add', 'done', 'list'] },
      site: { cli: './store.sh', verbs: ['import'] },
      // the prompt store (PLAN-hub.md §12 ctx:): a fixture CLI with put and get
      'tools/ctx': { cli: 'ctx', verbs: [], ids: [{ prefix: 'ctx:', pattern: 'ctx:[0-9a-f]{8}', get: 'get', put: 'put' }] },
    },
    tags: {
      dispatch: 'dispatcher', 'dispatch-malformed': 'dispatcher',
      question: { dispatch: 'dispatcher', plan: 'planner', settings: 'planner' },
      report: '@from', task: '@dir', 'bug-report': '@owner', 'write-request': '@write', 'check-request': '@check',
    },
    services: { route: { on: true }, write: { on: true }, check: { on: false }, hook: { on: false }, usage: { cli: 'tools/usage/usage gate', unit_tokens: 29000 } },
    owners: { unowned: 'dispatcher', delivery: 'planner', workspace: { paths: ['PLAN-*.md', 'TODO.md', 'todo.json'], roles: ['planner', 'dispatcher'] } },
    children: [{ name: 'kid', path: 'kid' }],
    parent: null,
    limits: { hops: 8, budget_per_conversation: 10, pingpong_hold: 4, heartbeat_s: 30, heartbeat_misses: 2, stub_chars: 200, role_silence_s: 600, role_daily_budget: 50, question_max_blocks: 1 },
    // id prefix -> the repo whose `get` answers it (PLAN-hub.md §12); the pattern and
    // the get verb are the repo's own declaration (tools/items/services.json below)
    stores: { items: 'tools/items', ctx: 'tools/ctx' },
    prompts: 'ctx',
  };
}

// The fixture usage gate: answers from tools/usage/answer (`go`, `warn ...`, `hold until ...`),
// exit 0 only on go, and records the estimate it was asked in tools/usage/asked.
const USAGE_CLI = `#!/bin/sh
# usage gate <estimate>: a fixture (PLAN-usage-reporting.md §2's contract)
here=$(dirname "$0")
echo "$2" >> "$here/asked"
answer=$(cat "$here/answer" 2>/dev/null || echo go)
case "$answer" in
  go*) exit 0 ;;
  *) echo "$answer"; exit 1 ;;
esac
`;

// The fixture ctx: store: put reads stdin, keeps it under store/<id>.txt and prints the
// id; get prints the record's first line (its one readable line) then the whole text.
const CTX_CLI = `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const here = __dirname; const dir = path.join(here, 'store'); fs.mkdirSync(dir, { recursive: true });
const [verb, arg] = process.argv.slice(2);
if (verb === 'put') {
  const text = fs.readFileSync(0, 'utf8');
  const id = crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
  fs.writeFileSync(path.join(dir, id + '.txt'), text);
  process.stdout.write('ctx:' + id + '\\n');
} else if (verb === 'get') {
  const id = String(arg || '').replace(/^ctx:/, '');
  const f = path.join(dir, id + '.txt');
  if (!fs.existsSync(f)) { process.stderr.write('not found\\n'); process.exit(1); }
  const text = fs.readFileSync(f, 'utf8');
  process.stdout.write(text.split('\\n')[0].slice(0, 80) + '\\n' + text + (text.endsWith('\\n') ? '' : '\\n'));
} else { process.stderr.write('verbs: put, get\\n'); process.exit(2); }
`;

// The items repo's services.json: its `ids` declaration (PLAN-hub.md §12).
const ITEMS_SERVICES = {
  name: 'items',
  services: [{ service: 'check', run: 'dev.sh', verbs: ['check'] }],
  ids: [{ prefix: 'items:', pattern: 'items:it-\\d+', get: 'get' }],
};

const STORES = {
  stores: 1,
  entries: [
    { path: 'PLAN-*.md', declared_by: 'tools/plans' },
    { path: 'todo.json', declared_by: 'tools/items' },
    { path: 'TODO.md', declared_by: 'tools/items' },
    { path: 'tools/items/todo.json', declared_by: 'tools/items' },
    { path: 'site/data.db', declared_by: 'site' },
  ],
};

async function makeNode(opts = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-fixture-')));
  const port = await freePort();
  const reg = registry(port);
  if (opts.mutate) opts.mutate(reg);
  spawnSync('git', ['init', '-q', root]);
  write(root, 'hub.json', reg);
  if (opts.stores !== false) write(root, 'stores.json', opts.stores || STORES);
  write(root, 'PLAN-alpha.md', '# alpha\n');
  write(root, 'todo.json', '{}\n');
  write(root, 'TODO.md', '# todo\n');
  write(root, 'notes.md', 'not a store\n');
  write(root, 'tools/plans/cli.json', { store: ['PLAN-*.md'], cli: 'plans-cli', verbs: ['plans edit', 'plans add'] });
  write(root, 'tools/plans/plans-cli', '#!/bin/sh\nexit 0\n', 0o755);
  write(root, 'tools/items/cli.json', { store: ['todo.json'], cli: 'items', verbs: ['add', 'done', 'list'] });
  write(root, 'tools/items/services.json', opts.services === undefined ? ITEMS_SERVICES : opts.services);
  write(root, 'tools/items/items', '#!/bin/sh\nexit 0\n', 0o755);
  write(root, 'tools/items/todo.json', '{}\n');
  write(root, 'site/cli.json', { store: ['data.db'], cli: 'store.sh', verbs: ['import'] });
  write(root, 'site/store.sh', '#!/bin/sh\nexit 0\n', 0o755);
  write(root, 'site/data.db', '');
  write(root, 'site/src.txt', 'source\n');
  write(root, 'tools/usage/usage', USAGE_CLI, 0o755);
  write(root, 'tools/ctx/ctx', CTX_CLI, 0o755);
  const token = crypto.randomBytes(16).toString('hex');
  return { root, port, token, registry: reg };
}

// A window's inbox: a Unix socket server that keeps every line it receives.
function listenSocket(root, name) {
  const sockPath = path.join(root, '.hub', `${name}.sock`);
  fs.mkdirSync(path.dirname(sockPath), { recursive: true });
  const lines = [];
  const server = net.createServer((c) => {
    let buf = '';
    c.on('data', (d) => { buf += d.toString('utf8'); });
    c.on('end', () => { for (const l of buf.split('\n')) if (l.trim()) lines.push(JSON.parse(l)); });
  });
  return new Promise((resolve) => {
    server.listen(sockPath, () => resolve({
      path: sockPath,
      lines: () => lines,
      texts: () => lines.map((l) => l.message && l.message.content),
      close: () => new Promise((r) => server.close(() => r())),
    }));
  });
}

// The usage gate's answer for the fixture.
function usageAnswer(node, text) { write(node.root, 'tools/usage/answer', `${text}\n`); }
function usageAsked(node) { try { return fs.readFileSync(path.join(node.root, 'tools/usage/asked'), 'utf8').trim().split('\n').filter(Boolean); } catch { return []; } }

// A hook's input, as Claude Code sends it, and the hook's parsed output.
function hook(node, name, input, opts = {}) {
  const args = ['hook', name];
  if (opts.role) args.push('--role', opts.role);
  const r = hub(node, args, { input: typeof input === 'string' ? input : JSON.stringify({ session_id: 'fixture', cwd: node.root, hook_event_name: 'Stop', ...input }), extra: opts.extra });
  const text = r.stdout.trim();
  let j = null;
  if (text) { try { j = JSON.parse(text); } catch { j = { unparsed: text }; } }
  return { code: r.code, out: j, stderr: r.stderr, raw: r };
}

function env(node, extra = {}) {
  const e = { ...process.env, ...extra };
  if (node && node.token && !('HUB_TOKEN' in extra)) e.HUB_TOKEN = node.token;
  for (const [k, v] of Object.entries(e)) if (v === undefined) delete e[k];
  return e;
}

// Runs `hub <args>` to completion: {code, stdout, stderr, ms}.
function hub(node, args, { input, extra, cwd } = {}) {
  const t0 = Date.now();
  const p = spawnSync(process.execPath, [BIN, ...args], {
    cwd: cwd || node.root, env: env(node, extra), input: input === undefined ? '' : input, encoding: 'utf8', timeout: 20000,
  });
  return { code: p.status, stdout: p.stdout, stderr: p.stderr, ms: Date.now() - t0 };
}

// The PreToolUse input for a call, as Claude Code sends it.
function hookInput(node, tool, toolInput, extra = {}) {
  return JSON.stringify({ session_id: 'fixture', hook_event_name: 'PreToolUse', cwd: node.root, tool_name: tool, tool_input: toolInput, ...extra });
}

// `hub hook gate` on one call: {code, decision: 'pass'|'deny'|<other>, reason, raw}.
function gate(node, role, tool, toolInput, opts = {}) {
  const args = ['hook', 'gate'];
  if (role) args.push('--role', role);
  const r = hub(node, args, { input: opts.raw !== undefined ? opts.raw : hookInput(node, tool, toolInput, opts.input), extra: opts.extra });
  const text = r.stdout.trim();
  if (r.code === 0 && text === '') return { code: 0, decision: 'pass', reason: null, raw: r };
  let j = null;
  try { j = JSON.parse(text); } catch { j = null; }
  const h = j && j.hookSpecificOutput;
  return { code: r.code, decision: h ? h.permissionDecision : `unparsed: ${text}`, reason: h ? h.permissionDecisionReason : null, raw: r };
}

function ledgerRows(node) {
  try { return fs.readFileSync(path.join(node.root, '.hub', 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}

function pidfile(node) {
  try { return JSON.parse(fs.readFileSync(path.join(node.root, '.hub', 'server.json'), 'utf8')); } catch { return null; }
}

function up(node) {
  const r = hub(node, ['up']);
  if (r.code !== 0) throw new Error(`hub up failed: ${r.stdout}${r.stderr}`);
  return r;
}

function down(node) { return hub(node, ['down']); }

function cleanup(node) {
  const info = pidfile(node);
  if (info) { try { process.kill(info.pid, 'SIGKILL'); } catch { /* gone */ } }
  if (process.env.HUB_FIXTURE_LOG) { try { process.stderr.write(`--- ${node.root}/.hub/server.log\n${fs.readFileSync(path.join(node.root, '.hub', 'server.log'), 'utf8')}`); } catch { /* no log */ } }
  fs.rmSync(node.root, { recursive: true, force: true });
}

module.exports = { TOOL, BIN, makeNode, hub, gate, hook, hookInput, ledgerRows, pidfile, up, down, cleanup, write, freePort, spawn, listenSocket, usageAnswer, usageAsked, STORES };
