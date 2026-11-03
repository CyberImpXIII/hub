'use strict';
// The read rule (PLAN-hub.md §3 H1a-0b; PLAN-services.md §3 step 3, "The hub owner's
// four questions" 2 and 3): reads are never denied for being unowned, only writes
// are. A read is one of three cases: a STORE, named by an id whose prefix `stores`
// declares (§12) or by a path stores.json lists, answered with that store's `get`;
// an owned non-store path, plain Read; an unowned path, plain Read. Store-ness is
// on disk (stores.json, the owner's declarations), so the hook and the server read
// the same files and agree.
//
// decide(ctx, req) is pure over what it is handed, like gate.decide: ctx = {root,
// registry: <hub.json data>, stores}, req = {role, tool, id?, path?, store?, cwd?}.
// In H1a-0b the server NAMES the `get` and never runs it (`hub get` is H1a-2 and
// R1): an allowed store read runs as the role's own call, and the ledger row says
// which store it read.

const reg = require('./registry');

function answer(decision, kind, extra) {
  return { decision, kind, store: null, get: null, targets: [], id: null, reason: '', ...extra };
}

function getText(get) {
  return get ? `its \`get\` is ${get.cli} ${get.verb}` : 'its owner declares no `get` yet, so the read runs as the role\'s own call';
}

function decide(ctx, req) {
  const d = ctx.registry;
  if (!req || typeof req !== 'object') return answer('deny', null, { reason: 'unparseable request' });
  const { role } = req;
  if (typeof role !== 'string' || !d.roles || !Object.prototype.hasOwnProperty.call(d.roles, role)) {
    return answer('deny', null, { reason: `role ${JSON.stringify(role)} is not a roles key` });
  }
  const rows = reg.repoRows(d);

  if (typeof req.id === 'string' && req.id) {
    const s = reg.storeIdOf(d, ctx.root, req.id);
    if (!s) return answer('allow', 'plain', { id: req.id, reason: `${req.id}: no declared prefix claims it, so it is prose, not a store id: plain read` });
    return answer('allow', 'store', { id: req.id, store: s.store, get: s.get, reason: `${req.id} is a ${s.store} record; ${getText(s.get)}` });
  }

  if (typeof req.path === 'string' && req.path) {
    const rel = reg.relTo(ctx.root, req.path, req.cwd);
    const targets = rel === null ? [] : [rel];
    const shown = rel === null ? req.path : rel;
    const stores = ctx.stores;
    if (!stores || stores.missing) return answer('allow', 'plain', { targets, reason: `${shown}: ${reg.STORES} missing, so no path is a store here: plain Read (\`hub status\` reports it)` });
    if (stores.error) return answer('allow', 'plain', { targets, reason: `${shown}: ${stores.error}, so no path can be placed as a store: plain Read` });
    const e = reg.storeOf(stores, rel);
    if (!e) {
      const owner = reg.ownerOf(d, rel);
      return answer('allow', 'plain', { targets, reason: `${shown}: ${owner ? `${owner}'s` : 'an unowned'} non-store path: plain Read` });
    }
    const row = rows.find((r) => r.key === e.declared_by) || null;
    const get = row ? reg.storeGet(ctx.root, row) : null;
    return answer('allow', 'store', { targets, store: e.declared_by, get, reason: `${rel} is a store ${e.declared_by} declares; ${getText(get)}` });
  }

  if (typeof req.store === 'string' && req.store) {
    const row = rows.find((r) => r.key === req.store) || null;
    if (!row) return answer('deny', null, { reason: `${req.store} is not a repos key` });
    const get = reg.storeGet(ctx.root, row);
    return answer('allow', 'store', { store: req.store, get, reason: `a ${req.store} get naming no id; ${getText(get)}` });
  }

  return answer('deny', null, { reason: 'a read-request names neither an id, a path nor a store' });
}

module.exports = { decide };
