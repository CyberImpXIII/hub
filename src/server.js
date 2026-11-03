'use strict';
// The node's server (PLAN-hub.md §3: H1a-0's skeleton and write gate, H1a-0b's
// read route, H1a-2's relay): 127.0.0.1:<server.port>, every request carrying
// `Authorization: Bearer $HUB_TOKEN` or refused, the pidfile .hub/server.json, and
// the routes in ROUTES, which docs/API.md documents both ways (tests/hub/help.test.js
// diffs them). A `:name` segment in a route's path is a parameter.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const reg = require('./registry');
const gate = require('./gate');
const read = require('./read');
const relay = require('./relay');
const D = require('./deliver');
const V = require('./vocab');
const ledger = require('./ledger');

const MAX_BODY = 256 * 1024;
const PIDFILE = 'server.json';
const LEDGER_PAGE = 200;

function pidfilePath(root) { return path.join(root, reg.STATE_DIR, PIDFILE); }

function readPidfile(root) {
  try { return JSON.parse(fs.readFileSync(pidfilePath(root), 'utf8')); } catch { return null; }
}

function tokenOk(header, token) {
  const m = /^Bearer (.+)$/.exec(header || '');
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function storesState(stores) {
  if (stores.missing) return 'missing';
  return stores.error ? 'invalid' : 'present';
}

function statusBody(st) {
  const d = st.registry;
  return {
    name: d.node,
    up: true,
    port: st.port,
    pid: process.pid,
    queued: st.queued.length,
    held: st.held.length,
    dead_letter: st.deadLetter.length,
    children: (Array.isArray(d.children) ? d.children : []).map((c) => ({ name: c && c.name, registered: false })),
    stores_json: storesState(reg.loadStores(st.root)),
    sessions: st.sessions.size,
    usage_gate: d.services && d.services[V.USAGE_SERVICE] ? 'on' : 'off',
    turns: { ...st.turns },
    registry_hash: st.hash,
  };
}

function writeRequest(st, req) {
  const ctx = { root: st.root, registry: st.registry, stores: reg.loadStores(st.root) };
  const ans = gate.decide(ctx, req);
  const row = {
    route: '/write-request', by: 'server',
    role: req && typeof req.role === 'string' ? req.role : null,
    tool: req && typeof req.tool === 'string' ? req.tool : null,
    cli: req && typeof req.cli === 'string' ? req.cli : null,
    verb: ans.verb || null,
    targets: ans.targets || [],
    decision: ans.decision, reason: ans.reason,
  };
  const id = ledger.append(st.root, row);
  return { decision: ans.decision, reason: ans.reason, use: ans.use || null, ledger: id };
}

// The read route (PLAN-hub.md §3 H1a-0b): names the store and its `get`, never
// runs it; every answer is one ledger row, with the id or the path it was judged on.
function readRequest(st, req) {
  const ctx = { root: st.root, registry: st.registry, stores: reg.loadStores(st.root) };
  const ans = read.decide(ctx, req);
  const row = {
    route: '/read-request', by: 'server',
    role: req && typeof req.role === 'string' ? req.role : null,
    tool: req && typeof req.tool === 'string' ? req.tool : null,
    cli: null,
    verb: ans.get ? ans.get.verb : null,
    targets: ans.targets || [],
    id: ans.id, store: ans.store, kind: ans.kind,
    decision: ans.decision, reason: ans.reason,
  };
  const id = ledger.append(st.root, row);
  return { decision: ans.decision, kind: ans.kind, store: ans.store, get: ans.get, reason: ans.reason, ledger: id };
}

// The limits the server enforces, each with its value (§8 "limits both ways").
function limitsExport(st) {
  const limits = st.registry.limits || {};
  return { limits: relay.LIMITS_EXPORT.map((l) => ({ ...l, value: Number.isInteger(limits[l.name]) ? limits[l.name] : null })) };
}

function ledgerPage(st, q) {
  let rows = ledger.read(st.root);
  if (q.since) rows = rows.filter((r) => r.ts >= q.since);
  if (q.kind) rows = rows.filter((r) => r.kind === q.kind || r.route === q.kind || r.decision === q.kind);
  const limit = Number.isInteger(Number(q.limit)) && Number(q.limit) > 0 ? Number(q.limit) : LEDGER_PAGE;
  return { total: rows.length, rows: rows.slice(-limit) };
}

// The route table, exported for the help-equals-implemented gate. A handler may
// be async; a GET handler gets the query, a POST handler the body; both get params.
const ROUTES = [
  { method: 'GET', path: '/health', handle: (st) => ({ ok: true, name: st.registry.node, pid: process.pid }) },
  { method: 'GET', path: '/status', handle: (st) => statusBody(st) },
  { method: 'GET', path: '/routes', handle: (st) => ({ node: st.registry.node, routes: reg.routeTable(st.registry) }) },
  { method: 'GET', path: '/limits', handle: (st) => limitsExport(st) },
  { method: 'GET', path: '/ledger', handle: (st, q) => ledgerPage(st, q) },
  { method: 'GET', path: '/held', handle: (st) => ({ held: st.held }) },
  { method: 'GET', path: '/dead-letter', handle: (st) => ({ dead_letter: st.deadLetter }) },
  { method: 'GET', path: '/sessions', handle: (st) => ({ sessions: [...st.sessions.values()] }) },
  { method: 'POST', path: '/sessions', handle: (st, body) => relay.recordSession(st, body) },
  { method: 'POST', path: '/sessions/:id/prompts', handle: (st, body, params) => relay.recordPrompt(st, params.id, body) },
  { method: 'POST', path: '/route', handle: (st, body) => relay.route(st, body) },
  { method: 'POST', path: '/write-request', handle: (st, body) => writeRequest(st, body) },
  { method: 'POST', path: '/read-request', handle: (st, body) => readRequest(st, body) },
];

function matchRoute(url) {
  const segs = url.split('/');
  for (const r of ROUTES) {
    const want = r.path.split('/');
    if (want.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < want.length; i++) {
      if (want[i].startsWith(':')) { if (!segs[i]) { ok = false; break; } params[want[i].slice(1)] = decodeURIComponent(segs[i]); } else if (want[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

function send(res, code, obj) {
  const data = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': data.length });
  res.end(data);
}

function handler(st) {
  return (req, res) => {
    if (!tokenOk(req.headers.authorization, st.token)) return send(res, 401, { error: 'token refused' });
    const [url, queryText] = (req.url || '').split('?');
    const query = Object.fromEntries(new URLSearchParams(queryText || ''));
    const matches = ROUTES.filter((r) => matchRoute(url) && matchRoute(url).route.path === r.path);
    const m = matchRoute(url);
    if (!m) return send(res, 404, { error: `no route ${url}` });
    const route = matches.find((r) => r.method === req.method);
    if (!route) return send(res, 405, { error: `${url} takes ${matches.map((r) => r.method).join(' or ')}` });
    const answer = (fn) => Promise.resolve().then(fn).then((body) => send(res, 200, body), (e) => {
      ledger.append(st.root, { route: url, by: 'server', kind: 'error', decision: 'error', reason: `${e && e.message ? e.message : e}` });
      send(res, 500, { error: `${e && e.message ? e.message : e}` });
    });
    if (req.method === 'GET') return answer(() => route.handle(st, query, m.params));
    const chunks = [];
    let size = 0;
    let over = false;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) over = true; else chunks.push(c); });
    req.on('end', () => {
      let body = null;
      if (!over) { try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = null; } }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        const why = over ? `request over ${MAX_BODY} bytes` : 'unparseable request';
        const id = ledger.append(st.root, { route: url, by: 'server', role: null, tool: null, cli: null, verb: null, targets: [], decision: 'deny', reason: why });
        return send(res, 400, { decision: 'deny', reason: why, use: null, ledger: id });
      }
      return answer(() => route.handle(st, body, m.params));
    });
    return undefined;
  };
}

// The state a server restores from .hub/ at start (PLAN-hub.md §3 step 3; §8 "kill
// the server": `hub up` after a kill restores held, dead-letter and ledger state):
// held messages are .hub/held/<id>.json, dead letters .hub/dead-letter/<id>.json,
// sessions .hub/sessions/<id>.json, queues .hub/queue/<target>/<id>.json, and the
// ledger is the append-only .hub/ledger.jsonl, which nothing truncates.
const HELD_DIR = D.HELD_DIR;
const DEAD_DIR = D.DEAD_DIR;

function loadState(root) {
  return { held: D.listJson(root, HELD_DIR), deadLetter: D.listJson(root, DEAD_DIR), ledgerRows: ledger.read(root).length };
}

// Runs in the foreground until SIGTERM or SIGINT. Resolves when listening;
// rejects with the listen error (a port in use, say).
function start(root, registry, token) {
  const restored = loadState(root);
  const st = {
    root, registry: registry.data, hash: registry.hash, token, port: registry.data.server.port,
    queued: [], held: restored.held, deadLetter: restored.deadLetter,
    sessions: new Map(), prompts: new Map(), delivered: new Map(), counts: new Map(),
    turns: { validate: 0, gate: 0, route: 0, model: 0 },
  };
  relay.restore(st);
  const server = http.createServer(handler(st));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(st.port, '127.0.0.1', () => {
      fs.mkdirSync(path.join(root, reg.STATE_DIR), { recursive: true });
      const info = { name: st.registry.node, pid: process.pid, port: st.port, started: new Date().toISOString(), registry_hash: st.hash };
      fs.writeFileSync(pidfilePath(root), `${JSON.stringify(info)}\n`);
      const stop = () => {
        const cur = readPidfile(root);
        if (cur && cur.pid === process.pid) { try { fs.unlinkSync(pidfilePath(root)); } catch { /* already gone */ } }
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 1000).unref();
      };
      process.once('SIGTERM', stop);
      process.once('SIGINT', stop);
      resolve(info);
    });
  });
}

module.exports = { start, ROUTES, matchRoute, readPidfile, pidfilePath, loadState, HELD_DIR, DEAD_DIR };
