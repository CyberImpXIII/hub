'use strict';
// §8 "kill the server", the H1a-1 half: `hub up` after a kill restores held,
// dead-letter and ledger state from .hub/; and §7's restart count: a start over a
// stale pidfile is one ledger row of kind `restart`, which `hub status --restarts`
// counts, and a clean start or stop adds none.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('./fixture');
const ledger = require('../../src/ledger');
const { HELD_DIR, DEAD_DIR } = require('../../src/server');

async function waitGone(pid) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { try { process.kill(pid, 0); } catch { return; } await new Promise((r) => setTimeout(r, 20)); }
}

test('hub up restores held, dead-letter and ledger state from .hub/, after a kill too; restarts are counted', async () => {
  const node = await F.makeNode();
  try {
    // state planted before the first start, as a crash would leave it
    F.write(node.root, path.join('.hub', HELD_DIR, 'h1.json'), { id: 'h1', body: 'held' });
    F.write(node.root, path.join('.hub', DEAD_DIR, 'd1.json'), { id: 'd1', reason: 'no route' });
    F.write(node.root, path.join('.hub', DEAD_DIR, 'd2.json'), { id: 'd2', reason: 'hop limit' });
    ledger.append(node.root, { route: 'fixture', by: 'test', decision: null, reason: 'a row from before the start' });
    const rowsBefore = F.ledgerRows(node).length;

    assert.equal(F.hub(node, ['status', '--restarts']).stdout.trim(), '0 restart(s) counted by hub up');
    const up1 = F.hub(node, ['up']);
    assert.equal(up1.code, 0, up1.stderr);
    assert.match(up1.stdout, /0 queued, 1 held, 2 dead-letter/);
    const s1 = JSON.parse(F.hub(node, ['status', '--json']).stdout);
    assert.deepEqual({ held: s1.held, dead_letter: s1.dead_letter }, { held: 1, dead_letter: 2 });
    assert.equal(F.ledgerRows(node).length, rowsBefore, 'a clean first start writes no restart row and truncates nothing');
    assert.equal(F.ledgerRows(node)[0].reason, 'a row from before the start');

    // a store read makes a server row, then the server is killed
    assert.equal(F.gate(node, 'planner', 'Read', { file_path: path.join(node.root, 'todo.json') }).decision, 'pass');
    const pid1 = F.pidfile(node).pid;
    process.kill(pid1, 'SIGKILL');
    await waitGone(pid1);
    assert.ok(F.pidfile(node), 'the killed server left its pidfile');
    const rowsKilled = F.ledgerRows(node).length;

    const up2 = F.hub(node, ['up']);
    assert.equal(up2.code, 0, up2.stderr);
    assert.match(up2.stdout, /0 queued, 1 held, 2 dead-letter/, 'the state survives the kill and the restart');
    const rows = F.ledgerRows(node);
    assert.equal(rows.length, rowsKilled + 1, 'one restart row');
    const restart = rows.at(-1);
    assert.equal(restart.kind, 'restart');
    assert.equal(restart.by, 'cli');
    assert.equal(restart.stale_pid, pid1);
    assert.ok(restart.stale_started, 'the stale pidfile\'s start time is kept');
    assert.equal(rows.filter((r) => r.route === '/read-request').length, 1, 'the ledger rows from before the kill are still there');
    assert.notEqual(F.pidfile(node).pid, pid1);

    const r = F.hub(node, ['status', '--restarts']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, new RegExp(`^1 restart\\(s\\) counted by hub up; last .*: a stale \\.hub/server\\.json named pid ${pid1} started `));
    assert.deepEqual(JSON.parse(F.hub(node, ['status', '--restarts', '--json']).stdout).restarts, 1);

    // a clean stop and start: no restart row
    assert.equal(F.hub(node, ['down']).code, 0);
    assert.equal(F.hub(node, ['up']).code, 0);
    assert.equal(F.ledgerRows(node).filter((x) => x.kind === 'restart').length, 1, 'a clean restart is not a restart row');
    assert.match(F.hub(node, ['status', '--restarts']).stdout, /^1 restart\(s\)/);
  } finally { F.down(node); F.cleanup(node); }
});

test('an unreadable held or dead-letter file is counted, named unreadable, never dropped', async () => {
  const node = await F.makeNode();
  try {
    F.write(node.root, path.join('.hub', DEAD_DIR, 'bad.json'), '{not json');
    const { loadState } = require('../../src/server');
    const st = loadState(node.root);
    assert.deepEqual(st.deadLetter, [{ id: 'bad', unreadable: true }]);
    assert.deepEqual(st.held, []);
    assert.equal(st.ledgerRows, 0);
    assert.equal(fs.existsSync(path.join(node.root, '.hub', DEAD_DIR, 'bad.json')), true);
  } finally { F.cleanup(node); }
});
