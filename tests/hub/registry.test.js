'use strict';
// H1a-1 (PLAN-hub.md §2, §8 "registry", "vocabulary", "owners both ways"): hub.json
// validates against hub.schema.json, whose enums are vocab.js's lists both ways; the
// §2 example registry, read from the plan itself, passes `hub check` with no child
// registered; `hub init` writes a starter that passes it; each rule the shape cannot
// say fails on its own fixture; `hub routes` equals GET /routes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const F = require('./fixture');
const reg = require('../../src/registry');
const V = require('../../src/vocab');
const { validate } = require('../../src/schema');
const client = require('../../src/client');

const SCHEMA = JSON.parse(fs.readFileSync(path.join(F.TOOL, 'hub.schema.json'), 'utf8'));
const run = (args, cwd) => F.hub({ root: cwd, token: 'x' }, args, { cwd });

test('the schema\'s enums are vocab.js\'s lists, both ways', () => {
  const role = SCHEMA.properties.roles.additionalProperties.properties;
  assert.deepEqual(role.mode.enum, V.MODES);
  assert.deepEqual(role.lifetime.enum, V.LIFETIMES);
  assert.deepEqual(SCHEMA.properties.server.properties.keep_alive.enum, V.KEEP_ALIVE);
  assert.deepEqual(SCHEMA.properties.owners.propertyNames.enum, V.OWNER_KEYS);
  assert.deepEqual(SCHEMA.properties.tags.additionalProperties.anyOf[1].propertyNames.enum, V.QUESTION_KINDS);
  assert.deepEqual(SCHEMA.properties.services.propertyNames.enum, [...V.SERVICES, V.USAGE_SERVICE]);
  assert.deepEqual(Object.keys(SCHEMA.properties.services.properties), [...V.SERVICES, V.USAGE_SERVICE]);
  assert.deepEqual(SCHEMA.properties.limits.required, V.LIMITS);
  assert.deepEqual(Object.keys(SCHEMA.properties.limits.properties), V.LIMITS);
  assert.deepEqual(reg.MODES, V.MODES);
  assert.deepEqual(reg.LIFETIMES, V.LIFETIMES);
});

test('the validator: a clean object passes, each keyword names its finding, an unknown keyword throws', () => {
  const s = { type: 'object', required: ['a'], additionalProperties: false, properties: { a: { enum: ['x', 'y'] }, n: { type: 'integer', minimum: 1 }, l: { type: 'array', items: { type: 'string' } }, k: { type: 'object', propertyNames: { enum: ['p'] }, additionalProperties: { type: 'string' } } } };
  assert.deepEqual(validate(s, { a: 'x', n: 2, l: ['s'], k: { p: 'v' } }), []);
  assert.deepEqual(validate(s, {}), ['hub.json: missing "a"']);
  assert.deepEqual(validate(s, { a: 'z' }), ['a: z is not one of x, y'.replace('a: z', 'a: "z"')]);
  assert.deepEqual(validate(s, { a: 'x', n: 0 }), ['n: must be at least 1']);
  assert.deepEqual(validate(s, { a: 'x', n: 'two' }), ['n: must be integer, not string']);
  assert.deepEqual(validate(s, { a: 'x', l: ['s', 3] }), ['l[1]: must be string, not integer']);
  assert.deepEqual(validate(s, { a: 'x', z: 1 }), ['z: unknown key "z"']);
  assert.deepEqual(validate(s, { a: 'x', k: { q: 'v' } }), ['k.q: "q" is not one of the allowed keys (p)']);
  assert.deepEqual(validate(s, { a: 'x', k: { p: 1 } }), ['k.p: must be string, not integer']);
  assert.throws(() => validate({ type: 'object', patternProperties: {} }, {}), /unknown keyword "patternProperties"/);
  // the schema file itself holds only keywords this validator reads
  assert.deepEqual(validate(SCHEMA, JSON.parse(fs.readFileSync(path.join(F.TOOL, 'hub.starter.json'), 'utf8'))).filter((x) => !/^node: |^server\.port: |_comment/.test(x)), []);
});

test('hub init writes the starter, which passes hub check; a second init refuses; --parent and --port are taken', async () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-init-')));
  try {
    const r = run(['init'], dir);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`^hub init: wrote hub\\.json for ${path.basename(dir)} \\(:\\d+, parent: none, 2 roles\\); hub check: ok`));
    const d = JSON.parse(fs.readFileSync(path.join(dir, 'hub.json'), 'utf8'));
    assert.equal(d._comment, undefined, 'the starter\'s comment is not written');
    assert.equal(d.node, path.basename(dir));
    assert.ok(Number.isInteger(d.server.port) && d.server.port > 0);
    assert.equal(d.parent, null);
    assert.deepEqual(Object.keys(d.limits), V.LIMITS);
    assert.deepEqual(d.owners, { unowned: 'dispatcher' });
    assert.deepEqual(Object.values(d.roles).map((x) => x.mode).sort(), ['process', 'window']);
    const c = run(['check'], dir);
    assert.equal(c.code, 0, c.stdout);
    assert.match(c.stdout, /^ok {4}hub\.json: .*2 roles, 0 repos, 0 routes; stores\.json missing/);
    assert.deepEqual(reg.checkFindings(d, dir), []);
    const again = run(['init'], dir);
    assert.equal(again.code, 1);
    assert.match(again.stderr, /hub init refused: hub\.json exists/);
    const routes = run(['routes'], dir);
    assert.equal(routes.code, 0);
    assert.match(routes.stdout, /no tag routes declared/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const dir2 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-init-')));
  try {
    const r = run(['init', '--parent', 'top', '--port', '47123'], dir2);
    assert.equal(r.code, 0, r.stderr);
    const d = JSON.parse(fs.readFileSync(path.join(dir2, 'hub.json'), 'utf8'));
    assert.equal(d.parent, 'top');
    assert.equal(d.server.port, 47123);
  } finally { fs.rmSync(dir2, { recursive: true, force: true }); }
});

// The §2 example registry, read from PLAN-hub.md so the plan and the program cannot
// drift apart: the first ```json block under "## 2. The registry file".
function exampleRegistry() {
  const text = fs.readFileSync(path.join(F.TOOL, 'PLAN-hub.md'), 'utf8');
  const sec = text.split(/^## 2\. The registry file/m)[1].split(/^## 3\./m)[0];
  const block = /```json\n([\s\S]*?)\n```/.exec(sec);
  assert.ok(block, 'PLAN-hub.md §2 holds a ```json block');
  return JSON.parse(block[1]);
}

test('the §2 example registry passes hub check with no child registered, limits and stores included; hub routes resolves every tag', async () => {
  const d = exampleRegistry();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-example-')));
  try {
    // the files the example names: role dirs, repos directories with an executable cli, the rendered source
    for (const [name, r] of Object.entries(d.roles)) if (r.dir) fs.mkdirSync(path.join(root, r.dir), { recursive: true });
    for (const row of reg.repoRows(d)) {
      fs.mkdirSync(path.join(root, row.dir), { recursive: true });
      F.write(root, path.join(row.dir, row.cli), '#!/bin/sh\nexit 0\n', 0o755);
    }
    F.write(root, d.rendered_from.source, '{}\n');
    F.write(root, 'hub.json', d);
    assert.deepEqual(reg.checkFindings(d, root), []);
    const c = run(['check'], root);
    assert.equal(c.code, 0, c.stdout);
    assert.match(c.stdout, /^ok {4}hub\.json: claudeTest, 4 roles, 3 repos, 10 routes; stores\.json missing/);
    assert.ok(d.limits && d.stores && Object.keys(d.stores).length === 2, 'limits and stores are in the example');
    assert.equal(fs.existsSync(path.join(root, '.hub', 'children')), false, 'no child is registered');
    const table = reg.routeTable(d);
    assert.deepEqual(table.map((r) => `${r.tag}${r.kind ? `[${r.kind}]` : ''}->${r.target}:${r.via}:${r.by}`).sort(), [
      'bug-report->@owner:reserved:tags', 'check-request->@check:reserved:tags', 'dispatch->dispatcher:role:tags',
      'dispatch-malformed->dispatcher:role:tags', 'question[dispatch]->dispatcher:role:tags', 'question[plan]->planner:role:tags',
      'report->@from:reserved:tags', 'scrape-request->site-scrapers:role:repos', 'task->@dir:reserved:tags', 'write-request->@write:reserved:tags',
    ].sort());
    const routes = run(['routes'], root);
    assert.equal(routes.code, 0, routes.stdout);
    assert.match(routes.stdout, /^question\[plan\] -> planner \(role\)$/m);
    assert.match(routes.stdout, /^scrape-request -> site-scrapers \(role, declared by the repo\)$/m);
    // the example's id declarations are read from the repos rows (not a services.json)
    const todoRow = reg.repoRows(d).find((r) => r.key === 'todo');
    assert.deepEqual(reg.getVerbs(root, todoRow), ['get']);
    assert.equal(reg.storeIdOf(d, root, 'todo:hb-37').store, 'todo');
    assert.equal(reg.storeIdOf(d, root, 'todo:37'), null, 'the declared pattern holds');
    assert.equal(reg.storeIdOf(d, root, 'ctx:7f3a').get.verb, 'get');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('each rule the shape cannot say fails on its own fixture, and the counterfactual passes', async () => {
  const cases = [
    ['a tag whose target is nothing declared', (r) => { r.tags = { task: 'nobody' }; }, /tags\.task: nobody is neither a role, a child nor a reserved target/],
    ['a nested tag whose target is nothing declared', (r) => { r.tags = { question: { plan: 'ghost' } }; }, /tags\.question\.plan: ghost is neither a role/],
    ['a nested tag keyed by a word that is no question kind', (r) => { r.tags = { question: { riddle: 'planner' } }; }, /tags\.question\.riddle: "riddle" is not one of the allowed keys/],
    ['a repo tag with no route and no role or child of the repo\'s name', (r) => { r.repos['tools/items'].tags = ['items-request']; }, /repos\.tools\/items\.tags: items-request has no route/],
    ['a seam kind with no row and no unowned default', (r) => { delete r.owners.unowned; }, /owners: seam kind lease has no row and no `unowned` default/],
    ['a stores prefix naming no repos key', (r) => { r.stores.ghost = 'nobody'; }, /stores\.ghost: nobody is not a repos key/],
    ['a role dir that does not exist', (r) => { r.roles.site.dir = 'elsewhere'; r.repos.elsewhere = { cli: 'x', verbs: [] }; }, /roles\.site\.dir: elsewhere\/ does not exist/],
    ['a repos cli that is not executable', (r) => { r.repos.site.cli = './cli.json'; }, /repos\.site\.cli: site\/\.\/cli\.json is not an executable file/],
    ['a rendered_from source that does not exist', (r) => { r.rendered_from = { source: 'roles.json', hash: 'sha256:0' }; }, /rendered_from\.source: roles\.json does not exist/],
    ['a child path at the root', (r) => { r.children = [{ name: 'me', path: '.' }]; }, /children: me's path must be inside the node/],
  ];
  for (const [what, mutate, re] of cases) {
    const node = await F.makeNode({ mutate });
    try {
      const r = F.hub(node, ['check']);
      assert.equal(r.code, 1, `${what}: ${r.stdout}`);
      assert.match(r.stdout, re, what);
    } finally { F.cleanup(node); }
  }
  // the counterfactuals: a tag routed to a child, a repo tag routed to a child of the repo's name, every seam kind owned without unowned
  const ok = await F.makeNode({ mutate: (r) => {
    r.tags = { 'kid-request': 'kid', question: { dispatch: 'dispatcher', plan: 'planner' }, report: '@from' };
    r.repos.kid = { cli: 'kid-cli', verbs: ['take'], tags: ['take-request'] };
    delete r.owners.unowned;
    for (const k of V.SEAM_KINDS) r.owners[k] = 'dispatcher';
  } });
  try {
    fs.mkdirSync(path.join(ok.root, 'kid'), { recursive: true });
    F.write(ok.root, 'kid/kid-cli', '#!/bin/sh\nexit 0\n', 0o755);
    const r = F.hub(ok, ['check']);
    assert.equal(r.code, 0, r.stdout);
    assert.match(r.stdout, /5 roles, 5 repos, 5 routes/);
    const table = reg.routeTable(ok.registry);
    assert.deepEqual(table.find((x) => x.tag === 'kid-request'), { tag: 'kid-request', kind: null, target: 'kid', via: 'child', by: 'tags' });
    assert.deepEqual(table.find((x) => x.tag === 'take-request'), { tag: 'take-request', kind: null, target: 'kid', via: 'child', by: 'repos' });
    // hub routes --json == GET /routes
    F.up(ok);
    const served = await client.call(ok.port, 'GET', '/routes', { token: ok.token, timeoutMs: 2000 });
    assert.equal(served.status, 200);
    const printed = JSON.parse(F.hub(ok, ['routes', '--json']).stdout);
    assert.deepEqual(printed, served.body);
    assert.equal(printed.routes.length, 5);
  } finally { F.down(ok); F.cleanup(ok); }
});
