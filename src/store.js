'use strict';
// Store calls through the owner's declared CLI (PLAN-hub.md §12; fixed point 10: the
// server holds no tool's facts and reads them through that tool's CLI): `get <id>`
// prints one record, whose first line is the store's one readable line; `put`
// (the verb an `ids` entry declares for storing one record) reads the record on
// stdin and prints its id. The stub (§12) is rendered here from the `get` output
// and never from a sender; the paste gate compares a body against the record.

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const reg = require('./registry');

// Run a store's declared CLI verb; {ok, stdout, stderr, code} or {error}.
function run(root, get, args, input) {
  if (!get || !get.cli) return { error: 'no CLI declared' };
  const cli = path.join(root, get.cli);
  const r = spawnSync(cli, [get.verb, ...args], { cwd: path.dirname(cli), input: input === undefined ? '' : input, encoding: 'utf8', timeout: 10000 });
  if (r.error) return { error: `${get.cli}: ${r.error.code || r.error.message}` };
  return { ok: r.status === 0, code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// `get <id>` through the store the id's prefix declares: {text, line} or {error, status}.
function getRecord(d, root, id) {
  const s = reg.storeIdOf(d, root, id);
  if (!s) return { error: `${id}: no declared prefix claims it`, status: 'unresolved' };
  if (!s.get) return { error: `${id}: ${s.store} declares no get verb`, status: 'unchecked' };
  const r = run(root, s.get, [id]);
  if (r.error) return { error: `${id}: ${r.error}`, status: 'unchecked', store: s.store };
  if (!r.ok) return { error: `${id}: ${s.store}'s get exited ${r.code}${r.stderr ? `: ${r.stderr.trim().split('\n')[0]}` : ''}`, status: r.stdout.trim() === '' ? 'not found' : 'unchecked', store: s.store };
  const text = r.stdout.replace(/\n$/, '');
  return { text, line: text.split('\n')[0], store: s.store };
}

// The prefix's `put` verb, when an `ids` entry declares one: {cli, verb} or null.
function putVerb(d, root, prefix) {
  const key = reg.storesMap(d)[prefix];
  if (!key) return null;
  const row = reg.repoRows(d).find((r) => r.key === key);
  if (!row) return null;
  const decl = reg.loadIds(root, row).ids.find((x) => x.prefix === prefix);
  const verb = decl && decl.put ? decl.put : null;
  return verb ? { cli: path.posix.join(row.dir, row.cli), verb, store: key } : null;
}

// Store one record through `put`; {id} (the id the store printed) or {error}.
function putRecord(d, root, prefix, text) {
  const p = putVerb(d, root, prefix);
  if (!p) return { error: `no store declares a put verb for the ${prefix}: prefix` };
  const r = run(root, p, [], text);
  if (r.error) return { error: r.error };
  if (!r.ok) return { error: `${p.cli} ${p.verb} exited ${r.code}${r.stderr ? `: ${r.stderr.trim().split('\n')[0]}` : ''}` };
  const id = r.stdout.trim().split('\n')[0];
  if (!reg.storeIdOf(d, root, id)) return { error: `${p.cli} ${p.verb} printed ${JSON.stringify(id)}, not a ${prefix}: id` };
  return { id, store: p.store };
}

// The stub a reference renders to (§12): the id, the store's one line cut at
// stub_chars, its source and the status; never the record's text.
function stub(d, root, id, stubChars, date) {
  const r = getRecord(d, root, id);
  if (r.error) return { id, line: null, store: r.store || null, status: r.status, text: `${id}  ${r.status}: ${r.error}` };
  const line = r.line.length > stubChars ? `${r.line.slice(0, stubChars)}…` : r.line;
  return { id, line, store: r.store, status: 'ok', text: `${id}  ${JSON.stringify(line)}  (${r.store}${date ? `, ${date}` : ''})`, record: r.text };
}

// The paste gate (§12): more than stub_chars of a record's text verbatim in a body.
function pasted(body, recordText, stubChars) {
  if (!recordText || !body) return 0;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const b = norm(body);
  const rec = norm(recordText);
  if (rec.length <= stubChars) return b.includes(rec) ? rec.length : 0;
  // the longest run of the record found verbatim in the body, by sliding a window of stub_chars + 1
  let longest = 0;
  for (let i = 0; i + stubChars < rec.length; i += Math.max(1, Math.floor(stubChars / 4))) {
    const piece = rec.slice(i, i + stubChars + 1);
    if (b.includes(piece)) {
      let end = i + stubChars + 1;
      while (end < rec.length && b.includes(rec.slice(i, end + 1))) end++;
      longest = Math.max(longest, end - i);
    }
  }
  return longest;
}

module.exports = { run, getRecord, putVerb, putRecord, stub, pasted };
