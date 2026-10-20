'use strict';
// The classifier: a read, a write or unparseable; its Bash write targets, and their
// parity with the shared parser (tools/hooks' lib/write-targets.sh) on the same
// commands. Two copies of one meaning, so the test compares them by meaning (the
// sorted set of targets), command by command.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { classify, bashWriteTargets } = require('../../src/classify');

const CWD = '/w/node';
const HOME = process.env.HOME;
const ORACLE = path.join(__dirname, 'write-targets-oracle.sh');
const LIB = path.resolve(__dirname, '..', '..', '..', 'hooks', 'source', 'lib', 'write-targets.sh');

// [command, expected targets] -- each also checked against the shared parser.
const CASES = [
  ['ls -la', []],
  ['cat a.txt | grep x > /dev/null 2>&1', []],
  ['echo hi > out.txt', ['/w/node/out.txt']],
  ['echo hi >> /abs/log', ['/abs/log']],
  ['echo hi 2> err.log', ['/w/node/err.log']],
  ['echo hi &> both.log', ['/w/node/both.log']],
  ['echo hi >| clobber', ['/w/node/clobber']],
  ['echo hi 2>&1', []],
  ['echo "a > b" > real', ['/w/node/real']],
  ["echo 'x >> y'", []],
  ['tee -a one two < in', ['/w/node/one', '/w/node/two']],
  ['rm -rf build dist', ['/w/node/build', '/w/node/dist']],
  ['mv a b', ['/w/node/a', '/w/node/b']],
  // as the shared parser does: the mode or owner is emitted too (harmless: a deny
  // names it), and a lone cp operand is taken as written
  ['chmod 644 f g', ['/w/node/644', '/w/node/f', '/w/node/g']],
  ['chown me:staff f', ['/w/node/me:staff', '/w/node/f']],
  ['chflags nouchg f', ['/w/node/f']],
  ['cp -r src dst', ['/w/node/dst']],
  ['cp only', ['/w/node/only']],
  ['ln -s target link', ['/w/node/link']],
  ['rsync -a x/ y/', ['/w/node/y']],
  ["sed -i '' s/a/b/ f.txt", ['/w/node/f.txt']],
  ['sed -i.bak -e s/a/b/ f.txt g.txt', ['/w/node/f.txt', '/w/node/g.txt']],
  ['sed s/a/b/ f.txt', []],
  ["perl -pi -e 's/a/b/' f.pl", ['/w/node/f.pl']],
  ['perl -Mstrict -e 1 f.pl', []],
  ['dd if=/dev/zero of=disk.img bs=1', ['/w/node/disk.img']],
  ['cd sub && echo x > y', ['/w/node/sub/y']],
  ['cd /abs && rm z', ['/abs/z']],
  ['cd "$TMP" && rm z', []],
  ['echo x > "$OUT/f"', []],
  ['echo x > $(pwd)/f', []],
  ['echo x > ~/f', [`${HOME}/f`]],
  ['sudo rm /etc/x', ['/etc/x']],
  ['env A=1 B=2 touch t', ['/w/node/t']],
  ['FOO=1 rm t', ['/w/node/t']],
  ['a; b && c || rm d | tee e', ['/w/node/d', '/w/node/e']],
  ['(cd sub; rm x)', ['/w/node/sub/x']],
  ['cat <<EOF > out\nrm notreal\nEOF', ['/w/node/out']],
  ['bash <<EOF\nrm real\nEOF', ['/w/node/real']],
  ["cat <<'EOF'\n> nope\nEOF", []],
  ['echo x # > not-a-target', []],
  ['git commit -m "x > y"', []],
  ['python3 tool.py --out f.json', []],
];

test('bashWriteTargets: each case', () => {
  for (const [cmd, want] of CASES) assert.deepEqual([...new Set(bashWriteTargets(cmd, CWD))].sort(), [...want].sort(), cmd);
});

// The known differences, each with what each side says. The shared parser sees
// more (git, tar, patch, editors); this list is the gap, held both ways: a new
// difference fails, and so does a listed one that has closed (drop it then).
// touch -- -odd: the shared parser drops every `-*` word even after `--`
// (reported to hooks, hb TODO); this one keeps it.
const KNOWN = {
  'touch -- -odd': { shared: [], hub: ['/w/node/-odd'] },
  'git checkout -- PLAN-a.md': { shared: ['/w/node/PLAN-a.md'], hub: [] },
  'git restore notes.md': { shared: ['/w/node/notes.md'], hub: [] },
  'patch notes.md fix.diff': { shared: ['/w/node/notes.md'], hub: [] },
  'vim notes.md': { shared: ['/w/node/notes.md'], hub: [] },
};

test('parity with the shared write-target parser, case by case', (t) => {
  if (!fs.existsSync(LIB)) { t.skip(`UNCHECKED: the shared parser is not at ${LIB}`); return; }
  const differ = [];
  for (const [cmd, k] of Object.entries(KNOWN)) {
    const r = spawnSync('bash', [ORACLE, LIB, CWD, cmd], { encoding: 'utf8', timeout: 10000 });
    const theirs = [...new Set(r.stdout.split('\n').filter(Boolean))].sort();
    const ours = [...new Set(bashWriteTargets(cmd, CWD))].sort();
    assert.deepEqual(ours, k.hub, `hub on known ${cmd}`);
    if (k.shared) assert.deepEqual(theirs, k.shared, `shared on known ${cmd}`);
    assert.notDeepEqual(theirs, ours, `known difference ${JSON.stringify(cmd)} has closed: drop it from KNOWN and add it to CASES`);
  }
  for (const [cmd] of CASES) {
    const r = spawnSync('bash', [ORACLE, LIB, CWD, cmd], { encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 0, `oracle on ${JSON.stringify(cmd)}: ${r.stderr}`);
    const theirs = [...new Set(r.stdout.split('\n').filter(Boolean))].sort();
    const ours = [...new Set(bashWriteTargets(cmd, CWD))].sort();
    if (JSON.stringify(theirs) !== JSON.stringify(ours)) differ.push(`${JSON.stringify(cmd)}: shared ${JSON.stringify(theirs)}, hub ${JSON.stringify(ours)}`);
  }
  assert.deepEqual(differ, [], `the two parsers disagree:\n${differ.join('\n')}`);
});

test('the parity check can fail: a planted difference is caught', () => {
  if (!fs.existsSync(LIB)) return;
  const r = spawnSync('bash', [ORACLE, LIB, CWD, 'echo x > a'], { encoding: 'utf8' });
  assert.notDeepEqual(r.stdout.split('\n').filter(Boolean), bashWriteTargets('echo x > b', CWD));
  const gone = spawnSync('bash', [ORACLE, '/nonexistent/write-targets.sh', CWD, 'ls'], { encoding: 'utf8' });
  assert.equal(gone.status, 3, 'a missing parser is exit 3, not an empty answer');
});

const reg = {
  roles: { planner: {} },
  repos: { 'tools/items': { cli: 'items', verbs: ['add'] }, site: { cli: './store.sh', verbs: ['import'] } },
};

test('classify: reads, writes, bad input', () => {
  assert.deepEqual(classify({ tool_name: 'Read', tool_input: { file_path: 'x' }, cwd: CWD }, CWD, reg), { kind: 'read' });
  assert.deepEqual(classify({ tool_name: 'mcp__x__y', tool_input: {}, cwd: CWD }, CWD, reg), { kind: 'read' });
  assert.deepEqual(classify({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: CWD }, CWD, reg), { kind: 'read' });

  const e = classify({ tool_name: 'Edit', tool_input: { file_path: 'a/b.md' }, cwd: CWD }, CWD, reg);
  assert.deepEqual(e, { kind: 'write', requests: [{ tool: 'Edit', file: '/w/node/a/b.md', cwd: CWD }] });
  const nb = classify({ tool_name: 'NotebookEdit', tool_input: { notebook_path: '/x/n.ipynb' }, cwd: CWD }, CWD, reg);
  assert.equal(nb.requests[0].file, '/x/n.ipynb');

  const b = classify({ tool_name: 'Bash', tool_input: { command: 'tools/items/items add x && echo y > z' }, cwd: CWD }, CWD, reg);
  assert.equal(b.kind, 'write');
  assert.deepEqual(b.requests, [
    { tool: 'Bash', cli: 'tools/items/items', args: ['add', 'x'], cwd: CWD },
    { tool: 'Bash', file: '/w/node/z', targets: ['/w/node/z'], cwd: CWD },
  ]);
  const bare = classify({ tool_name: 'Bash', tool_input: { command: 'cd site && ./store.sh import' }, cwd: CWD }, CWD, reg);
  assert.deepEqual(bare.requests, [{ tool: 'Bash', cli: './store.sh', args: ['import'], cwd: '/w/node/site' }]);
  // the counterfactual: the same command with no registry is not a CLI call
  assert.deepEqual(classify({ tool_name: 'Bash', tool_input: { command: 'tools/items/items add x' }, cwd: CWD }, CWD, null), { kind: 'read' });

  for (const [input, why] of [
    [null, /not a JSON object/], [[], /not a JSON object/], [{}, /no tool_name/],
    [{ tool_name: 'Edit', tool_input: {} }, /names no file/],
    [{ tool_name: 'Edit', tool_input: 'x' }, /not an object/],
    [{ tool_name: 'Bash', tool_input: {}, cwd: CWD }, /no command/],
    [{ tool_name: 'Bash', tool_input: { command: 'ls' } }, /no cwd/],
  ]) {
    const c = classify(input, CWD, reg);
    assert.equal(c.kind, 'bad', JSON.stringify(input));
    assert.match(c.why, why, JSON.stringify(input));
  }
});
