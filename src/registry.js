'use strict';
// The registry and the files beside it, read from disk: hub.json (the node's one
// input, PLAN-hub.md §2), stores.json (which paths are stores, and whose cli.json
// declares each) and each repo's cli.json (its CLI and its verbs). Nothing here
// names a repo, a role or a command: they are all data in those files.
//
// The shape is hub.schema.json (H1a-1), validated by src/schema.js; the rules the
// shape cannot say are checkFindings: the workspace rules, derived names, a process
// role's lifetime, every tag resolving, every seam kind owned, the stores map, and
// (with a root) the files the registry names existing.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const schema = require('./schema');
const V = require('./vocab');

const REGISTRY = 'hub.json';
const STORES = 'stores.json';
const DECLARATION = 'cli.json';
const SERVICES = 'services.json';   // a repo's `ids` declarations live here (PLAN-hub.md §12)
const SCHEMA = 'hub.schema.json';   // at the tool's root, beside bin/ and src/
const STARTER = 'hub.starter.json'; // what `hub init` writes, data not program
const STATE_DIR = '.hub';
const { MODES, LIFETIMES, WORKSPACE } = V;

const TOOL = path.join(__dirname, '..');
let schemaCache = null;
function loadSchema() {
  if (!schemaCache) schemaCache = JSON.parse(fs.readFileSync(path.join(TOOL, SCHEMA), 'utf8'));
  return schemaCache;
}
function loadStarter() {
  const s = JSON.parse(fs.readFileSync(path.join(TOOL, STARTER), 'utf8'));
  delete s._comment;
  return s;
}

// The nearest directory at or above `start` holding hub.json, or null.
function findRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, REGISTRY))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isStrList(v) { return Array.isArray(v) && v.every((s) => typeof s === 'string' && s.length > 0); }

// A slash-separated relative path, `.`-free, or null when `rel` leaves the root.
function cleanRel(rel) {
  const n = path.posix.normalize(String(rel).split(path.sep).join('/')).replace(/\/+$/, '');
  if (n === '..' || n.startsWith('../') || path.posix.isAbsolute(n)) return null;
  return n === '' ? '.' : n;
}

// A glob segment (`*`, `?`) or whole path (`**` crosses slashes) as a RegExp.
function globRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
function globMatch(glob, rel) { return globRe(glob).test(rel); }

// Whether a root-relative glob could match some path inside directory `dir`.
function globUnder(glob, dir) {
  if (dir === '.') return true;
  if (glob.includes('**')) return true;
  const g = glob.split('/');
  const d = dir.split('/');
  if (g.length <= d.length) return false;
  return d.every((seg, i) => globMatch(g[i], seg));
}

// hub.json as {root, file, hash, data} or {root, file, error}.
function loadRegistry(root) {
  const file = path.join(root, REGISTRY);
  let raw;
  try { raw = fs.readFileSync(file); } catch (e) { return { root, file, error: `${REGISTRY} unreadable: ${e.code || e.message}` }; }
  const hash = `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch (e) { return { root, file, hash, error: `${REGISTRY} is not JSON: ${e.message}` }; }
  return { root, file, hash, data };
}

// The shape, one finding per line; [] when it holds. hub.schema.json is the shape;
// the few path rules the schema cannot state (a path inside the node) follow it.
function shapeFindings(d) {
  if (!isObj(d)) return [`${REGISTRY}: not an object`];
  const f = schema.validate(loadSchema(), d);
  if (f.length) return f;
  if (Object.keys(d.roles).length === 0) f.push(`roles: must name at least one role`);
  for (const [name, r] of Object.entries(d.roles)) {
    if (r.dir !== undefined && cleanRel(r.dir) === null) f.push(`roles.${name}.dir: must be a path inside the node`);
  }
  for (const [key, row] of Object.entries(d.repos || {})) {
    const dir = row.dir === undefined ? key : row.dir;
    if (cleanRel(dir) === null || cleanRel(dir) === '.') f.push(`repos.${key}: its directory must be a path inside the node, not the root`);
  }
  const ws = isObj(d.owners) ? d.owners[WORKSPACE] : undefined;
  if (ws) for (const p of ws.paths) if (cleanRel(p) === null) f.push(`owners.${WORKSPACE}.paths: ${p} leaves the node`);
  for (const c of d.children || []) if (cleanRel(c.path) === null || cleanRel(c.path) === '.') f.push(`children: ${c.name}'s path must be inside the node, not the root`);
  return f;
}

// Each tags entry, resolved: [{tag, kind?, target, via: 'role'|'child'|'reserved'|null, by: 'tags'|'repos'}].
// A `via` of null is a target nothing declares (the vocabulary gate's finding).
function routeTable(d) {
  const roles = new Set(Object.keys(isObj(d.roles) ? d.roles : {}));
  const children = new Set((Array.isArray(d.children) ? d.children : []).map((c) => c && c.name).filter(Boolean));
  const via = (t) => (roles.has(t) ? 'role' : children.has(t) ? 'child' : V.RESERVED_TARGETS.includes(t) ? 'reserved' : null);
  const out = [];
  for (const [tag, v] of Object.entries(isObj(d.tags) ? d.tags : {})) {
    if (typeof v === 'string') out.push({ tag, kind: null, target: v, via: via(v), by: 'tags' });
    else if (isObj(v)) for (const [kind, t] of Object.entries(v)) out.push({ tag, kind, target: t, via: via(t), by: 'tags' });
  }
  const declared = new Set(out.map((r) => r.tag));
  for (const row of repoRows(d)) {
    for (const tag of row.tags) {
      if (declared.has(tag)) continue;
      // a tag a repo owns routes to the role or child of that name when no tags row says otherwise
      out.push({ tag, kind: null, target: row.key, via: via(row.key), by: 'repos' });
    }
  }
  return out;
}

// The vocabulary gate (§8): every tag resolves to a role, a child or a reserved
// target, and every tag a repo declares has a route.
function routeFindings(d) {
  const f = [];
  for (const r of routeTable(d)) {
    if (r.via) continue;
    if (r.by === 'repos') f.push(`repos.${r.target}.tags: ${r.tag} has no route: no tags row names it, and ${r.target} is neither a role nor a child`);
    else f.push(`tags.${r.tag}${r.kind ? `.${r.kind}` : ''}: ${r.target} is neither a role, a child nor a reserved target (${V.RESERVED_TARGETS.join(', ')})`);
  }
  return f;
}

// Owners both ways (routing-tree §14.7): every seam kind has a row or the explicit
// `unowned` default; the schema holds that every key is a kind, `unowned` or
// `workspace`.
function ownerFindings(d) {
  const owners = isObj(d.owners) ? d.owners : {};
  if (Object.prototype.hasOwnProperty.call(owners, V.UNOWNED)) return [];
  return V.SEAM_KINDS.filter((k) => !Object.prototype.hasOwnProperty.call(owners, k)).map((k) => `owners: seam kind ${k} has no row and no \`${V.UNOWNED}\` default`);
}

// Each repos row as {key, dir, cli, verbs, tags, ids, check}, dir root-relative.
function repoRows(d) {
  if (!isObj(d) || !isObj(d.repos)) return [];
  return Object.entries(d.repos).filter(([, r]) => isObj(r)).map(([key, r]) => ({
    key, dir: cleanRel(r.dir === undefined ? key : r.dir), cli: r.cli, verbs: r.verbs,
    tags: isStrList(r.tags) ? r.tags : [], ids: Array.isArray(r.ids) ? r.ids : null, check: typeof r.check === 'string' ? r.check : null,
  }));
}

function workspaceRow(d) {
  const ws = isObj(d.owners) ? d.owners[WORKSPACE] : undefined;
  return isObj(ws) && isStrList(ws.paths) && isStrList(ws.roles) ? ws : null;
}

// What a role may write, derived from `owners` (Decision 17; no per-role list):
// `workspace` when the workspace row names the role, and the repo whose directory
// is the role's `dir`. A `dir` no repos row owns derives its raw path, which is
// neither a repos key nor `workspace`, and so fails `hub check`.
function derivedNames(d, role) {
  const r = isObj(d.roles) ? d.roles[role] : undefined;
  if (!isObj(r)) return [];
  const out = [];
  const ws = workspaceRow(d);
  if (ws && ws.roles.includes(role)) out.push(WORKSPACE);
  if (typeof r.dir === 'string') {
    const dir = cleanRel(r.dir);
    if (dir && dir !== '.') {
      const row = repoRows(d).find((x) => x.dir === dir);
      out.push(row ? row.key : dir);
    }
  }
  return out;
}

// Every rule `hub check` holds beyond the shape: the three workspace rules (§8 "write
// gate", last clause), derived names, a process role's lifetime (§4), the stores
// map, the vocabulary gate, owners both ways; and, given `root`, that the files the
// registry names exist: a role's dir, a repos row's executable cli, rendered_from's
// source.
function checkFindings(d, root) {
  const f = shapeFindings(d);
  if (f.length) return f;
  const ws = workspaceRow(d);
  const rows = repoRows(d);
  for (const [name, r] of Object.entries(d.roles)) {
    if (r.mode === 'process' && r.lifetime === undefined) f.push(`roles.${name}: a process role declares its lifetime (${LIFETIMES.join(' | ')})`);
    if (r.mode !== 'process' && r.lifetime !== undefined) f.push(`roles.${name}: lifetime is a process role's column; a ${r.mode} role has none`);
  }
  if (ws) {
    for (const role of ws.roles) {
      if (!Object.prototype.hasOwnProperty.call(d.roles, role)) f.push(`owners.${WORKSPACE}.roles: ${role} is not a roles key`);
    }
    for (const p of ws.paths) {
      for (const row of rows) {
        if (globUnder(cleanRel(p), row.dir)) f.push(`owners.${WORKSPACE}.paths: ${p} falls under repos.${row.key} (${row.dir}/)`);
      }
    }
  }
  const keys = new Set(rows.map((x) => x.key));
  for (const role of Object.keys(d.roles)) {
    for (const name of derivedNames(d, role)) {
      if (name !== WORKSPACE && !keys.has(name)) f.push(`roles.${role}: derives ${name}, which is neither a repos key nor ${WORKSPACE}`);
    }
  }
  for (const [prefix, key] of Object.entries(storesMap(d))) {
    if (!keys.has(key)) f.push(`stores.${prefix}: ${key} is not a repos key`);
  }
  f.push(...routeFindings(d), ...ownerFindings(d));
  if (root) {
    for (const [name, r] of Object.entries(d.roles)) {
      if (r.dir !== undefined && !isDir(path.join(root, r.dir))) f.push(`roles.${name}.dir: ${r.dir}/ does not exist under the node`);
    }
    for (const row of rows) {
      if (!isDir(path.join(root, row.dir))) { f.push(`repos.${row.key}: its directory ${row.dir}/ does not exist under the node`); continue; }
      const cli = path.join(root, row.dir, row.cli);
      if (!isExecutable(cli)) f.push(`repos.${row.key}.cli: ${row.dir}/${row.cli} is not an executable file`);
    }
    if (isObj(d.rendered_from) && !fs.existsSync(path.join(root, d.rendered_from.source))) f.push(`rendered_from.source: ${d.rendered_from.source} does not exist under the node`);
  }
  return f;
}

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function isExecutable(p) { try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile(); } catch { return false; } }

// Root-relative path for an absolute or base-relative one, or null outside the root.
function relTo(root, p, base) {
  const abs = path.resolve(base || root, p);
  return cleanRel(path.relative(root, abs));
}

// The owner of a root-relative path: the repos key whose directory holds it
// (longest wins), else `workspace` for a workspace glob, else null (unowned).
function ownerOf(d, rel) {
  if (rel === null) return null;
  let best = null;
  for (const row of repoRows(d)) {
    if ((rel === row.dir || rel.startsWith(`${row.dir}/`)) && (!best || row.dir.length > best.dir.length)) best = row;
  }
  if (best) return best.key;
  const ws = workspaceRow(d);
  if (ws && ws.paths.some((g) => globMatch(cleanRel(g), rel))) return WORKSPACE;
  return null;
}

// stores.json: {stores: 1, entries: [{path: <root-relative glob>, declared_by: <repos key>}]}.
// Returns {entries} or {missing: true} or {error}.
function loadStores(root) {
  const file = path.join(root, STORES);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) {
    return e.code === 'ENOENT' ? { missing: true, error: `${STORES} missing` } : { error: `${STORES} unreadable: ${e.code}` };
  }
  let s;
  try { s = JSON.parse(raw); } catch (e) { return { error: `${STORES} is not JSON: ${e.message}` }; }
  if (!isObj(s) || s.stores !== 1 || !Array.isArray(s.entries)) return { error: `${STORES}: expected {"stores": 1, "entries": [...]}` };
  for (const [i, e] of s.entries.entries()) {
    if (!isObj(e) || typeof e.path !== 'string' || cleanRel(e.path) === null || typeof e.declared_by !== 'string') {
      return { error: `${STORES}: entries[${i}] needs a "path" inside the node and a "declared_by"` };
    }
  }
  return { entries: s.entries.map((e) => ({ path: cleanRel(e.path), declared_by: e.declared_by })) };
}

function storesFindings(d, stores) {
  if (stores.missing) return [];
  if (stores.error) return [stores.error];
  const keys = new Set(repoRows(d).map((x) => x.key));
  return stores.entries.filter((e) => !keys.has(e.declared_by)).map((e) => `${STORES}: ${e.path} is declared by ${e.declared_by}, which is not a repos key`);
}

function storeOf(stores, rel) {
  if (!stores || !stores.entries || rel === null) return null;
  return stores.entries.find((e) => globMatch(e.path, rel)) || null;
}

// A repo's cli.json as {cli, verbs, store} or {error}.
function loadDeclaration(root, row) {
  const file = path.join(root, row.dir, DECLARATION);
  let s;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    return { error: `${row.dir}/${DECLARATION} ${e.code === 'ENOENT' ? 'missing' : 'unreadable'}` };
  }
  if (!isObj(s) || typeof s.cli !== 'string' || !isStrList(s.verbs)) return { error: `${row.dir}/${DECLARATION}: needs "cli" and "verbs"` };
  return { cli: s.cli, verbs: s.verbs, store: s.store };
}

// hub.json `stores`: id prefix -> the repos key whose declared `get` answers it (§12).
// Prefixes are kept without their colon ("todo" for "todo:").
function storesMap(d) {
  if (!isObj(d) || !isObj(d.stores)) return {};
  const out = {};
  for (const [k, v] of Object.entries(d.stores)) if (typeof v === 'string' && v) out[k.replace(/:$/, '')] = v;
  return out;
}

// A repo's id declarations (§12): the repos row's own `ids` where the renderer put
// them, else the repo's services.json `ids`:
// {ids: [{prefix, pattern: RegExp|null, get: string|null}]} with the prefix kept without
// its colon; {ids: []} when neither declares any; {error} when malformed.
function loadIds(root, row) {
  let list = row.ids;
  let where = `repos.${row.key}.ids`;
  if (!Array.isArray(list)) {
    const file = path.join(root, row.dir, SERVICES);
    let s;
    try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
      return e.code === 'ENOENT' ? { ids: [] } : { ids: [], error: `${row.dir}/${SERVICES} ${e.name === 'SyntaxError' ? 'is not JSON' : 'unreadable'}` };
    }
    if (!isObj(s) || s.ids === undefined) return { ids: [] };
    if (!Array.isArray(s.ids)) return { ids: [], error: `${row.dir}/${SERVICES}: "ids" must be a list` };
    list = s.ids;
    where = `${row.dir}/${SERVICES}`;
  }
  const ids = [];
  for (const [i, e] of list.entries()) {
    if (!isObj(e) || typeof e.prefix !== 'string' || !e.prefix) return { ids: [], error: `${where}: ids[${i}] needs a "prefix"` };
    let pattern = null;
    if (e.pattern !== undefined) {
      if (typeof e.pattern !== 'string') return { ids: [], error: `${where}: ids[${i}].pattern must be a string` };
      try { pattern = new RegExp(`^(?:${e.pattern})$`); } catch { return { ids: [], error: `${where}: ids[${i}].pattern is not a regular expression` }; }
    }
    ids.push({ prefix: e.prefix.replace(/:$/, ''), pattern, get: typeof e.get === 'string' && e.get ? e.get : null, put: typeof e.put === 'string' && e.put ? e.put : null });
  }
  return { ids };
}

// The `get` a store's repo declares, as {cli, verb}: the first `ids` entry's `get`
// (one CLI answers every prefix a repo hands out), or null when none is declared.
function storeGet(root, row, prefix) {
  const ids = loadIds(root, row).ids;
  const decl = (prefix === undefined ? ids.find((x) => x.get) : ids.find((x) => x.prefix === prefix)) || null;
  if (!decl || !decl.get) return null;
  // the repos row's cli is the one `write` and `get` run (§2 repos); cli.json's verbs
  // are the write verbs, not needed to name the get
  return { cli: path.posix.join(row.dir, row.cli), verb: decl.get };
}

// The `get` verbs a repo declares, so a CLI call `<cli> get <id>` is read as a read.
function getVerbs(root, row) {
  return [...new Set(loadIds(root, row).ids.map((x) => x.get).filter(Boolean))];
}

const ID_RX = /^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z0-9][A-Za-z0-9._/-]*)$/;

// A word that is a declared store id -> {id, prefix, store: <repos key>, get}, else
// null: the prefix must be in `stores`, and the repo's declared pattern, if any, must
// match. A word no declared prefix claims is prose (§12).
function storeIdOf(d, root, word) {
  if (typeof word !== 'string') return null;
  const m = ID_RX.exec(word);
  if (!m) return null;
  const key = storesMap(d)[m[1]];
  if (!key) return null;
  const row = repoRows(d).find((r) => r.key === key);
  if (!row) return null;
  const decl = loadIds(root, row).ids.find((x) => x.prefix === m[1]) || null;
  if (decl && decl.pattern && !decl.pattern.test(word)) return null;
  return { id: word, prefix: m[1], store: key, get: storeGet(root, row, m[1]) };
}

// The repos row whose CLI a command word names, from `cwd`: a word with a slash
// is resolved and compared with <root>/<dir>/<cli>; a bare word is compared by
// basename (a PATH lookup this cannot see; stated in `hub hook gate --help`).
function cliRow(d, root, word, cwd) {
  if (typeof word !== 'string' || !word) return null;
  const rows = repoRows(d).filter((r) => typeof r.cli === 'string' && r.dir);
  if (word.includes('/')) {
    const abs = path.resolve(cwd || root, word);
    return rows.find((r) => path.join(root, r.dir, r.cli) === abs) || null;
  }
  return rows.find((r) => path.basename(r.cli) === word) || null;
}

module.exports = {
  REGISTRY, STORES, DECLARATION, SERVICES, SCHEMA, STARTER, STATE_DIR, MODES, LIFETIMES, WORKSPACE,
  findRoot, loadRegistry, loadSchema, loadStarter, shapeFindings, checkFindings, routeTable, routeFindings, ownerFindings,
  derivedNames, repoRows, workspaceRow,
  ownerOf, relTo, cleanRel, globMatch, globUnder, loadStores, storesFindings, storeOf,
  loadDeclaration, cliRow, storesMap, loadIds, storeGet, getVerbs, storeIdOf,
};
