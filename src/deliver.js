'use strict';
// Delivery (PLAN-hub.md §3): a window role gets one message line on the inbox socket
// its session recorded (the shape PLAN-auto-relay.md §3's probe established); a
// process role's message is queued under .hub/queue/<role>/ until H1b's spawner
// takes it; a service's under .hub/queue/@<service>/ until the service exists; a
// child's under .hub/queue/<child>/ until H3 forwards it. A held message rests in
// .hub/held/, a dead letter in .hub/dead-letter/. Every write here is one file per
// message, so `hub up` restores the state by reading the directories.

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { STATE_DIR } = require('./registry');

const QUEUE_DIR = 'queue';
const HELD_DIR = 'held';
const DEAD_DIR = 'dead-letter';
const SESSIONS_DIR = 'sessions';

function writeJson(root, sub, id, obj) {
  const dir = path.join(root, STATE_DIR, sub);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(obj)}\n`);
  return file;
}

function removeJson(root, sub, id) {
  try { fs.unlinkSync(path.join(root, STATE_DIR, sub, `${id}.json`)); return true; } catch { return false; }
}

function listJson(root, sub) {
  const dir = path.join(root, STATE_DIR, sub);
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort(); } catch { return []; }
  return names.map((n) => { try { return JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); } catch { return { id: n.replace(/\.json$/, ''), unreadable: true }; } });
}

// The one message line a window's inbox takes.
function messageLine(text) { return `${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`; }

// Write one line to a Unix socket; resolves {ok: true} or {ok: false, why}.
function toSocket(socketPath, text, timeoutMs) {
  return new Promise((resolve) => {
    if (!socketPath) { resolve({ ok: false, why: 'no socket recorded' }); return; }
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const sock = net.createConnection(socketPath);
    sock.setTimeout(timeoutMs || 2000, () => { sock.destroy(); finish({ ok: false, why: `no answer from ${socketPath} within ${timeoutMs || 2000} ms` }); });
    sock.on('connect', () => { sock.end(messageLine(text), () => finish({ ok: true })); });
    sock.on('error', (e) => finish({ ok: false, why: `${socketPath}: ${e.code || e.message}` }));
    sock.on('close', () => finish({ ok: true }));
  });
}

module.exports = { QUEUE_DIR, HELD_DIR, DEAD_DIR, SESSIONS_DIR, writeJson, removeJson, listJson, messageLine, toSocket };
