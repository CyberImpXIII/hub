'use strict';
// The registry and the files beside it, read from disk: hub.json (the node's one
// input, PLAN-hub.md §2), stores.json (which paths are stores, and whose cli.json
// declares each) and each repo's cli.json (its CLI and its verbs). Nothing here
// names a repo, a role or a command: they are all data in those files.
//
// H1a-0 reads only what the write gate needs: `server`, `roles`, `owners.workspace`,
// `repos.<repo>.cli|verbs|dir` and `stores.json`. H1a-1 completes the schema.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REGISTRY = 'hub.json';
const STORES = 'stores.json';
const DECLARATION = 'cli.json';
const STATE_DIR = '.hub';
const MODES = ['window', 'cold', 'driven'];
const WORKSPACE = 'workspace';

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

// The shape H1a-0 needs, one finding per line; [] when it holds.
function shapeFindings(d) {
  const f = [];
  if (!isObj(d)) return [`${REGISTRY}: not an object`];
  if (d.hub !== 1) f.push(`${REGISTRY}: "hub" is ${JSON.stringify(d.hub)}, expected 1`);
  if (typeof d.node !== 'string' || !d.node) f.push(`${REGISTRY}: "node" must be a non-empty string`);
  const port = isObj(d.server) ? d.server.port : undefined;
  if (!Number.isInteger(port) || port < 1 || port > 65535) f.push(`${REGISTRY}: "server.port" must be an integer 1-65535`);
  if (!isObj(d.roles) || Object.keys(d.roles).length === 0) f.push(`${REGISTRY}: "roles" must be a non-empty object`);
  else {
    for (const [name, r] of Object.entries(d.roles)) {
      if (!isObj(r)) { f.push(`roles.${name}: not an object`); continue; }
      if (!MODES.includes(r.mode)) f.push(`roles.${name}.mode: ${JSON.stringify(r.mode)} is not one of ${MODES.join(', ')}`);
      if (r.dir !== undefined && (typeof r.dir !== 'string' || cleanRel(r.dir) === null)) f.push(`roles.${name}.dir: must be a path inside the node`);
      if (r.tools !== undefined && !isStrList(r.tools)) f.push(`roles.${name}.tools: must be a list of strings`);
    }
  }
  if (d.repos !== undefined) {
    if (!isObj(d.repos)) f.push(`${REGISTRY}: "repos" must be an object`);
    else {
      for (const [key, row] of Object.entries(d.repos)) {
        if (!isObj(row)) { f.push(`repos.${key}: not an object`); continue; }
        if (typeof row.cli !== 'string' || !row.cli) f.push(`repos.${key}.cli: must name the repo's CLI`);
        if (!isStrList(row.verbs)) f.push(`repos.${key}.verbs: must be a list of strings`);
        const dir = row.dir === undefined ? key : row.dir;
        if (typeof dir !== 'string' || cleanRel(dir) === null || cleanRel(dir) === '.') f.push(`repos.${key}: its directory must be a path inside the node, not the root`);
      }
    }
  }
  if (d.owners !== undefined && !isObj(d.owners)) f.push(`${REGISTRY}: "owners" must be an object`);
  const ws = isObj(d.owners) ? d.owners[WORKSPACE] : undefined;
  if (ws !== undefined) {
    if (!isObj(ws)) f.push(`owners.${WORKSPACE}: not an object`);
    else {
      if (!isStrList(ws.paths)) f.push(`owners.${WORKSPACE}.paths: must be a list of globs`);
      else for (const p of ws.paths) if (cleanRel(p) === null) f.push(`owners.${WORKSPACE}.paths: ${p} leaves the node`);
      if (!isStrList(ws.roles)) f.push(`owners.${WORKSPACE}.roles: must be a list of role names`);
    }
  }
  return f;
}

// Each repos row as {key, dir, cli, verbs}, dir root-relative.
function repoRows(d) {
  if (!isObj(d.repos)) return [];
  return Object.entries(d.repos).filter(([, r]) => isObj(r)).map(([key, r]) => ({
    key, dir: cleanRel(r.dir === undefined ? key : r.dir), cli: r.cli, verbs: r.verbs,
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

// The three workspace rules (§8 "write gate", last clause), plus the shape.
function checkFindings(d) {
  const f = shapeFindings(d);
  if (f.length) return f;
  const ws = workspaceRow(d);
  const rows = repoRows(d);
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
  return f;
}

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
  REGISTRY, STORES, DECLARATION, STATE_DIR, MODES, WORKSPACE,
  findRoot, loadRegistry, shapeFindings, checkFindings, derivedNames, repoRows, workspaceRow,
  ownerOf, relTo, cleanRel, globMatch, globUnder, loadStores, storesFindings, storeOf,
  loadDeclaration, cliRow,
};
