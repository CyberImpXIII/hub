'use strict';
// The node's server (PLAN-hub.md §3, H1a-0 skeleton): 127.0.0.1:<server.port>,
// every request carrying `Authorization: Bearer $HUB_TOKEN` or refused, the
// pidfile .hub/server.json, and the routes in ROUTES, which docs/API.md documents
// both ways (tests/hub/help.test.js diffs them).

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const reg = require('./registry');
const gate = require('./gate');
const ledger = require('./ledger');

const MAX_BODY = 64 * 1024;
const PIDFILE = 'server.json';

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

// The route table, exported for the help-equals-implemented gate.
const ROUTES = [
  { method: 'GET', path: '/health', handle: (st) => ({ ok: true, name: st.registry.node, pid: process.pid }) },
  { method: 'GET', path: '/status', handle: (st) => statusBody(st) },
  { method: 'POST', path: '/write-request', handle: (st, body) => writeRequest(st, body) },
];

function send(res, code, obj) {
  const data = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': data.length });
  res.end(data);
}

function handler(st) {
  return (req, res) => {
    if (!tokenOk(req.headers.authorization, st.token)) return send(res, 401, { error: 'token refused' });
    const url = (req.url || '').split('?')[0];
    const route = ROUTES.find((r) => r.path === url);
    if (!route) return send(res, 404, { error: `no route ${url}` });
    if (route.method !== req.method) return send(res, 405, { error: `${url} takes ${route.method}` });
    if (req.method === 'GET') return send(res, 200, route.handle(st));
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
      return send(res, 200, route.handle(st, body));
    });
    return undefined;
  };
}

// Runs in the foreground until SIGTERM or SIGINT. Resolves when listening;
// rejects with the listen error (a port in use, say).
function start(root, registry, token) {
  const st = { root, registry: registry.data, hash: registry.hash, token, port: registry.data.server.port, queued: [], held: [], deadLetter: [] };
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

module.exports = { start, ROUTES, readPidfile, pidfilePath };
