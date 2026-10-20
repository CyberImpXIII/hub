'use strict';
// The ledger: one JSON row per answer, appended to <root>/.hub/ledger.jsonl.
// The server writes a row for every answer it gives; the hook writes one for each
// deny it gives itself (server down, no token, an unparseable call), so every
// answer to a write is one row whoever gave it. A row never holds a command's
// arguments, only the paths it was judged on, so a value typed on a command line
// is never copied here.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { STATE_DIR } = require('./registry');

const FILE = 'ledger.jsonl';

function ledgerPath(root) { return path.join(root, STATE_DIR, FILE); }

function append(root, row) {
  const full = { id: crypto.randomUUID(), ts: new Date().toISOString(), ...row };
  fs.mkdirSync(path.join(root, STATE_DIR), { recursive: true });
  fs.appendFileSync(ledgerPath(root), `${JSON.stringify(full)}\n`);
  return full.id;
}

function read(root) {
  let text;
  try { text = fs.readFileSync(ledgerPath(root), 'utf8'); } catch { return []; }
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

module.exports = { append, read, ledgerPath };
