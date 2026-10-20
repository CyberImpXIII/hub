'use strict';
// PLAN-hub.md §8 "direction audit" and "no names in the program", over the program
// (bin/ and src/). Each audit is shown live on a planted file first, so a pass
// means the audit looked, not that it was blind.
//
// The program may not: read or name `.claude` (the roster's home), require a
// module outside this tool, name a `tools/` path, name a workspace folder as a
// path segment or a quoted literal, name a script file (`x.sh`, `x.py`), or name
// the two window roles as literals (role names are hub.json data).
// REACH: the workspace folder names stand in for the roster's agent names (most
// roster agents are named for the folder they own); reading the roster itself
// from here would break the direction rule this audits. Where the workspace is
// absent (a lone clone) that half is UNCHECKED and says so.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TOOL } = require('./fixture');

const PROGRAM = ['bin', 'src'];
const WINDOWS = ['planner', 'dispatcher'];
const SELF = path.basename(TOOL);

function files(root, dirs) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(p);
    }
  };
  for (const d of dirs) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  return out;
}

// The workspace's folder names (top level and tools/*), this tool's own excluded;
// null when this tool does not sit in a workspace.
function workspaceNames() {
  const tools = path.dirname(TOOL);
  const top = path.dirname(tools);
  if (path.basename(tools) !== 'tools' || !fs.existsSync(path.join(top, 'tools'))) return null;
  const dirs = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
  return [...new Set([...dirs(top), ...dirs(tools)])].filter((n) => n !== SELF && n !== 'tools').sort();
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// -> [`<file>:<line>: <rule>: <text>`]
function audit(root, names) {
  const found = [];
  const rules = [
    ['reads or names .claude', /\.claude\b/],
    ['names a tools/ path', /\btools\//],
    ['names a script file', /\b[\w-]+\.(sh|py)\b/],
    ...WINDOWS.map((w) => [`names the ${w} role as a literal`, new RegExp(`['"\`]${w}['"\`]`)]),
    ...(names || []).map((n) => [`names the workspace folder ${n}`, new RegExp(`(^|[\\s'"\`(/])${esc(n)}/|['"\`]${esc(n)}['"\`]`)]),
  ];
  for (const f of files(root, PROGRAM)) {
    const rel = path.relative(root, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [why, re] of rules) if (re.test(line)) found.push(`${rel}:${i + 1}: ${why}: ${line.trim().slice(0, 100)}`);
      for (const m of line.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1];
        if (spec.startsWith('node:')) continue;
        if (!spec.startsWith('.')) { found.push(`${rel}:${i + 1}: requires a package outside node's own: ${spec}`); continue; }
        const to = path.resolve(path.dirname(f), spec);
        if (!to.startsWith(root + path.sep)) found.push(`${rel}:${i + 1}: requires a module outside the tool: ${spec}`);
      }
    });
  }
  return found;
}

function planted(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-audit-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'x.js'), content);
  return root;
}

test('the audits catch each planted violation, and pass a clean file', () => {
  const clean = planted("'use strict';\nconst fs = require('node:fs');\nconst r = require('./registry');\n// a role is a hub.json key\n");
  try { assert.deepEqual(audit(clean, ['site-x']), []); } finally { fs.rmSync(clean, { recursive: true }); }
  const bad = [
    ["const m = require('../../.claude/lib/append');", /reads or names \.claude/],
    ["const f = path.join(root, '.claude', 'agents.manifest.json');", /reads or names \.claude/],
    ["const m = require('../../../outside');", /outside the tool/],
    ["const m = require('left-pad');", /outside node's own/],
    ["run('tools/todo/todo', ['add']);", /names a tools\/ path/],
    ["spawn('./store.sh');", /names a script file/],
    ["if (role === 'planner') return;", /names the planner role/],
    ["const p = 'site-x/data.db';", /names the workspace folder site-x/],
    ["const r = \"site-x\";", /names the workspace folder site-x/],
  ];
  for (const [line, re] of bad) {
    const root = planted(`'use strict';\n${line}\n`);
    try {
      const f = audit(root, ['site-x']);
      assert.ok(f.some((x) => re.test(x)), `${line} -> ${JSON.stringify(f)}`);
    } finally { fs.rmSync(root, { recursive: true }); }
  }
});

test('direction audit: the program reads nothing of the roster and requires nothing outside the tool', () => {
  const f = audit(TOOL, []);
  assert.deepEqual(f, []);
  assert.ok(files(TOOL, PROGRAM).length >= 7, 'the audit read the program');
});

test('no names in the program: no workspace folder, path or script', (t) => {
  const names = workspaceNames();
  if (!names) { t.skip('UNCHECKED: no workspace around this tool, so no folder names to audit for'); return; }
  assert.ok(names.length > 5, `found the workspace's folders: ${names.join(', ')}`);
  assert.deepEqual(audit(TOOL, names), []);
});
