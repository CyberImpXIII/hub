'use strict';
// The write rule (PLAN-hub.md §3 H1a-0): allow only a declared verb on a store the
// role may write. What a role may write is derived from `owners` (registry.js
// derivedNames); which paths are stores is stores.json; the verbs are the
// declaring repo's cli.json. Every Edit, Write, NotebookEdit or MultiEdit is
// denied, and so is a Bash write naming no declared verb; a deny names the verb
// to use where the path is a store. H2's lease adds the one Edit exception.
//
// decide(ctx, req) is pure over what it is handed, so the server and the tests
// call the same function: ctx = {root, registry: <hub.json data>, stores}, req =
// {role, tool, file?, targets?, cli?, verb?, args?, cwd?}. It never runs a verb.

const fs = require('node:fs');
const path = require('node:path');
const reg = require('./registry');

const EDIT_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'];

function deny(reason, extra) { return { decision: 'deny', reason, use: null, targets: [], ...extra }; }

// The verb to use for a store path, from its declaring repo's cli.json, or null.
function useFor(ctx, entry) {
  const row = reg.repoRows(ctx.registry).find((r) => r.key === entry.declared_by);
  if (!row) return null;
  const decl = reg.loadDeclaration(ctx.root, row);
  if (decl.error) return null;
  return { cli: path.posix.join(row.dir, decl.cli), verbs: decl.verbs };
}

function useText(use) {
  return use ? `write it through ${use.cli} ${use.verbs.join('|')}` : 'no verb is declared for it';
}

// The declared verb `args` name: the longest declared verb whose words appear as
// consecutive positional words, at the first position any does.
function verbIn(verbs, args) {
  const pos = (args || []).filter((a) => typeof a === 'string' && !a.startsWith('-'));
  for (let i = 0; i < pos.length; i++) {
    let best = null;
    for (const v of verbs) {
      const w = v.split(/\s+/);
      if (w.every((x, j) => pos[i + j] === x) && (!best || w.length > best.split(/\s+/).length)) best = v;
    }
    if (best) return best;
  }
  return null;
}

// The stores a CLI call writes: each argument that is an existing file the
// stores list names, and each existing directory argument's stores declared by
// this CLI's repo; with no path argument, the stores in `cwd`.
function cliTargets(ctx, row, args, cwd) {
  const base = cwd || ctx.root;
  const found = new Map();
  const inDir = (absDir) => {
    let names = [];
    try { names = fs.readdirSync(absDir); } catch { return; }
    for (const n of names) {
      const rel = reg.relTo(ctx.root, path.join(absDir, n));
      const e = reg.storeOf(ctx.stores, rel);
      if (e && e.declared_by === row.key) found.set(rel, e);
    }
  };
  let sawPath = false;
  for (const a of args || []) {
    if (typeof a !== 'string' || a.startsWith('-') || a === '') continue;
    const abs = path.resolve(base, a);
    const rel = reg.relTo(ctx.root, abs);
    if (rel === null) continue;
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    sawPath = true;
    if (st.isDirectory()) inDir(abs);
    else { const e = reg.storeOf(ctx.stores, rel); if (e) found.set(rel, e); }
  }
  if (!sawPath) inDir(base);
  return [...found.keys()].sort();
}

function decide(ctx, req) {
  const d = ctx.registry;
  if (!req || typeof req !== 'object') return deny('unparseable request');
  const { role, tool } = req;
  if (typeof role !== 'string' || !d.roles || !Object.prototype.hasOwnProperty.call(d.roles, role)) {
    return deny(`role ${JSON.stringify(role)} is not a roles key`);
  }
  const may = reg.derivedNames(d, role);
  const storesNote = ctx.stores && ctx.stores.error ? `; ${ctx.stores.error}` : '';

  if (EDIT_TOOLS.includes(tool) || (tool === 'Bash' && !req.cli)) {
    const files = tool === 'Bash' ? (Array.isArray(req.targets) ? req.targets : [req.file]).filter(Boolean) : [req.file].filter(Boolean);
    if (!files.length) return deny(`${tool} names no file`);
    const rels = files.map((f) => reg.relTo(ctx.root, f, req.cwd));
    let use = null;
    for (const rel of rels) {
      const e = reg.storeOf(ctx.stores, rel);
      if (e) { use = useFor(ctx, e); if (use) break; }
    }
    const shown = rels.map((r, i) => (r === null ? files[i] : r)).join(', ');
    const what = tool === 'Bash' ? 'a Bash write naming no declared verb' : `${tool} of ${shown}`;
    const why = tool === 'Bash' ? ` (writes ${shown})` : '';
    return deny(`${what}${why} is denied: every role is read-only; ${useText(use)}${use ? '' : storesNote}`, { use, targets: rels.filter((r) => r !== null) });
  }

  if (tool !== 'Bash') return deny(`${tool} is not a write the gate knows`);

  const row = reg.cliRow(d, ctx.root, req.cli, req.cwd);
  if (!row) return deny(`${req.cli} is not a declared CLI (no repos row names it)`);
  const decl = reg.loadDeclaration(ctx.root, row);
  if (decl.error) return deny(`${req.cli}: ${decl.error}, so no verb is declared`);
  const verb = typeof req.verb === 'string' && req.verb ? (decl.verbs.includes(req.verb) ? req.verb : null) : verbIn(decl.verbs, req.args);
  const use = { cli: path.posix.join(row.dir, decl.cli), verbs: decl.verbs };
  if (!verb) {
    const named = req.verb || (req.args || []).find((a) => typeof a === 'string' && !a.startsWith('-')) || '(none)';
    return deny(`${req.cli}: verb ${named} is not declared in ${row.dir}/${reg.DECLARATION}; declared: ${decl.verbs.join('|')}`, { use });
  }
  if (!ctx.stores || ctx.stores.error) return deny(`${req.cli} ${verb}: the store it writes cannot be placed${storesNote}`, { use, verb });
  const targets = cliTargets(ctx, row, req.args, req.cwd);
  if (!targets.length) return deny(`${req.cli} ${verb}: names no store ${row.dir}/${reg.DECLARATION} declares here`, { use, verb });
  const owners = targets.map((t) => reg.ownerOf(d, t));
  const bad = targets.filter((t, i) => !may.includes(owners[i]));
  if (bad.length) {
    const o = bad.map((t) => `${t} (${reg.ownerOf(d, t) || 'unowned'})`).join(', ');
    return deny(`${req.cli} ${verb}: role ${role} may not write ${o}; it may write: ${may.length ? may.join(', ') : 'nothing'}`, { use, verb, targets });
  }
  return { decision: 'allow', reason: `${req.cli} ${verb}: a declared verb on ${targets.join(', ')}, which ${role} may write`, use, verb, targets };
}

module.exports = { decide, verbIn, EDIT_TOOLS };
