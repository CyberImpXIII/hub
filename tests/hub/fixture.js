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
      operator: { mode: 'cold', tools: ['Read', 'Grep', 'Glob'] },
      editor: { mode: 'cold', tools: ['Read', 'Edit', 'Write', 'Bash'] },
      site: { mode: 'cold', dir: 'site' },
    },
    repos: {
      'tools/plans': { cli: 'plans-cli', verbs: ['plans edit', 'plans add'] },
      'tools/items': { cli: 'items', verbs: ['add', 'done', 'list'] },
      site: { cli: './store.sh', verbs: ['import'] },
    },
    owners: { unowned: 'dispatcher', workspace: { paths: ['PLAN-*.md', 'TODO.md', 'todo.json'], roles: ['planner', 'dispatcher'] } },
    children: [{ name: 'kid', path: 'kid' }],
    parent: null,
  };
}

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
  write(root, 'tools/items/items', '#!/bin/sh\nexit 0\n', 0o755);
  write(root, 'tools/items/todo.json', '{}\n');
  write(root, 'site/cli.json', { store: ['data.db'], cli: 'store.sh', verbs: ['import'] });
  write(root, 'site/store.sh', '#!/bin/sh\nexit 0\n', 0o755);
  write(root, 'site/data.db', '');
  write(root, 'site/src.txt', 'source\n');
  const token = crypto.randomBytes(16).toString('hex');
  return { root, port, token, registry: reg };
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
  fs.rmSync(node.root, { recursive: true, force: true });
}

module.exports = { TOOL, BIN, makeNode, hub, gate, hookInput, ledgerRows, pidfile, up, down, cleanup, write, freePort, spawn };
